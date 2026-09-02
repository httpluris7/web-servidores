# KEYWORD-MAP.md — Mapa de palabras clave (mercado España)

_Fecha: 2026-09-02. Mercado objetivo: España (`/es`). No se incluyen volúmenes de búsqueda (no dispongo de datos reales verificables; se prioriza por **intención** y **oportunidad competitiva** — ver `COMPETENCIA.md`). Validar volúmenes con Search Console / Ahrefs / Keyword Planner antes de escalar._

Leyenda intención: **T** transaccional · **C** comparativa/decisión · **I** informacional.
Prioridad: 🔴 alta · 🟠 media · 🟡 baja.

---

## A. Clusters transaccionales → URLs EXISTENTES (optimizar, no crear)

| Cluster | Int. | Keyword principal | Secundarias | URL | Prioridad |
|---|---|---|---|---|---|
| VPS genérico | T | **comprar VPS** | vps barato, vps nvme, vps kvm, contratar servidor virtual, vps con panel | `/vps` | 🔴 |
| VPS por atributo | T/C | **VPS con Proxmox** | vps proxmox, vps con consola noVNC, vps con snapshots, vps ddos incluido, vps sin permanencia | `/vps` | 🔴 |
| VPS geolocalizado | T | **VPS en Holanda / Ámsterdam** | vps amsterdam, vps holanda nvme, vps europa baja latencia | `/vps/holanda` | 🟠 |
| VPS geolocalizado | T | **VPS en Alemania** | vps alemania, vps frankfurt | `/vps/germany` | 🟠 |
| Hosting cPanel | T | **hosting cPanel** | alojamiento web cpanel, hosting web barato, hosting nvme, hosting con ssl gratis, hosting softaculous | `/hosting` | 🔴 |
| Hosting WordPress | T | **hosting WordPress cPanel** | hosting para wordpress, hosting wordpress rápido nvme | `/hosting` | 🟠 |
| Dominios privacidad | T | **registrar dominio con privacidad** | dominio privacidad whois gratis, comprar dominio anónimo, registrar dominio .com/.es | `/dominios` | 🔴 |
| DDoS | T/I | **protección DDoS servidor** | mitigación ddos incluida, vps anti ddos | `/proteccion-ddos` | 🟡 |
| Red/backbone | I/T | **red 10 Gbps datacenter** | peering ams-ix, ancho de banda vps | `/red` | 🟡 |
| Dedicados (si se publican) | T | **servidor dedicado alquiler** | bare metal europa, servidor dedicado nvme | `/dedicados/<slug>` | 🟡 |

**Acciones on-page (FASE 5):** enriquecer `/hosting` y `/dominios` (thin), reforzar keyword en H1/title/description, tabla de specs+precios, FAQ (activa FAQPage). `/vps` ya tiene FAQPage.

---

## B. Comparativas y "alternativa a X" → PÁGINAS NUEVAS (sección `/comparativas/`)

Oportunidad #1 del mercado (ver COMPETENCIA): comparativas honestas y actualizadas post-subidas 2026.

| Cluster | Int. | Keyword principal | Secundarias | URL nueva | Prioridad |
|---|---|---|---|---|---|
| Alternativa Hetzner | C | **alternativa a Hetzner** | hetzner subida precios 2026 alternativa, hetzner alternativa española, vps como hetzner con soporte | `/comparativas/alternativa-hetzner` | 🔴 |
| Alternativa Contabo | C | **alternativa a Contabo** | contabo alternativa con panel, vps como contabo mejor soporte | `/comparativas/alternativa-contabo` | 🔴 |
| Mejor VPS Holanda | C | **mejor VPS en Holanda** | mejor vps amsterdam, vps holanda nvme comparativa | `/comparativas/mejor-vps-holanda` | 🟠 |
| Mejor hosting cPanel | C | **mejor hosting cPanel España** | hosting cpanel sin subida en renovación, hosting cpanel precio fijo | `/comparativas/mejor-hosting-cpanel` | 🔴 |
| Sin trampa renovación | C | **hosting sin subida en renovación** | hosting precio plano, hosting sin letra pequeña | `/comparativas/hosting-precio-fijo` | 🟠 |

