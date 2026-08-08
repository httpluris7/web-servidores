#!/bin/sh
#
# ViaHost monitoring agent — https://viahost.top
#
# Reports CPU, memory, disk, network and load from this machine to your ViaHost
# control panel, so you can see them as graphs. It reads /proc, sends one small
# JSON document per minute over HTTPS, and does nothing else: it opens no ports,
# accepts no incoming connections and cannot be used to control this server.
#
# Install:
#   curl -fsSL https://viahost.top/agente.sh -o viahost-agent.sh
#   sudo sh viahost-agent.sh --token YOUR_TOKEN
#
# Remove:
#   sudo /usr/local/bin/viahost-agent --uninstall
#
# Requirements: Linux, /bin/sh, awk, and curl or wget. No packages are
# installed and nothing is compiled.
#
# You are encouraged to read this file before running it. That is why the
# install command downloads it first instead of piping it into a shell.

set -eu

# The C locale is not optional: under a Spanish or French locale awk would
# print "12,3" and every number we send would be invalid JSON.
LC_ALL=C
export LC_ALL

AGENT_VERSION="1.0.0"

DEFAULT_URL="https://viahost.top"
DEFAULT_INTERVAL=60

BIN=/usr/local/bin/viahost-agent
CONF=/etc/viahost-agent.conf
STATE_DIR=/var/lib/viahost-agent
STATE="$STATE_DIR/state"
UNIT=/etc/systemd/system/viahost-agent.service
RUN_USER=viahost-agent

say() { printf '%s\n' "$*"; }
die() { printf 'error: %s\n' "$*" >&2; exit 1; }

# ---------------------------------------------------------------------------
# Collection
# ---------------------------------------------------------------------------

# Total and idle CPU jiffies since boot. Percentages only make sense as a
# difference between two readings, which is what the state file is for.
cpu_counters() {
  awk '/^cpu /{ t=0; for (i=2; i<=NF; i++) t+=$i; printf "%.0f %.0f", t, $5+$6; exit }' /proc/stat
}

# Bytes in and out, added up across real interfaces. Loopback and the virtual
# devices created by Docker, LXC and libvirt are skipped: counting them would
# report container-to-container traffic as if it had crossed the network.
net_counters() {
  awk '
    NR > 2 {
      gsub(/:/, " ")
      iface = $1
      if (iface ~ /^(lo|docker|veth|br-|virbr|vmbr|tun|tap|kube|cni|flannel|wg|zt)/) next
      rx += $2; tx += $10
    }
    END { printf "%.0f %.0f", rx, tx }
  ' /proc/net/dev
}

# Used and total memory in MiB, plus swap usage as a percentage.
#
# "Used" is total minus MemAvailable, not minus MemFree: the kernel counts page
# cache as used memory, so MemFree on a healthy server is always near zero and
# would make every machine look like it is out of RAM.
mem_values() {
  awk '
    /^MemTotal:/     { mt = $2 }
    /^MemAvailable:/ { ma = $2 }
    /^MemFree:/      { mf = $2 }
    /^Buffers:/      { bu = $2 }
    /^Cached:/       { ca = $2 }
    /^SwapTotal:/    { st = $2 }
    /^SwapFree:/     { sf = $2 }
    END {
      # MemAvailable appeared in Linux 3.14; approximate it on older kernels.
      if (ma == "") ma = mf + bu + ca
      used = mt - ma
      if (used < 0) used = 0
      swap = (st > 0) ? (st - sf) * 100 / st : 0
      printf "%.0f %.0f %.1f", used / 1024, mt / 1024, swap
    }
  ' /proc/meminfo
}

# Used and total space of the root filesystem, in GiB.
disk_values() {
  df -P -k / 2>/dev/null | awk 'NR == 2 { printf "%.2f %.2f", $3 / 1048576, $2 / 1048576 }'
}

load_values() {
  awk '{ printf "%.2f", $1 }' /proc/loadavg
}

