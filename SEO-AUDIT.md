# SEO-AUDIT.md — Auditoría SEO on-site de ViaHost

_Auditoría técnica realizada sobre viahost.top (Next.js 15 App Router + next-intl). Fecha: 2026-09-02. Rama: `seo-geo-20260902`._

Metodología: inspección del código (plantillas, metadata, JSON-LD, robots/sitemap) + verificación en vivo del HTML renderizado de las 18 páginas indexables (versión `/es`, el mercado objetivo).

## 0. Resumen ejecutivo — orden de ataque

| Prioridad | Hallazgo | Severidad | Estado |
|---|---|---|---|
| 1 | **Canonical apuntaba todas las páginas a la home** → producto no indexable | 🔴 Crítico | ✅ **RESUELTO** (commit `30cbedb`) |
| 2 | Sitemap **sin `/hosting` ni `/dominios`** y sin variantes por idioma | 🔴 Crítico | Pendiente |
| 3 | **`/dominios` con 124 palabras** (thin) — es página de dinero | 🔴 Crítico | Pendiente |
| 4 | **Consistencia de entidad** rota (US LLC vs "European", `sameAs` falso) | 🔴 Crítico (GEO) | Pendiente |
| 5 | robots.txt **sin reglas para bots de IA** + **no hay `llms.txt`** | 🟠 Medio (GEO) | Pendiente (FASE 4) |
| 6 | Faltan schemas **WebSite/SearchAction, BreadcrumbList, FAQPage** | 🟠 Medio | Pendiente |
| 7 | Contenido **thin generalizado** (mayoría 120–360 palabras) | 🟠 Medio | Pendiente |
| 8 | **OG image en SVG** (no renderiza en muchas plataformas ni LLMs) | 🟠 Medio | Pendiente |
| 9 | Meta descriptions cortas en páginas clave; título `/red` de 13 car. | 🟡 Bajo | Pendiente |

---

## 1. Indexabilidad, canonical, hreflang, sitemap, robots

### 1.1 Canonical — 🔴 Crítico — ✅ RESUELTO
**Antes:** el `layout.tsx` fijaba `alternates.canonical` a la home del idioma y ninguna página lo sobreescribía, así que **toda la web canonicalizaba a la portada**. Verificado en vivo antes del fix:
`/es/vps`, `/es/hosting`, `/es/dominios` → `canonical = https://viahost.top/es`.
**Impacto:** Google y los buscadores de IA interpretaban cada página de producto como duplicado de la home ⇒ no se indexaban. Es el motivo de fondo por el que la web no podía posicionar.
**Fix aplicado:** helper `src/lib/seo.ts` → `alternatesFor(locale, path)` con canonical self-referencing + hreflang (`en`/`es`/`fr`/`x-default`); se retiró el `alternates` del layout y cada página declara su ruta. Verificado: `/es/vps` → `canonical https://viahost.top/es/vps` + set hreflang completo.

### 1.2 Sitemap — 🔴 Crítico
`src/app/sitemap.ts` genera 15 URLs pero:
- **Faltan `/hosting` y `/dominios`** (dos páginas de dinero). Confirmado en `/sitemap.xml`.
- Solo incluye URLs del idioma por defecto (inglés en raíz). **No declara las variantes `/es` y `/fr`** ni `xhtml:link` hreflang. Para el mercado España es un problema: el sitemap no señala las URLs españolas.
- Incluye `/vps/germany`: confirmar que Alemania está operativa (ver PENDIENTES).
- `changeFrequency`/`priority` genéricos (poco relevante).
**Fix:** añadir hosting/dominios; generar entradas por idioma con `alternates.languages` (hreflang en sitemap); `lastModified` real.

### 1.3 robots.txt — 🟠 Medio (bloque GEO en FASE 4)
`User-Agent: * / Allow: /`. No bloquea nada (las privadas ya son `noindex`), pero:
- **No lista explícitamente los bots de IA** (GPTBot, OAI-SearchBot, ChatGPT-User, Google-Extended, PerplexityBot, ClaudeBot, Applebot-Extended, Bingbot). Recomendado para GEO.
- **No existe `/llms.txt`.**
- No hay `Disallow` de las privadas (`/cuenta`, `/admin`, `/carrito`, `/acceder`…): conviene añadirlo por higiene de crawl-budget aunque sean `noindex`.

### 1.4 hreflang — ✅ Correcto (tras 1.1)
Cada página emite `en`/`es`/`fr`/`x-default` apuntando a su propia ruta. Falta replicarlo en el **sitemap** (1.2).

---

## 2. Títulos y meta descriptions

