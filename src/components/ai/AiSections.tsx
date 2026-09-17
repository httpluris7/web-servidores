import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Cta } from "@/components/ui/Cta";
import { cn } from "@/lib/utils";

/**
 * Secciones compartidas por las tres landings de la familia AI Developer VPS
 * (`/ai-developer-vps`, `/claude-code-vps`, `/codex-vps`). Los textos comunes
 * viven en `ai.common`; lo que es propio de cada landing (hero, argumentos,
 * pasos, FAQ) vive en su namespace, para no publicar tres veces lo mismo.
 */

/* ------------------------------- Insignias -------------------------------- */

/** "Location: Germany 🇩🇪" + "Powered by AMD EPYC": fijas en las tres landings. */
export async function AiBadges({ className }: { className?: string }) {
  const t = await getTranslations("ai.common");
  return (
    <div className={cn("flex flex-wrap gap-3 font-mono text-xs", className)}>
      <span className="rounded border border-[var(--color-line)] px-3 py-1.5 text-[var(--color-fg-muted)]">
        {t("badgeLocation")}
      </span>
      <span className="rounded border border-[var(--color-line)] px-3 py-1.5 text-[var(--color-accent)]">
        {t("badgeEpyc")}
      </span>
    </div>
  );
}

/* -------------------------------- Terminal -------------------------------- */

export type TerminalLine = { prompt?: string; text: string; tone?: "cmd" | "out" | "ok" | "dim" };

/** Terminal estático (sin JS): muestra el primer acceso tal y como lo vive el cliente. */
export function AiTerminal({ title, lines }: { title: string; lines: TerminalLine[] }) {
  return (
    <div
      className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line-strong)] bg-black/60 shadow-2xl"
      role="img"
      aria-label={title}
    >
      <div className="flex items-center gap-1.5 border-b border-[var(--color-line)] px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
        <span className="ml-3 font-mono text-[0.7rem] text-[var(--color-fg-dim)]">{title}</span>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[0.78rem] leading-relaxed sm:p-5 sm:text-[0.82rem]">
        {lines.map((l, i) => (
          <span
            key={i}
            className={cn(
              "block",
              l.tone === "out" && "text-[var(--color-fg-muted)]",
              l.tone === "dim" && "text-[var(--color-fg-dim)]",
              l.tone === "ok" && "text-[var(--color-accent)]",
              (!l.tone || l.tone === "cmd") && "text-[var(--color-fg)]"
            )}
          >
            {l.prompt && <span className="select-none text-[var(--color-accent)]">{l.prompt} </span>}
            {l.text || "\u00a0"}
          </span>
        ))}
      </pre>
    </div>
  );
}

/* ---------------------- Comprar → conectar → autenticar ------------------- */

export async function AiSteps({ index }: { index: string }) {
  const t = await getTranslations("ai.common.steps");
  const cmds: Record<string, string> = { s2: "ssh developer@IP", s3: "claude  ·  codex" };
  return (
    <section className="container-edge py-14 md:py-24">
      <SectionHeader index={index} kicker={t("kicker")} title={t("title")} />
      <ol className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {(["s1", "s2", "s3", "s4"] as const).map((k, i) => (
          <Reveal key={k} delay={i} as="li">
            <div className="flex h-full flex-col rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-raised)] p-6">
              <span className="font-mono text-sm text-[var(--color-accent)]">0{i + 1}</span>
              <h3 className="mt-3 text-lg font-semibold tracking-tight">{t(`${k}.t`)}</h3>
              <p className="mt-2 text-sm text-[var(--color-fg-muted)]">{t(`${k}.d`)}</p>
              {cmds[k] && (
                <code className="mt-4 block rounded bg-black/40 px-3 py-2 font-mono text-xs text-[var(--color-fg)]">
                  {cmds[k]}
                </code>
              )}
            </div>
          </Reveal>
        ))}
      </ol>
    </section>
  );
}

/* -------------------------------- Beneficios ------------------------------ */

const BENEFITS = [
  ["claude", "🤖"],
  ["codex", "🧠"],
  ["epyc", "⚡"],
  ["germany", "🇩🇪"],
  ["docker", "🐳"],
  ["dev", "💻"],
  ["agents", "🔄"],
  ["ssh", "🖥️"],
  ["monthly", "📅"],
] as const;