# Real processes, counted from /proc.
#
# Not the fourth field of /proc/loadavg: that one counts kernel tasks, so it
# reports roughly one and a half times what `ps -e` shows and anyone comparing
# the panel against their own terminal would think the number is made up.
proc_count() {
  set -- /proc/[0-9]*
  # An unmatched glob stays literal; that would count as one.
  if [ "$1" = '/proc/[0-9]*' ]; then printf '0'; else printf '%d' "$#"; fi
}

uptime_value() {
  awk '{ printf "%.0f", $1 }' /proc/uptime
}

cpu_count() {
  awk '/^processor/ { n++ } END { printf "%d", (n ? n : 1) }' /proc/cpuinfo 2>/dev/null || printf '1'
}

os_name() {
  if [ -r /etc/os-release ]; then
    # shellcheck disable=SC1091
    . /etc/os-release 2>/dev/null || true
    printf '%s' "${PRETTY_NAME:-${NAME:-Linux}}"
  else
    printf 'Linux'
  fi
}

# Strips what would break the JSON we build by hand. The panel sanitises this
# again on arrival; doing it here keeps a malformed request from being sent at
# all instead of being rejected once a minute forever.
clean() {
  printf '%s' "$1" | tr -d '"\\' | tr -cd '\40-\176' | cut -c1-80
}

# ---------------------------------------------------------------------------
# One sample
# ---------------------------------------------------------------------------