Todos los `<title>` son **únicos** y usan la plantilla `%s · ViaHost` (bien). Descripciones únicas por página. Problemas:

| Página | Título (car.) | Desc (car.) | Nota |
|---|---|---|---|
| `/es/red` | **13** | 98 | 🟡 Título demasiado corto y sin keyword ("Red"). Debe ser "Red y peering — 10 Gbps… · ViaHost" |
| `/es/dominios` | 33 | **61** | 🟠 Descripción muy corta para una página de dinero (objetivo 140–160) |
| `/es/legal/terminos` | 32 | 62 | 🟡 Legal, baja prioridad |
| `/es/desplegar` | 28 | 70 | 🟡 Descripción corta |
| `/es/sobre-nosotros`, `/es/casos-de-uso` | — | 166 / 162 | 🟡 Ligeramente >160 (posible truncado) |

**Acción:** reescribir descripciones de `/dominios`, `/desplegar`, `/red` con keyword + CTA (140–160 car.); recortar las de 166.

---

## 3. Jerarquía de encabezados — ✅ Correcto
**Exactamente 1 `<h1>` por página** en las 18 verificadas. Estructura H2 razonable (home 14, producto 4–9). El H1 es descriptivo. Sin hallazgos.

---

## 4. Datos estructurados (JSON-LD)

| Schema | Estado | Nota |
|---|---|---|
| Organization | ⚠️ Presente pero con fallos | `sameAs` apunta a **redes sociales inexistentes** (placeholder) → señal de entidad falsa. Falta `logo`, `contactPoint`, `areaServed`. Dirección US. |
| Product + Offer | ✅ Presente | En `/vps`, `/vps/[region]`, `/hosting`, `/dedicados/[tipo]` con `price` + `priceCurrency: EUR` + `availability`. Mejorable: `brand`, `sku`, `aggregateOffer`, specs como `additionalProperty`. |
| WebSite + SearchAction | ❌ Ausente | 🟠 Recomendado (entidad + potencial sitelinks searchbox). |
| BreadcrumbList | ❌ Ausente | 🟠 No hay breadcrumbs visibles ni schema. Ayuda a jerarquía y a LLMs. |
| FAQPage | ❌ Ausente | 🟠 **Gran oportunidad GEO**: hay FAQs visuales en dedicados pero sin `FAQPage`. |
| AggregateRating | ❌ Ausente | ✅ Correcto NO ponerlo: no hay reseñas reales (no inventar). |
| HowTo | ❌ Ausente | Oportunidad para tutoriales del blog (FASE 5). |

**Acción:** quitar `sameAs` falso; añadir WebSite, BreadcrumbList y FAQPage; enriquecer Product/Offer.

---

## 5. Contenido thin (< 300 palabras útiles)

Recuento de palabras visibles (`/es`):

| Página | Palabras | Severidad |
|---|---|---|
| `/es/dominios` | **124** | 🔴 Crítico (página de dinero) |
| `/es/contacto` | 151 | 🟡 (aceptable para contacto) |
| `/es/desplegar` | 177 | 🟠 |
| `/es/estado` | 188 | 🟡 |
| `/es/casos-de-uso` | 211 | 🟠 |
| `/es/red` | 224 | 🟠 |
| `/es/proteccion-ddos` | 239 | 🟠 |
| `/es/sobre-nosotros` | 254 | 🟠 |
| `/es/soporte` | 260 | 🟡 |
| `/es/hosting` | 328 | 🟠 (producto: debería 500+ con tabla+FAQ) |
| `/es/vps/holanda` | 336 | 🟠 |
| `/es/vps` | 359 | 🟠 |
| `/es` (home) | 807 | ✅ |

**Diagnóstico:** contenido thin **generalizado**. Para SEO y sobre todo GEO (citabilidad), las páginas de producto necesitan: párrafos autocontenidos que respondan preguntas concretas, **tabla HTML de specs/precios**, y **bloque FAQ**. `/dominios` es la más urgente.

---

## 6. Imágenes y multimedia
- **0 imágenes raster** en todas las páginas (diseño basado en SVG inline + CSS). No hay problemas de `alt` (no hay `<img>`), pero tampoco imágenes que ayuden a rich results / Google Imágenes.
- 🟠 **OG image en SVG** (`/og.svg`): muchas plataformas sociales y crawlers de IA **no renderizan SVG** como preview. Debe ser **PNG/JPG 1200×630**.
- `favicon.svg`: correcto (los navegadores modernos lo soportan; conviene fallback `.ico`).

---

