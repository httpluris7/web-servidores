# CHANGELOG-SEO.md

Registro de cambios SEO/GEO. Rama `seo-geo-20260902` (desde `main` en `eccafc2`). Todos verificados en vivo y desplegados. **Ninguna URL pública cambió → no hacen falta redirecciones 301.** El flujo de compra y Stripe no se han tocado.

---

### `30cbedb` — Canonical + hreflang por página (🔴 crítico)
- **Antes:** todas las páginas emitían `canonical` a la home del idioma (`/es/vps` → `https://viahost.top/es`). Producto no indexable.
- **Después:** cada página emite su canonical self-referencing + hreflang `en/es/fr/x-default`. Helper `src/lib/seo.ts::alternatesFor`. Se retiró el `alternates` del layout.
- **Verificado:** `/vps`→`/vps`, `/es/hosting`→`/es/hosting`, `/es/vps/holanda`→`/es/vps/holanda`, home→raíz.

### `c6f1364` — `SEO-AUDIT.md` (FASE 1)
- Auditoría priorizada de 18 páginas indexables.

### `078de3c` — Sitemap + robots + `/llms.txt` (🔴/🟠)
- **Sitemap:** antes 15 URLs sin `/hosting` ni `/dominios` y solo en inglés. Ahora incluye ambas + `xhtml:link` hreflang por idioma en cada URL; prioridad 0.9 en páginas de dinero.
- **robots.txt:** antes `User-Agent: * / Allow: /`. Ahora permite explícitamente GPTBot, OAI-SearchBot, ChatGPT-User, Google-Extended, PerplexityBot, ClaudeBot, Bingbot, Applebot-Extended, Amazonbot, CCBot; y bloquea privadas (`/admin`, `/cuenta`, `/carrito`, `/api/`…).
- **`/llms.txt` (nuevo):** route handler dinámico con resumen citable — productos con precio "desde" real del catálogo (VPS 8 €/mes, hosting 2,95 €/mes), ubicaciones (Amsterdam/Frankfurt), pagos (tarjeta+SEPA), entidad. Sin datos inventados.

### `0766c23` — Organization sin `sameAs` falso + WebSite (🔴 GEO)
- **Antes:** `Organization` con `sameAs` a redes sociales inexistentes (señal de entidad falsa).
- **Después:** `@graph` con `Organization` (con `logo`, `areaServed`, `contactPoint`, sin `sameAs`) + nodo `WebSite` enlazado por `@id`. Sin `SearchAction` (no hay buscador general del sitio).

### `f5d6dc9` — BreadcrumbList (🟠)
- Nuevo `breadcrumbJsonLd(locale, trail)` + componente `<JsonLd>`. Aplicado a `/vps`, `/vps/[region]`, `/hosting`, `/dominios`, `/dedicados/[tipo]` con rutas localizadas (Inicio → familia → hoja).

### `8925de7` — FAQPage (🟠 alto valor GEO)
- `FaqSection` ahora emite `FAQPage` con las preguntas/respuestas ya traducidas (mismo contenido visible). Ilumina `/vps`, `/vps/[region]`, `/dedicados/[tipo]`.

---

## Pendiente (no incluido en este bloque)
- OG image en PNG 1200×630 (hoy SVG).
- FAQ + enriquecimiento de contenido en `/hosting` y `/dominios` (thin) → FASE 5.
- Reescritura de meta descriptions/títulos cortos (`/dominios`, `/red`, `/desplegar`).
- Medición real de Core Web Vitals.
- Confirmaciones de negocio en `PENDIENTES.md`.
