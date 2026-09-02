import { jsonLdScript } from "@/lib/utils";

/**
 * Emite un bloque `<script type="application/ld+json">` con datos ya seguros
 * (`jsonLdScript` escapa el contenido). Server component reutilizable para
 * cualquier schema (BreadcrumbList, FAQPage, etc.).
 */
export function JsonLd({ data }: { data: unknown }) {
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(data) }} />
  );
}
