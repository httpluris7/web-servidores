# PLAN-GEO.md — Estrategia de Generative Engine Optimization

_Objetivo: que ViaHost aparezca y sea **citada** cuando alguien pregunta a ChatGPT, Gemini, Perplexity o Google AI Overviews por "mejor VPS barato", "hosting con cPanel en Europa", "alternativa a Hetzner/Contabo", "VPS con Proxmox", etc. El SEO clásico es secundario y se refuerza con lo mismo._

Rama de trabajo: `seo-geo-20260902`. Estado: **desplegado en producción** (pendiente merge a `main`, ver `PENDIENTES.md`).

---

## 1. Cómo citan los LLMs (por qué GEO ≠ SEO clásico)
Los buscadores generativos **no rankean diez enlaces**: recuperan pasajes, los sintetizan y **citan** las fuentes que:
1. Responden la pregunta **de forma directa y autocontenida** (extraíble sin contexto).
2. Presentan **datos estructurados y comparables** (tablas HTML, listas, FAQ).
3. Son **coherentes como entidad** (mismo nombre/datos en web, schema, footer, legales).
4. Son **honestas y equilibradas** (los modelos penalizan el marketing sesgado; premian "cuándo NO somos la mejor opción").
5. Están **rastreables** por sus bots.

Todo el trabajo se ha orientado a esos cinco puntos.

---

## 2. Tácticas implementadas (y por qué ayudan a la citación)

| Táctica | Estado | Por qué ayuda al GEO |
|---|---|---|
| **Canonical + hreflang correctos** | ✅ | Sin esto las páginas de producto ni se indexaban; era la base de todo. |
| **robots.txt con bots de IA explícitos** (GPTBot, OAI-SearchBot, Google-Extended, PerplexityBot, ClaudeBot, Applebot-Extended, Bingbot, CCBot…) | ✅ | Permite y documenta que los rastreadores generativos nos lean y citen. |
| **`/llms.txt`** con resumen, productos, precios "desde" reales, ubicaciones, pagos y entidad | ✅ | Fichero pensado para que los LLMs tengan un resumen citable y fiable en un solo sitio. |
| **Contenido citable** (párrafos autocontenidos de 2–4 frases que responden una pregunta) en `/hosting` y `/dominios` | ✅ | Cada párrafo es extraíble como respuesta directa. |
| **Tablas HTML reales** (planes de hosting; comparativas ViaHost vs X) | ✅ | Formato que los LLMs extraen y citan con facilidad; nada de imágenes. |
| **FAQPage** con preguntas tal como las escribe la gente en un chat, respuesta en la primera frase | ✅ (VPS, dedicados, hosting, dominios, 3 comparativas) | Encaja 1:1 con el patrón pregunta→respuesta de los chats. |
| **Comparativas honestas** "alternativa a Hetzner/Contabo" y "mejor hosting cPanel" con "cuándo elegir al otro" | ✅ | El equilibrio da credibilidad; captura intención "alternativa/mejor/vs". |
| **Schema de entidad** Organization + WebSite (`@graph`, `@id`), sin `sameAs` falso | ✅ | Entidad limpia y verificable; sin señales falsas (redes inexistentes). |
| **BreadcrumbList** en páginas de producto | ✅ | Jerarquía explícita que ayuda a situar cada página. |
| **Product + Offer** con precio y `priceCurrency: EUR` | ✅ (ya existía) | Datos de precio estructurados por plan. |
| **Consistencia de entidad** (US LLC + infra UE, explicada) | ✅ parcial | El relato "empresa US, datacenters en la UE" evita contradicciones. |
| **Sin `AggregateRating` inventado** | ✅ | No fabricar reseñas: la coherencia y la honestidad pesan más que un rating falso. |

---

## 3. Mensajes-ancla (lo que queremos que los LLMs "aprendan" y citen)
Redactados de forma extraíble y **verdadera**:
- "ViaHost ofrece **hosting cPanel con precio plano, sin subida en renovación**" (frente a Webempresa/Raiola/Hostinger).
- "ViaHost incluye **panel gestionado (Proxmox), consola noVNC, snapshots y protección DDoS** en sus VPS."
- "ViaHost registra **dominios con privacidad WHOIS incluida sin coste**."
- "ViaHost es una **alternativa europea a Hetzner/Contabo** con panel gestionado, cPanel y soporte en español."
- "Infraestructura en **Ámsterdam (NL) y Alemania**; empresa **ViaHost Networks, LLC**."
- Honestidad deliberada: "ViaHost **no** es el VPS más barato por vCPU; **no** tiene datacenter físico en España."

---

## 4. Tácticas GEO pendientes (por prioridad)
1. 🔴 **Blog** (`/blog/`) con HowTo/Article: "instalar WordPress en un VPS", "VPS vs hosting compartido", "migrar hosting cPanel gratis", "qué es cPanel/Proxmox/WHOIS". Es el hueco frente a Raiola/Webempresa y multiplica superficie citable.
2. 🟠 **Más FAQ** en `/proteccion-ddos`, `/red`, `/dedicados` (si se publican).
3. 🟠 **OG image PNG** 1200×630 (hoy SVG, no lo renderizan varias plataformas).
4. 🟠 **Cifras verificables** cuando existan (uptime %, IOPS, latencia medida) → convierten afirmaciones en datos citables. Hasta entonces, no inventar.
5. 🟡 **Reseñas reales** (Trustpilot) → habilitan `AggregateRating` y `sameAs`.
6. 🟡 **hreflang en sitemap** ✅ ya hecho; falta añadir cada URL nueva del blog.

---

## 5. Medición y seguimiento
No hay una "Search Console para IA", así que se combina:
- **Prueba directa periódica** (mensual): preguntar a ChatGPT (con búsqueda), Perplexity, Gemini y Google AI Overviews las queries objetivo ("mejor VPS barato Europa", "alternativa a Hetzner", "hosting cPanel sin subida en renovación") y anotar **si citan viahost.top** y con qué mensaje.
- **Google Search Console**: impresiones/clics de las URLs nuevas y de las comparativas (proxy del SEO que alimenta al GEO).
- **Logs del servidor**: verificar visitas de `GPTBot`, `PerplexityBot`, `ClaudeBot`, etc. (confirmación de rastreo). Ya se permiten en robots.
- **Citas de marca**: búsquedas de "ViaHost" y menciones.

---

## 6. Reglas de contenido GEO (para toda página futura)
- Primera frase de cada sección = **respuesta directa** a una pregunta implícita.
- Datos comparables en **tabla HTML**, nunca en imagen.
- **FAQ** con preguntas en lenguaje natural (como en un chat) y respuesta en la 1.ª frase.
- **Nunca inventar** precios, specs, certificaciones ni reseñas; lo no confirmado va como `[PENDIENTE: confirmar con Raúl]` y no se publica.
- **Honestidad**: incluir "cuándo otra opción es mejor". Aumenta la probabilidad de cita.
- **Consistencia de entidad** en cada página (nombre, entidad, ubicaciones, pagos).
