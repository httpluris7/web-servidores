import { deployUrl } from "@/data/site";
import { Cta } from "./Cta";
import { Reveal } from "./Reveal";

type Props = {
  title?: string;
  subtitle?: string;
};

export function CtaBand({
  title = "¿Listo para desplegar?",
  subtitle = "provisioning en 60 s · sin setup · cancela cuando quieras",
}: Props) {
  return (
    <section className="border-t border-[var(--color-line)]">
      <div className="container-edge py-14 md:py-20 text-center md:py-24">
        <Reveal>
          <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h2>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Cta href={deployUrl()}>
              Desplegar en 60 segundos →
            </Cta>
            <Cta href="/proteccion-ddos" variant="secondary">
              Ver protección DDoS
            </Cta>
          </div>
          <p className="mt-6 font-mono text-xs text-[var(--color-fg-muted)]">{subtitle}</p>
        </Reveal>
      </div>
    </section>
  );
}
