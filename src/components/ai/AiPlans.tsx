import { getTranslations } from "next-intl/server";
import type { Plan } from "@/data/products";
import { cn, eurPrecio } from "@/lib/utils";
import { usd } from "@/lib/currency";
import { Link } from "@/i18n/navigation";
import { Price } from "@/components/ui/Price";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { AddToCartButton } from "@/components/cart/AddToCartButton";

/** Lo que llevan TODOS los planes además de sus recursos (claves de `ai.common.planFeatures`). */
const FEATURES = ["ipv4", "ipv6", "ssh", "docker", "claude", "codex", "os", "location"] as const;

/** Planes con ficha comercial propia en `ai.common.plans`; el resto usa `fallback`. */
const CON_FICHA = new Set(["ai-starter", "ai-developer", "ai-multi-agent"]);
const FOCUS_MULTI_AGENT = 9;

/**
 * Tarjeta de un plan AI Developer VPS. A diferencia de `PlanCard` (specs + añadir
 * al carrito), aquí manda el mensaje comercial: para quién es el plan, todo lo
 * que trae instalado y un CTA directo al checkout (comprar → conectar →
 * autenticar → programar). El precio es el del catálogo: mensual y sin letra pequeña.
 */
async function AiPlanCard({ plan }: { plan: Plan }) {
  const t = await getTranslations("ai.common");
  const ficha = CON_FICHA.has(plan.id) ? plan.id : "fallback";

  return (
    <div
      className={cn(
        "relative flex h-full flex-col rounded-[var(--radius-lg)] border bg-[var(--color-bg-raised)] p-6 transition-colors md:p-7",
        plan.popular
          ? "border-[var(--color-accent)] glow-accent"
          : "border-[var(--color-line)] hover:border-[var(--color-line-strong)]"
      )}
    >
      {plan.popular && (
        <span className="absolute -top-2.5 left-6 rounded bg-[var(--color-accent)] px-2 py-0.5 font-mono text-[0.65rem] font-medium uppercase tracking-wider text-black">
          {t("recommended")}
        </span>
      )}

      <h3 className="text-xl font-semibold tracking-tight">
        <span aria-hidden="true">{t(`plans.${ficha}.emoji`)} </span>
        {plan.name}
      </h3>

      <div className="mt-4 flex items-baseline gap-1">
        <span className="font-mono text-4xl font-semibold tracking-tight">
          <Price value={plan.price} />
        </span>
        <span className="text-sm text-[var(--color-fg-muted)]">{t("perMonth")}</span>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-[var(--color-fg-muted)]">{t(`plans.${ficha}.desc`)}</p>

      <ul className="mt-6 space-y-2 border-t border-[var(--color-line)] pt-6 text-sm">
        {[plan.cpu, plan.ram, plan.storage].map((spec) => (
          <li key={spec} className="flex items-start gap-2.5 font-medium text-[var(--color-fg)]">
            <Check />
            {spec}
          </li>
        ))}
        {FEATURES.map((k) => (
          <li key={k} className="flex items-start gap-2.5 text-[var(--color-fg-muted)]">
            <Check />
            {t(`planFeatures.${k}`)}
          </li>
        ))}
      </ul>

      {plan.id === "ai-multi-agent" && (
        <div className="mt-6 border-t border-[var(--color-line)] pt-5">
          <p className="mono-label text-[0.65rem]">{t("plans.ai-multi-agent.focusTitle")}</p>
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {Array.from({ length: FOCUS_MULTI_AGENT }, (_, i) => (
              <li
                key={i}
                className="rounded border border-[var(--color-line)] px-2 py-1 font-mono text-[0.68rem] text-[var(--color-fg-muted)]"
              >
                {t(`plans.ai-multi-agent.focus.${i}`)}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-auto pt-7">
        <Link
          href={plan.orderUrl}
          className={cn(
            "flex w-full items-center justify-center rounded-[var(--radius-md)] px-5 py-3 text-center text-sm font-medium transition-all",
            plan.popular
              ? "bg-[var(--color-accent)] text-black hover:bg-[var(--color-accent-dim)]"
              : "border border-[var(--color-line-strong)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
          )}
        >
          {/* El importe del CTA se pinta en las dos divisas, como `Price`. */}
          <span className="c-eur">{t(`plans.${ficha}.cta`, { price: eurPrecio(plan.price), name: plan.name })}</span>
          <span className="c-usd">{t(`plans.${ficha}.cta`, { price: usd(plan.price), name: plan.name })}</span>
        </Link>
        <AddToCartButton
          planId={plan.id}
          variant="outline"
          className="mt-2 w-full border-transparent !py-2 text-xs font-normal text-[var(--color-fg-muted)]"
        />
      </div>
    </div>
  );
}

function Check() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      className="mt-0.5 shrink-0 text-[var(--color-accent)]"
      aria-hidden="true"
    >
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

/** Rejilla de planes AI Developer VPS + franja de facturación (mensual, sin permanencia). */
export async function AiPlans({ plans, index = "/01" }: { plans: Plan[]; index?: string }) {
  const t = await getTranslations("ai.common");
  return (
    <section id="planes" className="container-edge scroll-mt-24 py-14 md:py-24">
      <SectionHeader
        index={index}
        kicker={t("plansKicker")}
        title={t("plansTitle")}
        description={t("plansDescription")}
      />
      <div className="mt-12 grid gap-5 lg:grid-cols-3">
        {plans.map((p, i) => (
          <Reveal key={p.id} delay={i}>
            <AiPlanCard plan={p} />
          </Reveal>
        ))}
      </div>
      <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 font-mono text-sm text-[var(--color-fg-muted)]">
        {(["monthly", "renewal", "noCommitment"] as const).map((k) => (
          <li key={k} className="flex items-center gap-2">
            <span className="text-[var(--color-accent)]" aria-hidden="true">✓</span>
            {t(`billing.${k}`)}
          </li>
        ))}
      </ul>
    </section>
  );
}