## 7. URLs
- **Legibles y con keyword** en su mayoría (`/vps`, `/vps/holanda`, `/hosting`, `/dominios`, `/dedicados/<slug>`). ✅
- 🟡 **Inconsistencia idioma/slug:** en la raíz (inglés) las rutas informacionales están en español (`/desplegar`, `/red`, `/proteccion-ddos`, `/casos-de-uso`, `/sobre-nosotros`, `/contacto`). No es crítico y cambiarlas exigiría 301 masivos; se documenta como observación. Para el target España **es incluso favorable** en `/es`.
- Sin parámetros basura ni duplicados por querystring detectados.

---

## 8. Enlazado interno
- **Profundidad de clic baja** (todo a 1–2 clics de la home): menú mega + banners + footer. ✅
- Hosting y dominios ahora enlazados desde **menú, banner home y footer**. ✅
- 🟠 **`/dedicados` responde 404** (las categorías de dedicados están ocultas). El nav lo oculta, así que no hay enlace roto visible, pero: (a) confirmar si se venden dedicados; (b) si no, retirar del sitemap/JSON-LD; si sí, publicarlos.
- No se detectan páginas huérfanas indexables.

---

## 9. Core Web Vitals (evaluación estática — requiere medición real)
No se ha corrido Lighthouse/PSI (entorno sin navegador). Evaluación por código:
- **Fuentes:** Geist vía `next/font` (self-host, sin FOUT/render-block). ✅
- **JS:** `framer-motion` + `gsap` en varias secciones de la home y del panel. 🟠 Riesgo de peso/INP en móvil; conviene medir y, si procede, cargar animaciones bajo `IntersectionObserver`/lazy.
- **LCP:** contenido mayormente texto+SVG, sin imágenes pesadas → probablemente bueno; el hero con animación es el candidato a vigilar.
- **CLS:** sin imágenes sin dimensiones; el `CURRENCY_INIT_SCRIPT` fija divisa antes del pintado (evita saltos de precio). ✅
**Acción:** medir con PageSpeed Insights (campo real) las plantillas clave: home, `/es/vps`, `/es/hosting`.

---

## 10. Accesibilidad y HTML semántico (afecta al parsing de LLMs)
- ✅ `skip link` a `#contenido`, `<main id="contenido">`, 1 `<h1>` por página, `lang` correcto por locale.
- ✅ Estructura semántica (`<header>`, `<footer>`, `<section>`, `<nav aria-label>`).
- 🟡 Revisar contraste del texto `--color-fg-dim` sobre fondo oscuro y `aria-label` en inputs de los formularios (checkout, contacto). Bajo impacto.

---

## 11. Consistencia de entidad (crítico para GEO) — 🔴
- La `description` global dice *"European infrastructure"* pero la entidad legal es **US (ViaHost Networks, LLC, Wyoming/Orlando FL)**. Es coherente (empresa US con datacenters en la UE) **si el relato lo explica**; hoy no se explica en ninguna página.
- `sameAs` (schema) → redes **inexistentes**. 🔴 Retirar.
- Footer lista `PayPal, Crypto` como métodos de pago marcados `TODO` (sin confirmar). Pagos **reales y activos**: **tarjeta (Stripe, verificado `enabled=true`) + transferencia/SEPA**.
- Ubicaciones públicas reales: **Ámsterdam (NL) + Alemania**; Francia está **oculta**. El brief mencionaba "Londres" (**no existe**).
**Acción:** unificar nombre/entidad/ubicaciones/pagos idénticos en web, schema, footer y legales; una frase que explique "empresa US, infraestructura en la UE".

---

## 12. Plan de acción priorizado (entra en FASES 4–5)

1. 🔴 **Sitemap**: añadir `/hosting`, `/dominios`, entradas por idioma + hreflang. _(Rápido)_
2. 🔴 **`/dominios`** y páginas de producto: enriquecer con párrafos citables + **tabla de precios/specs** + **FAQ** (resuelve thin + GEO). 
3. 🔴 **Entidad**: quitar `sameAs` falso, cuadrar pagos/ubicaciones, frase US↔UE.
4. 🟠 **Schema**: WebSite/SearchAction + BreadcrumbList (con breadcrumbs visibles) + FAQPage.
5. 🟠 **robots + `llms.txt`** con bots de IA (FASE 4).
6. 🟠 **OG image** PNG 1200×630.
7. 🟡 Descripciones/títulos cortos (`/dominios`, `/red`, `/desplegar`).
8. 🟡 Medir CWV reales; decidir dedicados (publicar o retirar).

> Nada de lo anterior toca el flujo de compra ni Stripe. Los cambios de contenido y schema son aditivos; el único cambio ya aplicado (canonical) está verificado y desplegado.