export async function AiBenefits({ index }: { index: string }) {
  const t = await getTranslations("ai.common.benefits");
  return (
    <section className="container-edge py-14 md:py-24">
      <SectionHeader index={index} kicker={t("kicker")} title={t("title")} />
      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {BENEFITS.map(([k, emoji], i) => (
          <Reveal key={k} delay={i % 3} as="article">
            <div className="flex h-full flex-col rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-raised)] p-6">
              <span className="text-2xl leading-none" aria-hidden="true">{emoji}</span>
              <h3 className="mt-4 text-lg font-semibold tracking-tight">{t(`${k}.t`)}</h3>
              <p className="mt-2 text-sm text-[var(--color-fg-muted)]">{t(`${k}.d`)}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* --------------------------- Software preinstalado ------------------------ */

/** Nombres propios: no se traducen. Es exactamente lo que instala `guest-setup.sh`. */
const STACK: { key: "ai" | "dev" | "docker" | "terminal" | "monitoring"; items: string[] }[] = [
  { key: "ai", items: ["Claude Code", "OpenAI Codex CLI"] },
  {
    key: "dev",
    items: [
      "Git", "GitHub CLI", "Node.js LTS", "npm", "Python 3", "pip", "pipx",
      "build-essential", "curl", "wget", "unzip", "zip", "jq", "ripgrep",
    ],
  },
  { key: "docker", items: ["Docker Engine", "Docker CLI", "Docker Compose Plugin"] },
  { key: "terminal", items: ["tmux", "screen"] },
  { key: "monitoring", items: ["htop", "btop", "ncdu", "iotop", "net-tools", "dnsutils"] },
];
const SECURITY_ITEMS = 4;

export async function AiStack({ index }: { index: string }) {
  const t = await getTranslations("ai.common.stack");
  const chip =
    "rounded border border-[var(--color-line)] px-2.5 py-1 font-mono text-xs text-[var(--color-fg)]";
  return (
    <section className="container-edge py-14 md:py-24">
      <SectionHeader index={index} kicker={t("kicker")} title={t("title")} description={t("description")} />
      <div className="mt-12 grid gap-5 lg:grid-cols-2">
        {STACK.map((g, i) => (
          <Reveal key={g.key} delay={i % 2} as="article" className={g.key === "dev" ? "lg:row-span-2" : undefined}>
            <div className="h-full rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-raised)] p-6">
              <h3 className="mono-label">{t(g.key)}</h3>
              <ul className="mt-4 flex flex-wrap gap-2">
                {g.items.map((it) => (
                  <li key={it} className={chip}>{it}</li>
                ))}
              </ul>
            </div>
          </Reveal>
        ))}
        <Reveal as="article" className="lg:col-span-2">
          <div className="h-full rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-raised)] p-6">
            <h3 className="mono-label">{t("security")}</h3>
            <ul className="mt-4 flex flex-wrap gap-2">
              {Array.from({ length: SECURITY_ITEMS }, (_, i) => (
                <li key={i} className={chip}>{t(`securityItems.${i}`)}</li>
              ))}
            </ul>
            <p className="mt-5 text-sm text-[var(--color-fg-muted)]">{t("userNote")}</p>
            <p className="mt-2 text-sm text-[var(--color-fg-muted)]">{t("cleanNote")}</p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------- Casos de uso ----------------------------- */

const USE_CASES = 19;

export async function AiUseCases({ index }: { index: string }) {
  const t = await getTranslations("ai.common.useCases");
  return (
    <section className="container-edge py-14 md:py-24">
      <SectionHeader index={index} kicker={t("kicker")} title={t("title")} description={t("description")} />
      <Reveal>
        <ul className="mt-10 flex max-w-5xl flex-wrap gap-2.5">
          {Array.from({ length: USE_CASES }, (_, i) => (
            <li
              key={i}
              className="rounded-full border border-[var(--color-line)] bg-[var(--color-bg-raised)] px-4 py-2 text-sm text-[var(--color-fg)]"
            >
              {t(`items.${i}`)}
            </li>
          ))}
        </ul>
      </Reveal>
    </section>
  );
}

/* ------------------------------ Infraestructura --------------------------- */

export async function AiInfra({ index }: { index: string }) {
  const t = await getTranslations("ai.common.infra");
  return (
    <section className="container-edge py-14 md:py-24">
      <SectionHeader index={index} kicker={t("kicker")} title={t("title")} description={t("description")} />
      <Reveal>
        <dl className="mt-10 grid max-w-4xl gap-px overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-line)] sm:grid-cols-2">
          {(["cpu", "ram", "storage", "virt", "location", "os"] as const).map((k) => (
            <div key={k} className="bg-[var(--color-bg-raised)] p-5">
              <dt className="mono-label text-[0.65rem]">{t(`${k}.k`)}</dt>
              <dd className="mt-1.5 text-sm text-[var(--color-fg)]">{t(`${k}.v`)}</dd>
            </div>
          ))}
        </dl>
      </Reveal>
    </section>
  );
}

/* ---------------------------------- Entrega -------------------------------- */

const DELIVERY_ITEMS = 7;

export async function AiDelivery({ index }: { index: string }) {
  const t = await getTranslations("ai.common.delivery");
  return (
    <section className="container-edge py-14 md:py-24">
      <SectionHeader index={index} kicker={t("kicker")} title={t("title")} description={t("description")} />
      <div className="mt-10 grid gap-6 lg:grid-cols-2 lg:items-start">
        <Reveal>
          <ul className="grid gap-2.5 text-sm">
            {Array.from({ length: DELIVERY_ITEMS }, (_, i) => (
              <li
                key={i}
                className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-bg-raised)] px-4 py-3"
              >
                <span className="text-[var(--color-accent)]" aria-hidden="true">✓</span>
                {t(`items.${i}`)}
              </li>
            ))}
          </ul>
        </Reveal>
        <Reveal delay={1}>
          <AiTerminal
            title={t("terminalTitle")}
            lines={[
              { prompt: "$", text: "ssh developer@5.83.142.xx" },
              { text: "ViaHost · AI Developer VPS     Ubuntu 24.04 LTS · Germany", tone: "dim" },
              { text: "" },
              { prompt: "developer@ai-developer:~$", text: "claude" },
              { text: "→ Claude Code · connect your Anthropic account", tone: "out" },
              { prompt: "developer@ai-developer:~$", text: "codex" },
              { text: "→ OpenAI Codex · connect your OpenAI / ChatGPT account", tone: "out" },
            ]}
          />
        </Reveal>
      </div>
    </section>
  );
}

/* --------------------------- Aviso Claude / OpenAI ------------------------ */

const PROVIDES = 5;

/**
 * Advertencia comercial: las suscripciones de Anthropic/OpenAI NO van incluidas,
 * y ViaHost no está afiliada con ellas. Debe verse (borde de acento, no letra
 * pequeña) y va en las tres landings.
 */
export async function AiDisclaimer() {
  const t = await getTranslations("ai.common.disclaimer");
  return (
    <section className="container-edge py-10 md:py-14">
      <Reveal>
        <aside
          role="note"
          className="mx-auto max-w-4xl rounded-[var(--radius-lg)] border border-[var(--color-accent)]/40 bg-[var(--color-bg-raised)] p-6 md:p-8"
        >
          <h2 className="flex items-start gap-3 text-xl font-semibold tracking-tight sm:text-2xl">
            <span aria-hidden="true">⚠️</span>
            {t("title")}
          </h2>
          <p className="mt-4 text-[var(--color-fg)]">{t("p1")}</p>
          <p className="mt-2 text-[var(--color-fg)]">{t("p2")}</p>
          <p className="mt-5 text-sm font-medium text-[var(--color-fg)]">{t("providesTitle")}</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {Array.from({ length: PROVIDES }, (_, i) => (
              <li
                key={i}
                className="rounded border border-[var(--color-line)] px-2.5 py-1 text-sm text-[var(--color-fg-muted)]"
              >
                {t(`provides.${i}`)}
              </li>
            ))}
          </ul>
          <p className="mt-5 text-sm text-[var(--color-fg)]">{t("notProvided")}</p>
          <p className="mt-4 border-t border-[var(--color-line)] pt-4 text-xs leading-relaxed text-[var(--color-fg-muted)]">
            {t("trademark")}
          </p>
        </aside>
      </Reveal>
    </section>
  );
}

/* ----------------------------- Enlaces cruzados --------------------------- */

const LANDINGS = {
  main: "/ai-developer-vps",
  claude: "/claude-code-vps",
  codex: "/codex-vps",
} as const;

/** Interconecta las tres landings: desde cada una se enlaza a las otras dos. */
export async function AiCrossLinks({ current }: { current: keyof typeof LANDINGS }) {
  const t = await getTranslations("ai.common.cross");
  const otras = (Object.keys(LANDINGS) as (keyof typeof LANDINGS)[]).filter((k) => k !== current);
  return (
    <section className="container-edge py-10 md:py-14">
      <h2 className="mono-label">{t("title")}</h2>
      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        {otras.map((k) => (
          <Link
            key={k}
            href={LANDINGS[k]}
            className="group rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-raised)] p-6 transition-colors hover:border-[var(--color-accent)]"
          >
            <span className="flex items-center justify-between text-lg font-semibold tracking-tight">
              {t(`${k}.t`)}
              <span className="text-[var(--color-accent)] transition-transform group-hover:translate-x-1" aria-hidden="true">
                →
              </span>
            </span>
            <span className="mt-2 block text-sm text-[var(--color-fg-muted)]">{t(`${k}.d`)}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ----------------------------------- CTA ---------------------------------- */

export async function AiCta({ href = "/ai-developer-vps#planes" }: { href?: string }) {
  const t = await getTranslations("ai.common.cta");
  return (
    <section className="border-t border-[var(--color-line)]">
      <div className="container-edge py-14 text-center md:py-24">
        <Reveal>
          <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">{t("title")}</h2>
          <div className="mt-8 flex justify-center">
            <Cta href={href}>{t("button")} →</Cta>
          </div>
          <p className="mt-6 font-mono text-xs text-[var(--color-fg-muted)]">{t("subtitle")}</p>
        </Reveal>
      </div>
    </section>
  );
}

/* ----------------- Argumentos y pasos propios de cada landing -------------- */

/** "Por qué un VPS para X": 6 argumentos del namespace de la landing (`ai.claude` / `ai.codex`). */
export async function AiWhy({ ns, index }: { ns: "claude" | "codex"; index: string }) {
  const t = await getTranslations(`ai.${ns}.why`);
  return (
    <section className="container-edge py-14 md:py-24">
      <SectionHeader index={index} kicker={t("kicker")} title={t("title")} />
      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Reveal key={i} delay={i % 3} as="article">
            <div className="flex h-full flex-col rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-raised)] p-6">
              <h3 className="text-lg font-semibold tracking-tight">{t(`items.${i}.t`)}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--color-fg-muted)]">{t(`items.${i}.d`)}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/** Pasos con su comando, del namespace de la landing. */
export async function AiHow({ ns, index }: { ns: "claude" | "codex"; index: string }) {
  const t = await getTranslations(`ai.${ns}.how`);
  return (
    <section className="container-edge py-14 md:py-24">
      <SectionHeader index={index} kicker={t("kicker")} title={t("title")} />
      <ol className="mt-12 grid max-w-4xl gap-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Reveal key={i} delay={i} as="li">
            <div className="grid gap-4 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-raised)] p-5 sm:grid-cols-[1fr_minmax(0,18rem)] sm:items-center md:p-6">
              <div>
                <h3 className="flex items-baseline gap-3 text-lg font-semibold tracking-tight">
                  <span className="font-mono text-sm text-[var(--color-accent)]">0{i + 1}</span>
                  {t(`steps.${i}.t`)}
                </h3>
                <p className="mt-2 text-sm text-[var(--color-fg-muted)]">{t(`steps.${i}.d`)}</p>
              </div>
              <code className="block overflow-x-auto whitespace-nowrap rounded bg-black/50 px-4 py-3 font-mono text-sm text-[var(--color-fg)]">
                <span className="select-none text-[var(--color-accent)]">$ </span>
                {t(`steps.${i}.cmd`)}
              </code>
            </div>
          </Reveal>
        ))}
      </ol>
    </section>
  );
}

/** "¿Qué plan elegir?": dos párrafos + enlace a los planes. */
export async function AiWhich({ ns }: { ns: "claude" | "codex" }) {
  const t = await getTranslations(`ai.${ns}.which`);
  return (
    <section className="container-edge max-w-3xl py-10 md:py-14">
      <p className="mono-label">{t("kicker")}</p>
      <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">{t("title")}</h2>
      <div className="mt-5 space-y-4 text-[var(--color-fg-muted)]">
        <p>{t("p1")}</p>
        <p>{t("p2")}</p>
      </div>
    </section>
  );
}
