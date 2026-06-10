import type { Metadata } from "next";
import { LegalLayout } from "@/components/legal/LegalLayout";

export const metadata: Metadata = {
  title: "Términos y condiciones",
  description: "Condiciones de uso y contratación de los servicios de NODARA.",
  alternates: { canonical: "/legal/terminos" },
  robots: { index: true, follow: true },
};

export default function TermsPage() {
  return (
    <LegalLayout
      index="/ Términos"
      title="Términos y condiciones"
      intro="Condiciones que regulan el uso y la contratación de los servicios de hosting, VPS, dedicados y mitigación DDoS."
      updated="TODO: fecha"
      sections={[
        { heading: "Objeto y aceptación", todo: "Descripción de los servicios y aceptación de los términos al contratar." },
        { heading: "Contratación y pago", todo: "Proceso de alta, métodos de pago, renovación, impuestos y política de reembolso." },
        { heading: "Uso aceptable", todo: "Conductas prohibidas (abuso, contenido ilícito, spam) y consecuencias del incumplimiento." },
        { heading: "Niveles de servicio (SLA)", todo: "Compromiso de disponibilidad, exclusiones y compensaciones por incumplimiento." },
        { heading: "Responsabilidad", todo: "Limitación de responsabilidad y exenciones aplicables." },
        { heading: "Suspensión y cancelación", todo: "Causas y procedimiento de suspensión o baja del servicio por ambas partes." },
        { heading: "Ley aplicable y jurisdicción", todo: "Legislación aplicable y fuero competente para la resolución de conflictos." },
      ]}
    />
  );
}
