import type { Metadata } from "next";
import { LegalLayout } from "@/components/legal/LegalLayout";

export const metadata: Metadata = {
  title: "Política de privacidad",
  description:
    "Cómo ViaHost trata los datos personales conforme al RGPD para clientes del EEE y a la normativa de protección de datos aplicable.",
  alternates: { canonical: "/legal/privacidad" },
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return (
    <LegalLayout
      index="/ Privacidad"
      title="Política de privacidad"
      intro="Cómo recogemos, tratamos y protegemos tus datos personales. ViaHost Infrastructure LLC actúa como responsable; a los clientes del Espacio Económico Europeo les aplica el RGPD (UE 2016/679)."
      updated="TODO: fecha"
      sections={[
        { heading: "Responsable del tratamiento", todo: "Identidad y datos de contacto del responsable: razón social de la LLC, EIN/registro, dirección registrada, y representante en la UE / DPO si aplica (art. 27 RGPD para empresas fuera de la UE)." },
        { heading: "Datos que recogemos", todo: "Categorías de datos: cuenta, facturación, logs técnicos, cookies. Detallar cada finalidad." },
        { heading: "Finalidad y base legal", todo: "Finalidades del tratamiento y base jurídica (ejecución de contrato, consentimiento, interés legítimo)." },
        { heading: "Conservación de datos", todo: "Plazos de conservación por categoría y criterios aplicados." },
        { heading: "Destinatarios y encargados", todo: "Terceros con acceso (proveedores de pago, infraestructura) y transferencias internacionales si las hay." },
        { heading: "Derechos del usuario", todo: "Acceso, rectificación, supresión, oposición, portabilidad y limitación; cómo ejercerlos y reclamar ante la autoridad de control competente (los clientes del EEE, ante su autoridad de protección de datos)." },
        { heading: "Seguridad", todo: "Medidas técnicas y organizativas aplicadas para proteger los datos." },
      ]}
    />
  );
}