send_sample() {
  now=$(date +%s)

  set -- $(cpu_counters); cpu_total=$1; cpu_idle=$2
  set -- $(net_counters); rx=$1; tx=$2

  prev_ts=""; prev_total=""; prev_idle=""; prev_rx=""; prev_tx=""
  if [ -r "$STATE" ]; then
    # shellcheck disable=SC2046
    set -- $(cat "$STATE" 2>/dev/null)
    if [ $# -eq 5 ]; then
      prev_ts=$1; prev_total=$2; prev_idle=$3; prev_rx=$4; prev_tx=$5
    fi
  fi

  elapsed=0
  if [ -n "$prev_ts" ]; then
    elapsed=$((now - prev_ts))
  fi

  # No usable previous reading — first run, a reboot (counters go backwards) or
  # a gap so long the average would be meaningless. Take a one second sample so
  # the very first point on the graph is not empty.
  if [ "$elapsed" -le 0 ] || [ "$elapsed" -gt 900 ] ||
     [ "$cpu_total" -lt "${prev_total:-0}" ] || [ "$rx" -lt "${prev_rx:-0}" ]; then
    prev_total=$cpu_total; prev_idle=$cpu_idle; prev_rx=$rx; prev_tx=$tx
    sleep 1
    set -- $(cpu_counters); cpu_total=$1; cpu_idle=$2
    set -- $(net_counters); rx=$1; tx=$2
    elapsed=1
    now=$(date +%s)
  fi

  printf '%s %s %s %s %s\n' "$now" "$cpu_total" "$cpu_idle" "$rx" "$tx" > "$STATE" 2>/dev/null || true

  cpu_pct=$(awk -v t="$cpu_total" -v i="$cpu_idle" -v pt="$prev_total" -v pi="$prev_idle" '
    BEGIN {
      dt = t - pt; di = i - pi
      if (dt <= 0) { print "null"; exit }
      v = (dt - di) * 100 / dt
      if (v < 0) v = 0; if (v > 100) v = 100
      printf "%.1f", v
    }')

  rx_bps=$(awk -v c="$rx" -v p="$prev_rx" -v s="$elapsed" 'BEGIN { v=(c-p)/s; if (v<0) v=0; printf "%.0f", v }')
  tx_bps=$(awk -v c="$tx" -v p="$prev_tx" -v s="$elapsed" 'BEGIN { v=(c-p)/s; if (v<0) v=0; printf "%.0f", v }')

  set -- $(mem_values); mem_used=$1; mem_total=$2; swap_pct=$3
  set -- $(disk_values 2>/dev/null || printf '0 0'); disk_used=${1:-0}; disk_total=${2:-0}
  load1=$(load_values)
  procs=$(proc_count)
  up=$(uptime_value)

  host=$(clean "$(cat /proc/sys/kernel/hostname 2>/dev/null || hostname 2>/dev/null || echo unknown)")
  os=$(clean "$(os_name)")
  kern=$(clean "$(uname -r 2>/dev/null || echo unknown)")
  arch=$(clean "$(uname -m 2>/dev/null || echo unknown)")
  vcpu=$(cpu_count)

  payload=$(cat <<JSON
{"cpu":$cpu_pct,"memUsadaMb":$mem_used,"memTotalMb":$mem_total,"swapPct":$swap_pct,"discoUsadoGb":$disk_used,"discoTotalGb":$disk_total,"rxBps":$rx_bps,"txBps":$tx_bps,"rxTotal":$rx,"txTotal":$tx,"carga1":$load1,"procesos":$procs,"uptime":$up,"meta":{"hostname":"$host","os":"$os","kernel":"$kern","arch":"$arch","vcpu":$vcpu,"version":"$AGENT_VERSION","intervalo":$INTERVAL}}
JSON
)

  post "$payload"
}

# Sends the document and prints the HTTP status. Never fails the caller: a
# network blip must not stop the loop or fill the logs with dead jobs.
#
# Deliberately no `curl -f`: with it, curl exits non-zero on 401 or 429 and the
# fallback below would append "000" to the real status, so a rejected token
# would be reported as the meaningless code "401000" during install.
post() {
  body=$1
  endpoint="$URL/api/agente/metricas"
  if command -v curl >/dev/null 2>&1; then
    curl -sS --max-time 20 -o /dev/null -w '%{http_code}' \
      -H 'Content-Type: application/json' \
      -H "Authorization: Bearer $TOKEN" \
      -H "User-Agent: viahost-agent/$AGENT_VERSION" \
      --data-binary "$body" "$endpoint" 2>/dev/null || printf '000'
  elif command -v wget >/dev/null 2>&1; then
    # wget cannot report the status without parsing its stderr; exit code 8
    # means "the server answered with an error", which is enough to tell a
    # rejected request apart from an unreachable panel.
    if wget -q -O /dev/null --timeout=20 \
      --header='Content-Type: application/json' \
      --header="Authorization: Bearer $TOKEN" \
      --header="User-Agent: viahost-agent/$AGENT_VERSION" \
      --post-data="$body" "$endpoint" 2>/dev/null; then
      printf '200'
    elif [ $? = 8 ]; then
      printf '400'
    else
      printf '000'
    fi
  else
    printf '000'
  fi
}

# ---------------------------------------------------------------------------
# Install
# ---------------------------------------------------------------------------

require_root() {
  [ "$(id -u)" = "0" ] || die "run this as root (sudo sh $0 ...)"
}

# A dedicated account with no shell and no home. Everything the agent reads
# (/proc, df /) is world readable, so there is no reason for it to be root.
create_user() {
  if id "$RUN_USER" >/dev/null 2>&1; then return 0; fi
  if command -v useradd >/dev/null 2>&1; then
    useradd --system --no-create-home --shell /usr/sbin/nologin "$RUN_USER" 2>/dev/null ||
      useradd --system --no-create-home --shell /sbin/nologin "$RUN_USER" 2>/dev/null ||
      useradd --system --no-create-home "$RUN_USER" 2>/dev/null || return 1
  elif command -v adduser >/dev/null 2>&1; then
    adduser -S -D -H "$RUN_USER" 2>/dev/null || return 1
  else
    return 1
  fi
}

write_unit() {
  cat > "$UNIT" <<UNITFILE
[Unit]
Description=ViaHost monitoring agent
Documentation=https://viahost.top
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=$BIN loop
Restart=always
RestartSec=30
User=$OWNER
Group=$OWNER
StateDirectory=viahost-agent

# It only reads /proc and makes outbound HTTPS requests. Everything else is off.
NoNewPrivileges=yes
PrivateTmp=yes
ProtectSystem=strict
ProtectHome=yes
ProtectKernelTunables=yes
ProtectKernelModules=yes
ProtectControlGroups=yes
RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX
RestrictNamespaces=yes
RestrictSUIDSGID=yes
LockPersonality=yes
MemoryDenyWriteExecute=yes
SystemCallArchitectures=native
CapabilityBoundingSet=

[Install]
WantedBy=multi-user.target
UNITFILE
}

install_agent() {
  require_root
  [ -n "${TOKEN:-}" ] || die "missing --token. Copy it from your ViaHost panel."
  [ -r /proc/stat ] || die "this does not look like Linux: /proc/stat is not readable."
  command -v awk >/dev/null 2>&1 || die "awk is required and was not found."
  if ! command -v curl >/dev/null 2>&1 && ! command -v wget >/dev/null 2>&1; then
    die "either curl or wget is required and neither was found."
  fi

  OWNER=root
  if create_user; then OWNER=$RUN_USER; fi

  say "▸ Installing the ViaHost agent (v$AGENT_VERSION)"

  # The script installs a copy of itself, so updating means re-running it. When
  # it was piped straight into a shell there is no file to copy, so it is
  # fetched again from the panel.
  if [ "$0" != "$BIN" ]; then
    if [ -f "$0" ] && [ -r "$0" ]; then
      cp "$0" "$BIN"
    elif command -v curl >/dev/null 2>&1; then
      curl -fsSL "$URL/agente.sh" -o "$BIN" || die "could not download the agent from $URL."
    else
      wget -qO "$BIN" "$URL/agente.sh" || die "could not download the agent from $URL."
    fi
  fi
  chmod 755 "$BIN"

  umask 077
  mkdir -p "$STATE_DIR"
  cat > "$CONF" <<CONFFILE
# ViaHost monitoring agent — configuration
# The token identifies this machine. Treat it like a password: anyone holding
# it can send readings that would show up as this server in the panel.
URL=$URL
TOKEN=$TOKEN
INTERVAL=$INTERVAL
CONFFILE
  chmod 600 "$CONF"

  say "▸ Sending a first reading to check the token…"
  # shellcheck disable=SC2034
  code=$(send_sample)

  # After the test reading, not before: that first sample runs as root and
  # creates the state file, which the service then has to be able to rewrite.
  chown "$OWNER" "$CONF" 2>/dev/null || true
  chown -R "$OWNER" "$STATE_DIR" 2>/dev/null || true
  case "$code" in
    200|204)     say "✓ The panel accepted the reading." ;;
    400|401|403) die "the panel rejected the token. Generate a new one and try again." ;;
    000)         die "could not reach $URL. Check outbound HTTPS and DNS on this machine." ;;
    *)           die "unexpected response from the panel (HTTP $code)." ;;
  esac

  if command -v systemctl >/dev/null 2>&1 && [ -d /run/systemd/system ]; then
    write_unit
    systemctl daemon-reload
    systemctl enable --now viahost-agent >/dev/null 2>&1 ||
      die "the service could not be started. Check: systemctl status viahost-agent"
    say "✓ Installed as a systemd service, reporting every ${INTERVAL}s."
    say "  Status:  systemctl status viahost-agent"
    say "  Logs:    journalctl -u viahost-agent -f"
  else
    # No systemd (containers, older systems): a cron entry does the same job,
    # once a minute, using the state file to work out the averages.
    command -v crontab >/dev/null 2>&1 || die "no systemd and no crontab: cannot schedule the agent."
    entry="* * * * * $BIN once >/dev/null 2>&1"
    ( crontab -u "$OWNER" -l 2>/dev/null | grep -v 'viahost-agent' || true; echo "$entry" ) |
      crontab -u "$OWNER" - ||
      die "the cron entry could not be installed."
    say "✓ Installed as a cron job (no systemd on this machine), reporting every minute."
  fi

  say ""
  say "The graphs appear in your panel within a couple of minutes."
  say "To remove it later:  sudo $BIN --uninstall"
}

