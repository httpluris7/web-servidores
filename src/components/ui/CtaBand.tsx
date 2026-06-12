import { deployUrl } from "@/data/site";
import { Cta } from "./Cta";
import { Reveal } from "./Reveal";

type Props = {
  title?: string;
  subtitle?: string;
};

export function CtaBand({
  title = "Ready to deploy?",
  subtitle = "provisioning in 60s · no setup · cancel anytime",
}: Props) {
  return (
    <section className="border-t border-[var(--color-line)]">
      <div className="container-edge py-14 md:py-20 text-center md:py-24">
        <Reveal>
          <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h2>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Cta href={deployUrl()}>
              Deploy in 60 seconds →
            </Cta>
            <Cta href="/proteccion-ddos" variant="secondary">
              View DDoS Protection
            </Cta>
          </div>
          <p className="mt-6 font-mono text-xs text-[var(--color-fg-muted)]">{subtitle}</p>
        </Reveal>
      </div>
    </section>
  );
}
