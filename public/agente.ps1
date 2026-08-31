<#
    ViaHost monitoring agent (Windows) — https://viahost.top

    Reports CPU, memory, disk, network and uptime from this machine to your
    ViaHost control panel, so you can see them as graphs. It reads local
    performance data through WMI/CIM, sends one small JSON document per minute
    over HTTPS, and does nothing else: it opens no ports, accepts no incoming
    connections and cannot be used to control this server.

    Install (from an elevated PowerShell):
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        Invoke-WebRequest https://viahost.top/agente.ps1 -OutFile viahost-agent.ps1
        .\viahost-agent.ps1 -Token YOUR_TOKEN

    Remove:
        & "$env:ProgramData\viahost-agent\agent.ps1" -Uninstall

    Requirements: Windows Server 2016+ / Windows 10+ with PowerShell 5.1. No
    packages are installed and nothing is compiled. This is the Windows twin of
    https://viahost.top/agente.sh (Linux); it sends the very same fields.
#>

[CmdletBinding()]
param(
    [string]$Token,
    [string]$Url = "https://viahost.top",
    [int]$Interval = 60,
    [switch]$Once,
    [switch]$Loop,
    [switch]$Uninstall,
    [switch]$Version
)

# The invariant culture is not optional: it is the Windows equivalent of the
# LC_ALL=C in the Linux agent. Under a Spanish or French system the "-f"
# formatter would print "12,3" and every number we send would be invalid JSON.
[System.Threading.Thread]::CurrentThread.CurrentCulture = [System.Globalization.CultureInfo]::InvariantCulture
$ErrorActionPreference = "Stop"

