# PROMPT PARA CLAUDE CODE — Web de hosting estilo "infra premium"

> Pega todo lo que hay debajo de la línea en Claude Code, dentro de una carpeta vacía del proyecto.
> Antes de pegar: sustituye los valores entre `{{LLAVES}}` con los datos reales del cliente.

---

Usa el skill `modern-marketing-site` como base de diseño y construye desde cero una web de marketing para un proveedor de hosting llamado **{{NOMBRE_MARCA}}** (dominio: `{{DOMINIO}}`). La referencia estética y estructural es el estilo de webs de infraestructura premium tipo Vercel/Linear aplicado a hosting: fondo casi negro, tipografía enorme, datos técnicos como elemento visual, animaciones sobrias pero contundentes. NO copies textos, logos ni branding de ninguna web existente — todo el copy debe ser original.

## 1. Stack y estructura del proyecto

- Next.js 15 (App Router, TypeScript estricto, `src/` dir)
- Tailwind CSS v4
- Framer Motion para micro-interacciones y reveals; GSAP + ScrollTrigger solo para las secciones pinned y contadores
- shadcn/ui solo para primitivas (dropdown del mega-menú, accordion de FAQ)
- `next/image` para todas las imágenes, `next/font` con una sans geométrica (ej. Geist o Inter) + una mono (ej. JetBrains Mono) para datos técnicos
- Sin CMS: todo el contenido de productos/precios vive en `src/data/*.ts` tipado (ver sección 5)
- ESLint + Prettier configurados; el build (`next build`) debe terminar sin errores ni warnings de tipos

Estructura de rutas:

```
/                      → Home
/vps                   → listado planes VPS (por región)
/vps/[region]          → página por región (france, netherlands, germany, spain…)
/dedicados             → servidores dedicados
/dedicados/[tipo]      → 1gbps, 10gbps, storage…
/red                   → página de red/backbone (AS, peers, mapa)
/proteccion-ddos       → página del producto de mitigación DDoS
/casos-de-uso          → ancla o página propia
/sobre-nosotros
/legal/privacidad, /legal/terminos, /legal/cookies
```

Los botones de "Deploy/Contratar" enlazan al panel de facturación externo del cliente: `{{URL_PANEL_WHMCS_O_BILLING}}` (no construyas checkout propio; son enlaces salientes con UTM).

## 2. Sistema de diseño

- Fondo base: `#05070d` (definir como token `--bg-base`). Paleta monocroma: grises azulados + UN solo color de acento `{{COLOR_ACENTO}}` (ej. verde eléctrico o cian) usado con disciplina: CTAs, estados "online", datos en vivo.
- Tipografía display oversized en el hero: titulares en mayúsculas, tracking ajustado, hasta `clamp(3rem, 9vw, 8rem)`.
- La fuente mono se usa para: precios, métricas, IPs, specs de hardware, etiquetas tipo `AS{{NUMERO_AS}}`, y la terminal animada.
- Bordes sutiles `1px` con `white/8`, esquinas poco redondeadas (4–8px), nada de glassmorphism genérico.
- Numeración de secciones tipo `/01`, `/02` como elemento gráfico.
- Modo claro NO necesario: la web es dark-only.

## 3. Header y navegación

- Header sticky con blur al hacer scroll.
- Mega-menú "Productos" con dos columnas: **VPS** (lista de regiones con precio "desde €X" cada una) y **Dedicados** (1 Gbps, 10 Gbps, por país, storage). Los datos salen de `src/data/products.ts`.
- Enlaces directos: Red, Protección DDoS, Casos de uso, Soporte (externo a `{{URL_SOPORTE}}`).
- CTA principal "Desplegar servidor" siempre visible.
- En móvil: menú full-screen con las mismas secciones en accordion.

## 4. Home — secciones en orden (la página más importante, hazla completa)

