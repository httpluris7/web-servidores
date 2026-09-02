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

### `5befd9e` — Contenido `/hosting` y `/dominios` (FASE 5, 🔴 thin)
- `FaqSection` acepta ahora un `namespace` (antes fijo a `products`).
- `/hosting`: intro citable + **tabla HTML** de planes (componente `HostingPlansTable`, desde catálogo) + FAQ (6) → FAQPage. **328→510 palabras**.
- `/dominios`: intro citable + FAQ (5) → FAQPage. **124→333 palabras** (sale de thin).
- i18n es/en/fr. Solo datos verificables.

### `4600e68` — Comparativa `alternativa-hetzner`
- Página nueva con tabla comparativa, "cuándo elegir cada uno", FAQ→FAQPage, Breadcrumb, canonical/hreflang. En sitemap y enlazada desde `/vps`.

### `6b3a3a7` — Comparativas `alternativa-contabo` y `mejor-hosting-cpanel` + plantilla
- Componente reutilizable `ComparativaHeadToHead` (claves i18n genéricas). Hetzner migrado a él.
- Dos comparativas nuevas (Contabo head-to-head; mejor-hosting-cPanel como guía honesta ViaHost vs sector). En sitemap; enlaces internos `/vps`→hetzner,contabo y `/hosting`→mejor-hosting.

### `d64a03f` — Métodos de pago + confirmaciones de negocio
- `site.ts`: fuera PayPal/Crypto (activos: transferencia/SEPA + tarjeta Stripe). Alemania confirmada operativa; dedicados no se venden (ya oculto). `PENDIENTES.md` A1/A2/A6 resueltos.

### `c8bf60a` — Blog `/blog/` (FASE 5)
- Modelo `src/data/blog.ts` (contenido trilingüe por post). `/blog` (índice) + `/blog/[slug]` con **Article** o **HowTo** + **FAQPage** + **BreadcrumbList** + canonical/hreflang. Semilla: "VPS vs hosting compartido" (Article) y "Cómo migrar tu hosting cPanel gratis" (HowTo). En sitemap y footer.

---

### `c8bf60a`→`b860483` — Blog completo (8 artículos)
- 8 posts trilingües con Article/HowTo + FAQPage + Breadcrumb cubriendo VPS, hosting, dominios y DDoS.

### OG image PNG (🟠 resuelto)
- `[locale]/opengraph-image.tsx`: genera el `og:image` como **PNG 1200×630** (marca + titular + diferenciadores + dominio), sustituyendo al `/og.svg` que muchas plataformas/LLMs no renderizaban. Se retiran las referencias al SVG del layout.

### Títulos y descripciones cortos (🟡 resuelto)
- `/red`: metaTitle 13→42 car. con keyword ("Red y peering: 10 Gbps en Europa").
- `/dominios` (61→143) y `/desplegar` (70→156): descripciones reescritas con keyword + CTA; `/desplegar` ya no promete "servidor dedicado" (no se vende).
- `/sobre-nosotros` y `/casos-de-uso`: descripciones de 166→≤160 car. i18n es/en/fr.

---

### Frase de entidad + nombres de región (GEO/pulido)
- `/sobre-nosotros`: párrafo de entidad "empresa US + infraestructura en la UE" (es/en/fr); retirado el aviso "datos provisionales".
- Nombres de región localizados por idioma (`catalogo.json`, dato del servidor): es "Países Bajos/Ámsterdam", "Alemania"; fr "Pays-Bas", "Allemagne".

---

## Pendiente (ver `PENDIENTES.md` y `PLAN-GEO.md §4`)
- Más artículos de blog según nuevas keywords (opcional).
- Reescritura de meta descriptions/títulos cortos (`/dominios`, `/red`, `/desplegar`).
- Localizar nombres de región del catálogo ("Netherlands" → "Países Bajos").
- Medición real de Core Web Vitals.
- **Confirmaciones de negocio** (Alemania operativa, PayPal/Crypto, reseñas, dedicados…) en `PENDIENTES.md`.
- **Merge de `seo-geo-20260902` a `main` + push** (ya desplegado en producción; falta consolidar en git).