uninstall_agent() {
  require_root
  say "▸ Removing the ViaHost agent"
  if command -v systemctl >/dev/null 2>&1; then
    systemctl disable --now viahost-agent >/dev/null 2>&1 || true
  fi
  rm -f "$UNIT"
  if command -v systemctl >/dev/null 2>&1 && [ -d /run/systemd/system ]; then
    systemctl daemon-reload >/dev/null 2>&1 || true
  fi
  for u in "$RUN_USER" root; do
    if command -v crontab >/dev/null 2>&1 && crontab -u "$u" -l >/dev/null 2>&1; then
      crontab -u "$u" -l 2>/dev/null | grep -v 'viahost-agent' | crontab -u "$u" - 2>/dev/null || true
    fi
  done
  rm -f "$CONF"
  rm -rf "$STATE_DIR"
  if id "$RUN_USER" >/dev/null 2>&1 && command -v userdel >/dev/null 2>&1; then
    userdel "$RUN_USER" >/dev/null 2>&1 || true
  fi
  rm -f "$BIN"
  say "✓ Removed. Nothing of the agent is left on this machine."
  say "  The readings already stored stay in the panel until you delete the server there."
}

# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

load_conf() {
  [ -r "$CONF" ] || die "not configured: $CONF is missing. Re-run the installer."
  # shellcheck disable=SC1090
  . "$CONF"
  : "${URL:?missing URL in $CONF}"
  : "${TOKEN:?missing TOKEN in $CONF}"
  : "${INTERVAL:=$DEFAULT_INTERVAL}"
}

