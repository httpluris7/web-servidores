# ViaHost — Web de hosting (infra premium)

Web de marketing para un proveedor de hosting (VPS, dedicados y mitigación DDoS),
construida con Next.js 15 (App Router) + Tailwind v4. Estética dark-only tipo
infraestructura premium: fondo casi negro, tipografía oversized, datos técnicos en
mono y un único acento verde eléctrico (`#00E5A0`).

> **ViaHost** es una marca **inventada** y coherente, usada como placeholder. Todo el
> contenido es original. Renómbrala en un único punto (ver abajo).

---

## Arranque rápido

```bash
npm install      # instala dependencias
npm run dev      # desarrollo en http://localhost:3000
npm run build    # build de producción (debe terminar sin errores ni warnings)
npm run start    # sirve el build de producción
npm run lint     # ESLint
npm run format   # Prettier
```

Requisitos: Node 18.18+ (probado en Node 24).

---

## Dónde editar el contenido

Todo el contenido vive tipado en `src/data/` (sin CMS):

| Archivo | Qué contiene |
| --- | --- |
| **`src/data/site.ts`** | **Fuente única de marca**: nombre, dominio, color de acento, enlaces al panel/soporte, datos legales, red, DDoS y métodos de pago. **Renombra la marca aquí.** |
| `src/data/products.ts` | **Precios y planes**: regiones VPS, planes VPS y servidores dedicados (1 Gbps, 10 Gbps, storage). Edita aquí para cambiar specs/precios. |
| `src/data/content.ts` | Copy de la Home: features, casos de uso, líneas de la terminal, partners, ciudades del reloj. |
| `src/data/faq.ts` | Preguntas frecuentes de VPS y dedicados. |

**Cambiar el precio de un plan:** edita el campo `price` (en €/mes) del plan en
`src/data/products.ts`. El precio "desde €X" del mega-menú, las tarjetas y el sitemap
se recalculan solos.

**Cambiar la marca:** edita `site.brand`, `site.domain` y `site.url` en
`src/data/site.ts`. Aparece en header, footer, metadata, JSON-LD y favicon.

**Cambiar el color de acento:** `--color-accent` en `src/app/globals.css` (y
`site.accent` para referencias en JS).

---

## Estructura de rutas

```
/                       Home (11 secciones)
/vps                    Listado de planes VPS + regiones
/vps/[region]           Página por región (francia, paises-bajos, alemania, espana, reino-unido, polonia)
/dedicados              Servidores dedicados
/dedicados/[tipo]       1gbps · 10gbps · storage
/red                    Red / backbone (AS, peers, mapa de Europa)
/proteccion-ddos        Producto de mitigación DDoS
/casos-de-uso           Casos de uso
/desplegar              Selector de plan → checkout (módulo funcional)
/contratar/[plan]       Checkout interno con resumen + formulario (todos los planes, SSG, noindex)
/contacto               Formulario de contacto funcional + canales directos
/soporte                Centro de ayuda (accesos, categorías, FAQ)
/estado                 Estado del sistema en vivo (servicios, regiones, incidencias)
/sobre-nosotros         Sobre la empresa
/legal/privacidad       Plantilla legal estructurada
/legal/terminos         Plantilla legal estructurada
/legal/cookies          Plantilla legal estructurada
404 (not-found)         "host not found" con el mismo estilo
sitemap.xml, robots.txt Generados por Next
```

### Módulos funcionales (sin backend)

Toda la interfaz funciona dentro del propio sitio (no depende de dominios externos):

- **Contratar / desplegar** (`/desplegar`, `/contratar/[plan]`): selección de plan,
  resumen del pedido en vivo, formulario con validación y confirmación. El último
  paso ("Ir al pago seguro") hace *handoff* al panel externo `site.billingUrl` con UTM.
- **Contacto** (`/contacto`): formulario con validación (nombre, email, asunto, mensaje)
  y estado de éxito. Canales `mailto:` directos.
- **Soporte** (`/soporte`): accesos rápidos, categorías de ayuda y FAQ.
- **Estado** (`/estado`): estado por servicio y región + histórico de incidencias, con
  marca de tiempo en vivo. Datos en `src/data/status.ts`.
- **Banner de cookies**: **activo**, guarda el consentimiento en `localStorage`.

> **Formularios:** validan y confirman **en cliente**. Cada uno tiene un comentario
> `TODO (API)` marcando exactamente dónde conectar tu backend/email/pago real. No envían
> nada todavía — solo falta enchufar el endpoint.

Las páginas `/vps/[region]` y `/dedicados/[tipo]` se generan **estáticamente** desde
`src/data/products.ts` con un layout reutilizable (`PlanGrid` + `FaqSection` + `CtaBand`).

---

## Animaciones