**Regla anti-canibalización:** las comparativas atacan intención "**alternativa/mejor/vs**"; `/vps` y `/hosting` atacan "**comprar/contratar**". Los `<title>` deben respetar esa frontera (nunca "comprar VPS" en una comparativa).

---

## C. Long-tail transaccional/decisión → landing o caso de uso

| Keyword | Int. | URL destino | Nota |
|---|---|---|---|
| mejor VPS barato España 2026 | C | `/comparativas/mejor-vps-holanda` (o landing propia) | encaja con comparativa Europa; evitar prometer "España DC" |
| VPS para WordPress | C/T | `/casos-de-uso` (ancla) o blog → CTA `/hosting`/`/vps` | decidir: hosting cPanel para WP simple, VPS para WP a medida |
| VPS vs hosting compartido | C/I | `/blog/vps-vs-hosting-compartido` | informacional-decisión, funnel a ambos |
| dominio + hosting juntos | T | `/hosting` (upsell dominio) | cross-sell del ecosistema |

---

## D. Informacionales → BLOG NUEVO (`/blog/`)

No existe blog (hueco vs Raiola/Webempresa). Cada artículo funnelea a producto y activa **HowTo/FAQ** schema.

| Artículo | Int. | Keyword principal | Schema | CTA a | Prio |
|---|---|---|---|---|---|
| Cómo instalar WordPress en un VPS | I | instalar wordpress en vps | HowTo | `/vps`,`/hosting` | 🔴 |
| VPS vs hosting compartido: cuál elegir | I/C | vps vs hosting compartido | Article | `/vps`,`/hosting` | 🔴 |
| Qué es cPanel y para qué sirve | I | qué es cpanel | Article/FAQ | `/hosting` | 🟠 |
| Cómo apuntar un dominio a un servidor (registro A) | I | apuntar dominio a ip, configurar registro A | HowTo | `/dominios`,`/hosting` | 🟠 |
| Qué es la privacidad WHOIS y por qué importa | I | privacidad whois qué es | Article | `/dominios` | 🟠 |
| Qué es Proxmox / KVM en un VPS | I | qué es proxmox vps | Article | `/vps` | 🟡 |
| Cómo migrar tu hosting cPanel gratis | I/T | migrar hosting cpanel gratis | HowTo | `/hosting` | 🔴 |
| Qué es la protección DDoS | I | qué es protección ddos | Article | `/proteccion-ddos` | 🟡 |

---

## E. Canibalizaciones a resolver

1. **`/desplegar` vs `/vps`** — `/desplegar` es el **selector de producto** (intención navegacional/marca "desplegar servidor"), NO debe competir por "VPS"/"comprar VPS". Mantener su title sin la keyword de `/vps`. ✅ ya es así.
2. **`/vps` vs `/vps/[region]`** — separar por geo: `/vps` = head "VPS/comprar VPS"; región = "VPS en Holanda/Alemania". Distintos title/H1.
3. **Comparativas vs producto** — frontera "alternativa/mejor/vs" (comparativas) vs "comprar/contratar" (`/vps`,`/hosting`). Ver regla en bloque B.
4. **`/hosting` vs blog "qué es cPanel"** — transaccional vs informacional; enlazar el blog → `/hosting`, no duplicar intención.
5. **`/dominios` vs blog "privacidad WHOIS"** — igual: el artículo informa y enlaza a la transaccional.

---

## F. Prioridad de ejecución (FASE 5)
1. 🔴 Enriquecer `/hosting` y `/dominios` (thin + tabla + FAQ) — impacto inmediato + GEO.
2. 🔴 Comparativas `alternativa-hetzner`, `alternativa-contabo`, `mejor-hosting-cpanel` — hueco caliente 2026.
3. 🔴 Blog semilla: "instalar WordPress en VPS", "VPS vs hosting", "migrar hosting cPanel gratis".
4. 🟠 Resto de comparativas + blog informacional.
5. 🟡 Dedicados: decidir publicar (hoy `/dedicados` da 404) antes de invertir keywords.

> Todas las URLs nuevas se añadirán al `sitemap.ts` (ya soporta hreflang) y llevarán `alternatesFor` + breadcrumb + FAQ/HowTo schema. Sin tocar el flujo de compra.