URL=$DEFAULT_URL
INTERVAL=$DEFAULT_INTERVAL
TOKEN=""
ACTION=install

# `--token X` needs its value; without this guard the shift below would run out
# of arguments and `set -e` would kill the script with no explanation.
needs_value() { [ "$1" -ge 2 ] || die "$2 needs a value"; }

while [ $# -gt 0 ]; do
  case "$1" in
    once|loop)      ACTION=$1 ;;
    --token)        needs_value $# --token; TOKEN=$2; shift ;;
    --token=*)      TOKEN=${1#*=} ;;
    --url)          needs_value $# --url; URL=$2; shift ;;
    --url=*)        URL=${1#*=} ;;
    --interval)     needs_value $# --interval; INTERVAL=$2; shift ;;
    --interval=*)   INTERVAL=${1#*=} ;;
    --uninstall)    ACTION=uninstall ;;
    --version)      say "viahost-agent $AGENT_VERSION"; exit 0 ;;
    -h|--help)
      say "Usage: sh agente.sh --token TOKEN [--url URL] [--interval SECONDS]"
      say "       $BIN --uninstall"
      exit 0 ;;
    *) die "unknown option: $1 (try --help)" ;;
  esac
  shift
done

# Trailing slashes would produce //api/... — harmless but ugly in the logs.
URL=${URL%/}
case "$INTERVAL" in
  ''|*[!0-9]*) die "--interval must be a whole number of seconds" ;;
esac
[ "$INTERVAL" -ge 30 ] || die "--interval must be at least 30 seconds"

case "$ACTION" in
  install)
    install_agent
    ;;
  uninstall)
    uninstall_agent
    ;;
  once)
    load_conf
    mkdir -p "$STATE_DIR" 2>/dev/null || true
    send_sample >/dev/null
    ;;
  loop)
    load_conf
    mkdir -p "$STATE_DIR" 2>/dev/null || true
    while :; do
      send_sample >/dev/null || true
      sleep "$INTERVAL"
    done
    ;;
esac