- **Framer Motion**: reveals con stagger (una sola vez), hovers, accordion, diagrama DDoS.
- **GSAP + ScrollTrigger**: solo en los contadores pinned (`HardwareCounters`).
- **CSS puro**: marquees y pulso de los nodos del mapa (solo `transform`).
- **`prefers-reduced-motion`**: todas las animaciones se desactivan o se reducen a fades
  (gestionado en `globals.css` + `useReducedMotion` en los componentes).

---

## SEO y rendimiento

- `lang="es"`, metadata única por página (title/description/canonical/OpenGraph).
- JSON-LD: `Organization` en el layout, `Product` con `offers` en las páginas de planes.
- `sitemap.ts` y `robots.ts` generados por Next.
- Imagen OG en `public/og.svg` (estática; sustituible por una imagen propia).
- Objetivo Lighthouse: Performance ≥ 90 móvil, Accessibility ≥ 95, contraste AA.

---

## Banner de cookies

`src/components/layout/CookieBanner.tsx` está **activo** (`const enabled = true`) y
guarda el consentimiento en `localStorage`. El sitio **no carga analítica todavía**:
cuando la añadas, inicialízala en `decide("accepted")` (hay un `TODO` marcado en el archivo).

---

## ⚠️ TODO — datos del cliente pendientes de confirmar

Estos valores son **placeholders realistas** marcados con `// TODO:` en el código.
Sustitúyelos por los datos reales antes de publicar:

### `src/data/site.ts`
- [ ] `billingUrl` — URL real del panel WHMCS/facturación (los CTAs "Desplegar/Contratar" apuntan aquí con UTM).
- [ ] `supportUrl`, `statusUrl` — URLs reales de soporte y estado.
- [ ] `contact.{sales,support,abuse}` — emails reales.
- [ ] `social.{x,github,linkedin}` — perfiles reales.
- [ ] `legal.companyName`, `legal.jurisdiction`, `legal.taxId`, `legal.address`, `legal.addressCountry` — razón social de la **LLC**, estado/país de constitución, EIN/registro fiscal y dirección registrada.
- [ ] `legal.trustpilotUrl` — URL de Trustpilot (vacío = no se muestra el badge).
- [ ] `paymentMethods` — confirmar métodos de pago.
- [ ] `network.{asn,peers,capacityTbps,portMaxGbps,rankingNote}` — datos reales de red.
- [ ] `ddos.{mitigationTbps,absorbedAttacks}` — capacidad y cifras reales de mitigación.

### `src/data/products.ts`
- [ ] `regions` — regiones VPS disponibles y precio "desde" reales.
- [ ] `vps.plans` — specs y precios reales de los planes VPS.
- [ ] `dedicatedTypes` — planes dedicados reales (hardware, specs, precios) de 1 Gbps, 10 Gbps y storage.

### `src/data/content.ts`
- [ ] `LiveMetrics` (en `src/components/home/LiveMetrics.tsx`) usa métricas **simuladas** en cliente. Conectar a una API real si existe.

### Legales (`src/app/legal/*`)
- [ ] Las tres páginas legales son **plantillas estructuradas** (no lorem ipsum): cada
      apartado indica con `TODO (legal):` qué debe redactar/validar un abogado. Falta
      también la fecha de "última actualización".

### `src/app/sobre-nosotros/page.tsx`
- [ ] Sustituir la sección con la historia/hitos/equipo reales (hay un `TODO` marcado).

### Conectar formularios al backend (al alojar)
Los formularios ya funcionan en cliente; solo falta enchufar el endpoint donde está
marcado `TODO (API)`:
- [ ] `src/components/forms/ContactForm.tsx` — `POST` del mensaje a tu API/servicio de email.
- [ ] `src/components/forms/OrderForm.tsx` — registrar el pedido y/o ajustar el *handoff*
      al panel de pago (`site.billingUrl` en `src/data/site.ts`).
- [ ] `src/data/status.ts` — conectar `/estado` a una API de monitorización real.
- [ ] (Opcional) Analítica + activar su carga en el consentimiento de cookies.

---

## Deploy

**Opción A — Vercel (recomendada):**
1. Sube el repo a GitHub.
2. Importa el proyecto en Vercel (detecta Next.js automáticamente).
3. Deploy. No requiere configuración adicional.

**Opción B — VPS propio detrás de Nginx:**
```bash
npm ci
npm run build
npm run start        # escucha en :3000 (usa PORT=xxxx para cambiarlo)
```
Proxy inverso de ejemplo en Nginx:
```nginx
server {
  server_name viahost.xyz;
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```
Gestiona el proceso con `pm2 start "npm run start" --name viahost` o un servicio systemd.

> Recuerda actualizar `site.url` en `src/data/site.ts` al dominio real para que
> canonical, OpenGraph, sitemap y robots apunten bien.