# TLS 1.2 explicitly: Server 2016 does not always negotiate it by default, and
# viahost.top only speaks modern TLS.
try {
    [Net.ServicePointManager]::SecurityProtocol =
        [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
} catch { }

$AgentVersion = "1.0.0"
$DefaultInterval = 60

$DataDir    = Join-Path $env:ProgramData "viahost-agent"
$ConfFile   = Join-Path $DataDir "agent.conf"
$StateFile  = Join-Path $DataDir "state"
$ScriptDest = Join-Path $DataDir "agent.ps1"
$TaskName   = "viahost-agent"
$PsExe      = Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe"

function Say($m) { Write-Host $m }
function Die($m) { [Console]::Error.WriteLine("error: $m"); exit 1 }

# ---------------------------------------------------------------------------
# Formatting helpers (JSON is built by hand to control null and decimals)
# ---------------------------------------------------------------------------

# A number formatted with a fixed number of decimals, or the literal null when
# the reading is missing. The invariant culture set above makes "-f" use a dot.
function J($v, [int]$dec = 0) {
    if ($null -eq $v) { return "null" }
    try { $d = [double]$v } catch { return "null" }
    if ([double]::IsNaN($d) -or [double]::IsInfinity($d)) { return "null" }
    if ($d -lt 0) { $d = 0 }
    return ("{0:F$dec}" -f $d)
}

# Strips what would break the JSON we build by hand and caps the length. The
# panel sanitises this again on arrival; doing it here keeps a malformed request
# from being sent at all.
function Clean($s) {
    if ($null -eq $s) { return "" }
    $t = [string]$s
    $t = $t -replace '[\\"]', ''
    $t = $t -replace '[^\x20-\x7e]', ''
    if ($t.Length -gt 80) { $t = $t.Substring(0, 80) }
    return $t
}

# ---------------------------------------------------------------------------
# Collection
# ---------------------------------------------------------------------------

function Get-Sample {
    $os = Get-CimInstance Win32_OperatingSystem
    $cs = Get-CimInstance Win32_ComputerSystem

    # CPU: average of the per-processor LoadPercentage (0-100). WMI keeps this
    # value updated itself, so it needs no two-reading delta and, unlike
    # Get-Counter, its name is not localised.
    $loads = @(Get-CimInstance Win32_Processor | ForEach-Object { $_.LoadPercentage } | Where-Object { $_ -ne $null })
    $cpu = if ($loads.Count -gt 0) { ($loads | Measure-Object -Average).Average } else { $null }

    # Memory in MiB. FreePhysicalMemory is what is actually available, the
    # counterpart of MemAvailable on Linux.
    $memTotalMb = [math]::Round($os.TotalVisibleMemorySize / 1024)
    $memFreeMb  = [math]::Round($os.FreePhysicalMemory / 1024)
    $memUsedMb  = [math]::Max(0, $memTotalMb - $memFreeMb)

    # Page file usage as a percentage (the swap of Windows).
    $swapPct = 0
    if ($os.SizeStoredInPagingFiles -gt 0) {
        $swapPct = ($os.SizeStoredInPagingFiles - $os.FreeSpaceInPagingFiles) * 100.0 / $os.SizeStoredInPagingFiles
    }

    # System drive space in GiB.
    $sysDrive = ($env:SystemDrive) -replace '[^A-Za-z:]', ''
    if (-not $sysDrive) { $sysDrive = "C:" }
    $disk = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='$sysDrive'"
    $discoTotalGb = $null; $discoUsadoGb = $null
    if ($disk -and $disk.Size -gt 0) {
        $discoTotalGb = $disk.Size / 1GB
        $discoUsadoGb = ($disk.Size - $disk.FreeSpace) / 1GB
    }

    # Network: cumulative bytes across the real adapters. Get-NetAdapterStatistics
    # already excludes the loopback pseudo-interface.
    $rxTotal = $null; $txTotal = $null
    try {
        $stats = Get-NetAdapterStatistics -ErrorAction Stop
        if ($stats) {
            $rxTotal = ($stats | Measure-Object -Property ReceivedBytes -Sum).Sum
            $txTotal = ($stats | Measure-Object -Property SentBytes -Sum).Sum
        }
    } catch { }

    $procesos = @(Get-Process).Count
    $uptime = $null
    try { $uptime = [int]((Get-Date) - $os.LastBootUpTime).TotalSeconds } catch { }

    return [ordered]@{
        cpu          = $cpu
        memUsadaMb   = $memUsedMb
        memTotalMb   = $memTotalMb
        swapPct      = $swapPct
        discoUsadoGb = $discoUsadoGb
        discoTotalGb = $discoTotalGb
        rxTotal      = $rxTotal
        txTotal      = $txTotal
        procesos     = $procesos
        uptime       = $uptime
        hostname     = $env:COMPUTERNAME
        os           = $os.Caption
        kernel       = $os.Version
        arch         = $env:PROCESSOR_ARCHITECTURE
        vcpu         = $cs.NumberOfLogicalProcessors
    }
}

# Network rate (bytes/s) from the delta against the previous reading, kept in a
# tiny state file. On the first run, a reboot (counters go backwards) or a long
# gap there is nothing to average, so the rate is left null for that sample.
function Get-Rates($rxTotal, $txTotal) {
    $now = [int][DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
    $prevTs = $null; $prevRx = $null; $prevTx = $null
    if (Test-Path $StateFile) {
        $parts = (Get-Content $StateFile -ErrorAction SilentlyContinue) -split '\s+'
        if ($parts.Count -ge 3) { $prevTs = [double]$parts[0]; $prevRx = [double]$parts[1]; $prevTx = [double]$parts[2] }
    }
    if ($null -ne $rxTotal -and $null -ne $txTotal) {
        try { Set-Content -Path $StateFile -Value "$now $([long]$rxTotal) $([long]$txTotal)" -Encoding ASCII } catch { }
    }

    $rxBps = $null; $txBps = $null
    if ($null -ne $prevTs -and $null -ne $rxTotal) {
        $elapsed = $now - $prevTs
        if ($elapsed -gt 0 -and $elapsed -le 900 -and $rxTotal -ge $prevRx -and $txTotal -ge $prevTx) {
            $rxBps = ($rxTotal - $prevRx) / $elapsed
            $txBps = ($txTotal - $prevTx) / $elapsed
        }
    }
    return @($rxBps, $txBps)
}

function Build-Body($s) {
    $rates = Get-Rates $s.rxTotal $s.txTotal
    $rxBps = $rates[0]; $txBps = $rates[1]

    $meta = '{"hostname":"' + (Clean $s.hostname) + '","os":"' + (Clean $s.os) +
            '","kernel":"' + (Clean $s.kernel) + '","arch":"' + (Clean $s.arch) +
            '","vcpu":' + (J $s.vcpu 0) + ',"version":"' + $AgentVersion +
            '","intervalo":' + [int]$Interval + '}'

    return '{"cpu":' + (J $s.cpu 1) +
           ',"memUsadaMb":' + (J $s.memUsadaMb 0) +
           ',"memTotalMb":' + (J $s.memTotalMb 0) +
           ',"swapPct":' + (J $s.swapPct 1) +
           ',"discoUsadoGb":' + (J $s.discoUsadoGb 2) +
           ',"discoTotalGb":' + (J $s.discoTotalGb 2) +
           ',"rxBps":' + (J $rxBps 0) +
           ',"txBps":' + (J $txBps 0) +
           ',"rxTotal":' + (J $s.rxTotal 0) +
           ',"txTotal":' + (J $s.txTotal 0) +
           ',"carga1":null' +
           ',"procesos":' + (J $s.procesos 0) +
           ',"uptime":' + (J $s.uptime 0) +
           ',"meta":' + $meta + '}'
}

# Sends the document and returns the HTTP status code (0 = could not reach it).
# Never throws to the caller: a network blip must not stop the loop.
function Send-Sample {
    $body = Build-Body (Get-Sample)
    $endpoint = "$Url/api/agente/metricas"
    try {
        $resp = Invoke-WebRequest -Uri $endpoint -Method Post -Body $body `
            -ContentType "application/json" `
            -Headers @{ Authorization = "Bearer $Token" } `
            -UserAgent "viahost-agent/$AgentVersion" `
            -UseBasicParsing -TimeoutSec 20
        return [int]$resp.StatusCode
    } catch [System.Net.WebException] {
        if ($_.Exception.Response) { return [int]$_.Exception.Response.StatusCode }
        return 0
    } catch {
        return 0
    }
}

# ---------------------------------------------------------------------------
# Install / uninstall
# ---------------------------------------------------------------------------

function Require-Admin {
    $id = [Security.Principal.WindowsIdentity]::GetCurrent()
    $p = New-Object Security.Principal.WindowsPrincipal($id)
    if (-not $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        Die "run this as Administrator (or let the ViaHost panel install it for you)."
    }
}

function Load-Conf {
    if (-not (Test-Path $ConfFile)) { Die "not configured: $ConfFile is missing. Re-run the installer." }
    foreach ($line in (Get-Content $ConfFile)) {
        if ($line -match '^\s*URL=(.+)$')      { $script:Url = $Matches[1].Trim() }
        elseif ($line -match '^\s*TOKEN=(.+)$') { $script:Token = $Matches[1].Trim() }
        elseif ($line -match '^\s*INTERVAL=(\d+)$') { $script:Interval = [int]$Matches[1] }
    }
    if (-not $Token) { Die "missing TOKEN in $ConfFile" }
    if ($Interval -lt 30) { $script:Interval = $DefaultInterval }
}

function Install-Agent {
    Require-Admin
    if (-not $Token) { Die "missing -Token. Copy it from your ViaHost panel." }
    $script:Url = $Url.TrimEnd('/')
    if ($Interval -lt 30) { Die "-Interval must be at least 30 seconds." }

    New-Item -ItemType Directory -Force -Path $DataDir | Out-Null

    # The script installs a copy of itself; updating means re-running it. When
    # invoked from somewhere else, copy it into ProgramData; if there is no file
    # to copy (rare), fetch it again from the panel.
    $me = $PSCommandPath
    if ($me -and (Test-Path $me) -and ($me -ne $ScriptDest)) {
        Copy-Item -Force $me $ScriptDest
    } elseif (-not (Test-Path $ScriptDest)) {
        Invoke-WebRequest -Uri "$Url/agente.ps1" -OutFile $ScriptDest -UseBasicParsing
    }

    # The token identifies this machine; treat it like a password. It lives only
    # in this file (not in the scheduled task definition).
    Set-Content -Path $ConfFile -Encoding ASCII -Value @(
        "# ViaHost monitoring agent - configuration",
        "URL=$Url",
        "TOKEN=$Token",
        "INTERVAL=$Interval"
    )

    Say "> Sending a first reading to check the token..."
    $code = Send-Sample
    switch ($code) {
        { $_ -in 200, 204 } { Say "  The panel accepted the reading." }
        { $_ -in 400, 401, 403 } { Die "the panel rejected the token. Generate a new one and try again." }
        0 { Die "could not reach $Url. Check outbound HTTPS and DNS on this machine." }
        default { Die "unexpected response from the panel (HTTP $code)." }
    }

    # A scheduled task running as SYSTEM at startup, restarted if it ever dies.
    # The Windows counterpart of the systemd unit the Linux agent installs.
    $action = New-ScheduledTaskAction -Execute $PsExe `
        -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$ScriptDest`" -Loop"
    $trigger = New-ScheduledTaskTrigger -AtStartup
    $principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
    $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable `
        -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
        -RestartInterval (New-TimeSpan -Minutes 1) -RestartCount 3 `
        -ExecutionTimeLimit ([TimeSpan]::Zero)
    Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger `
        -Principal $principal -Settings $settings -Force | Out-Null
    Start-ScheduledTask -TaskName $TaskName

    Say ""
    Say "Installed as the scheduled task '$TaskName', reporting every ${Interval}s."
    Say "The graphs appear in your panel within a couple of minutes."
    Say "To remove it later:  & `"$ScriptDest`" -Uninstall"
}

function Uninstall-Agent {
    Require-Admin
    Say "> Removing the ViaHost agent"
    try { Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction Stop } catch { }
    try { if (Test-Path $DataDir) { Remove-Item -Recurse -Force $DataDir } } catch { }
    Say "  Removed. The readings already stored stay in the panel until you delete the server there."
}

# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if ($Version) { Say "viahost-agent $AgentVersion"; exit 0 }

if ($Uninstall) {
    Uninstall-Agent
} elseif ($Loop) {
    Load-Conf
    while ($true) {
        try { [void](Send-Sample) } catch { }
        Start-Sleep -Seconds $Interval
    }
} elseif ($Once) {
    Load-Conf
    [void](Send-Sample)
} else {
    Install-Agent
}
