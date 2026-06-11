import type { Metadata } from "next";
import { LegalLayout } from "@/components/legal/LegalLayout";

export const metadata: Metadata = {
  title: "Política de cookies",
  description: "Qué cookies utiliza ViaHost y cómo gestionarlas.",
  alternates: { canonical: "/legal/cookies" },
  robots: { index: true, follow: true },
};

export default function CookiesPage() {
  return (
    <LegalLayout
      index="/ Cookies"
      title="Política de cookies"
      intro="Información sobre las cookies y tecnologías similares que utiliza este sitio web y cómo puedes gestionarlas."
      updated="TODO: fecha"
      sections={[
        { heading: "Qué son las cookies", todo: "Definición y explicación general de las cookies y su finalidad." },
        { heading: "Cookies que utilizamos", todo: "Tabla con cada cookie: nombre, tipo (técnica, analítica, etc.), finalidad, duración y proveedor. Actualmente el sitio NO carga analítica; rellenar cuando se añada." },
        { heading: "Base legal y consentimiento", todo: "Cómo se obtiene el consentimiento para cookies no esenciales (banner) y cómo revocarlo." },
        { heading: "Gestión de cookies", todo: "Instrucciones para configurar o eliminar cookies en los principales navegadores." },
        { heading: "Cambios en la política", todo: "Cómo se comunicarán futuras actualizaciones de esta política." },
      ]}
    />
  );
}