1. **Hero**: badge superior tipo "kicker" en mono, titular gigante a 2–3 líneas con una palabra destacada en el color de acento, subtítulo de una frase, dos CTAs (primario "Desplegar en 60 segundos →", secundario "Ver precios"). Bajo el hero, una barra horizontal de métricas en vivo en fuente mono (tráfico de red, paquetes mitigados, servidores online, uptime) con números que hacen un sutil "tick" animado. Indicador "scroll" abajo.
2. **Stats de credibilidad**: 3 datos grandes con contador animado al entrar en viewport (peers de red, Gbps por servidor, Tbps de mitigación DDoS), cada uno con una línea de contexto debajo.
3. **Terminal de provisioning**: bloque estilo terminal con animación de typing secuencial (`allocating slot... ok`, `imaging ubuntu-24.04... ok`, `attaching uplink... ok`, `server online ... 54s`). Se dispara al entrar en viewport, una sola vez, con cursor parpadeante. Cierre con una frase tipo "Esto es lo que pasa 54 segundos después de pagar."
4. **Contadores de hardware**: sección scroll-pinned (GSAP) con tres métricas que suben de 0 al valor real mientras se hace scroll: GHz de CPU, GB/s de NVMe, Gbps de red. Cada una con una línea de copy con personalidad.
5. **Productos**: grid de 3 tarjetas (Cloud VPS, VPS región destacada, Bare Metal) con número `/01`, specs en lista con `▸`, precio "desde €X/mes" en mono grande, hover con borde de acento y flecha que se desplaza. Enlace "Ver todos los productos →".
6. **Red/backbone**: sección con el número de AS como etiqueta, titular potente, y un mapa estilizado de Europa (SVG propio, no librería de mapas) con puntos pulsantes en las ubicaciones `{{LISTA_UBICACIONES}}` conectados por líneas animadas. Al lado, 4 mini-stats en mono (peers, capacidad, ranking, puerto máximo).
7. **"Por qué nosotros"**: grid 3–4 columnas de features con icono o dato grande como protagonista (red, DDoS, hardware, deploy instantáneo, NVMe, presencia global, soporte 24/7). Sin iconografía genérica de stock: usa números y etiquetas mono como elemento visual.
8. **Casos de uso**: 4 tarjetas numeradas (Web apps, Bases de datos, Enterprise, SaaS) con 3 bullets cada una, enlazando a las páginas de producto relevantes.
9. **Protección DDoS**: sección oscura más intensa con un diagrama animado de flujo: tráfico de ataque (rojo) → escudo → tráfico limpio (acento) → "tu servidor, intacto". Hecho en SVG + Framer Motion, las partículas de ataque se desvían/desvanecen en el escudo. Debajo, 3 métricas mono (capacidad de mitigación, ataques absorbidos, paquetes filtrados que llegan: 0) y un grid de 6 features de seguridad cortas. CTA a `/proteccion-ddos`.
10. **Confianza**: stats (clientes, uptime SLA, ubicaciones, soporte) + marquee infinito de logos de hardware/partners (`{{LISTA_LOGOS}}` — usar texto estilizado si no hay SVGs de logos con licencia).
11. **CTA final**: sección dramática a pantalla casi completa, titular tipo "TU SLOT ESTÁ ESPERANDO." con CTA único y una línea de condiciones en mono ("provisioning en 60s · sin setup · cancela cuando quieras"). Debajo, marquee de relojes de ciudades europeas en tiempo real (hidratado en cliente para evitar mismatch de SSR).
12. **Footer**: 4 columnas (Productos, Ubicaciones, Recursos, Empresa), bloque legal con razón social `{{RAZON_SOCIAL}}`, `{{CIF_REGISTRO}}` y dirección `{{DIRECCION}}`, fila de métodos de pago `{{METODOS_PAGO}}`, y badges de reputación si existen (`{{TRUSTPILOT_URL}}`).

## 5. Datos y contenido

Crea `src/data/products.ts` con tipos:

```ts
type Region = { slug: string; name: string; flag: string; priceFrom: number; latencyNote?: string }
type Plan = { id: string; name: string; cpu: string; ram: string; storage: string; bandwidth: string; price: number; orderUrl: string; popular?: boolean }
type ProductLine = { slug: string; title: string; tagline: string; regions?: Region[]; plans: Plan[] }
```

Rellena con estos datos reales del cliente (si falta alguno, usa placeholders claramente marcados `TODO:` y lístalos al final):

- Regiones VPS y precio desde: `{{REGIONES_Y_PRECIOS}}`
- Planes dedicados: `{{PLANES_DEDICADOS}}`
- Métricas de red: AS `{{NUMERO_AS}}`, `{{N_PEERS}}` peers, `{{CAPACIDAD_TBPS}}`, mitigación `{{MITIGACION}}`
- Hardware: `{{CPUS}}` (ej. AMD EPYC / Ryzen 9), NVMe Gen4, uplinks `{{UPLINKS}}`

Las páginas `/vps/[region]` y `/dedicados/[tipo]` se generan estáticamente desde estos datos: hero corto, tabla/grid de planes con specs y botón de pedido, FAQ de 5–6 preguntas (accordion), y CTA final. Mismo layout reutilizable para todas.

## 6. Animaciones — reglas estrictas

- `prefers-reduced-motion`: todas las animaciones se desactivan o reducen a fades.
- GSAP solo en: contadores pinned y terminal. Framer Motion para todo lo demás (reveals con stagger, hovers).
- Nada de animaciones en loop que consuman CPU en reposo (excepto marquees con `transform` puro y el pulso de puntos del mapa, ambos en CSS).
- Los reveals se disparan una sola vez (`viewport={{ once: true }}`).
- 60fps: anima solo `transform` y `opacity`.

## 7. SEO, rendimiento y calidad

- Idioma principal: **español** (`lang="es"`); todo el copy en español salvo términos técnicos.
- Metadata API de Next por página: title/description únicos, OpenGraph con imagen OG generada (puede ser estática en `/public`), canonical, `robots` index/follow.
- JSON-LD: `Organization` en layout + `Product` con `offers` en páginas de planes.
- `sitemap.ts` y `robots.ts` generados por Next.
- Lighthouse objetivo: Performance ≥ 90 móvil, Accessibility ≥ 95. Contraste AA mínimo en todo el texto sobre fondo oscuro.
- Banner de cookies simple (solo si se añade analítica; prepara el hueco pero no metas analítica todavía).
- Página 404 personalizada con el mismo estilo (mono, "host not found").

## 8. Proceso de trabajo (sigue este orden y no te saltes pasos)

1. Lee el skill `modern-marketing-site` completo antes de escribir código.
2. Scaffolding del proyecto + tokens de diseño + fuentes + layout/header/footer.
3. Home completa, sección a sección, en el orden del punto 4. Después de cada 2–3 secciones, ejecuta `npm run build` y corrige errores antes de seguir.
4. Páginas de producto (VPS y dedicados) con el layout reutilizable.
5. Páginas de red, DDoS, sobre-nosotros y legales (las legales con placeholder estructurado, no lorem ipsum: indica qué debe rellenar el abogado).
6. Pasada final: responsive (375px, 768px, 1280px, 1920px), reduced-motion, build limpio, y un `README.md` con cómo arrancar, dónde editar precios (`src/data/`) y qué `TODO:` quedan pendientes.

Al terminar, dame un resumen con: rutas creadas, lista de `TODO:` pendientes de datos del cliente, y comandos para desarrollo y deploy (Vercel o VPS propio con `next build` + `next start` detrás de Nginx).
