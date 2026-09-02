# PENDIENTES.md — Confirmaciones y decisiones antes de dar por cerrado

_Lo que necesito que confirmes/decidas. Nada de esto bloquea lo ya hecho (todo lo publicado usa solo datos verificados), pero condiciona los siguientes pasos y algunos textos._

Convención: los datos sin confirmar que aparezcan en borradores van marcados como `[PENDIENTE: confirmar con Raúl]` y **no se publican** hasta confirmarse.

---

## A. Confirmaciones de negocio (bloquean contenido nuevo)

| # | Tema | Qué necesito | Qué desbloquea |
|---|---|---|---|
| A1 | **Alemania operativa** | ✅ **RESUELTO (2026-09-02): Alemania está operativa.** Se mantiene como región disponible en catálogo, sitemap, `/llms.txt` y comparativas. | — |
| A2 | **Métodos de pago** | ✅ **RESUELTO (2026-09-02): quitados PayPal y Crypto.** Activos: **tarjeta (Stripe: Visa/Mastercard)** + **transferencia/SEPA**. Footer y `/llms.txt` ya solo reflejan eso. | — |
| A3 | **Reseñas reales** | ¿Hay **Trustpilot** u otras reseñas reales? URL. | Habilita `AggregateRating` en schema y el badge de Trustpilot. Sin esto, **no** pongo ratings (no inventar). |
| A4 | **Redes sociales** | Handles **reales** de X, LinkedIn, GitHub (los actuales en `site.ts` son placeholder). | Reañadir `sameAs` al schema de entidad (lo retiré por ser falso). |
| A5 | **Cifras verificables** | ¿Datos medidos de **uptime %**, **IOPS NVMe**, **latencia** a España, capacidad de red? | Convertir afirmaciones cualitativas en cifras citables (alto valor GEO). Sin confirmar, se quedan como conceptos. |
| A6 | **Servidores dedicados** | ✅ **RESUELTO (2026-09-02): no se venden por el momento.** Las categorías siguen `visible:false`, así que no se renderiza ningún enlace público, no están en sitemap/`llms.txt` y `/dedicados` da 404 (correcto). Si en el futuro se venden, se publican las categorías. | — |

## B. Decisiones estratégicas

| # | Tema | Recomendación |
|---|---|---|
| B1 | **Idioma por defecto** | La web arranca en **inglés** (raíz) con `/es` y `/fr` con prefijo. Recomiendo **no** cambiar el idioma por defecto (evita 301 masivos) e **invertir en `/es`** como target España. El canonical ya está arreglado y `/es` es indexable. |
| B2 | **Relato de entidad** | Confirmar que se expone **ViaHost Networks, LLC (Wyoming/Orlando FL, US)** con datacenters en la UE. Añadiré una frase clara "empresa US, infraestructura en la UE" en `/sobre-nosotros` (pendiente de tu OK). |
| B3 | **Marca/dominio** | Doy por definitivo **ViaHost / viahost.top** (el comentario "marca inventada" en `site.ts` está obsoleto). Si cambia, hay que rehacer schema/footer/legales. |
| B4 | **Precios de terceros** | En las comparativas van marcados como orientativos (2026-09). Decidir cada cuánto revisarlos (recomiendo trimestral). |

## C. Técnicos menores pendientes (no requieren datos tuyos)

- **OG image PNG 1200×630** (hoy `/og.svg`; varias plataformas no renderizan SVG). — lo puedo generar yo.
- **Meta descriptions/títulos cortos**: `/dominios` (desc 61 car.), `/red` (título 13 car.), `/desplegar`. — reescritura rápida.
- **Core Web Vitals**: medir con PageSpeed Insights (campo real) home, `/es/vps`, `/es/hosting`; vigilar el JS de framer-motion/gsap. — requiere navegador/PSI.
- **Blog** `/blog/` (FASE 5 restante): semilla de artículos HowTo/Article.
- **Regiones**: los nombres en catálogo están en inglés ("Netherlands"); localizar a "Países Bajos"/"Alemania" mejora los breadcrumbs y textos.

## D. Estado de despliegue y git (importante)

- Todo el trabajo SEO/GEO vive en la rama **`seo-geo-20260902`** y **ya está desplegado en producción** (cada paso se verificó en vivo con `npm run deploy`). La web pública corre este código.
- **La rama NO está mergeada a `main` ni pusheada.** Cuando quieras, hago `merge` a `main` + push (respetando la regla de solo-local hasta tu "haz push").
- Ninguna URL pública cambió → **no hay 301 pendientes**.
- El **flujo de compra y Stripe no se han tocado** (verificado: checkout y pagos intactos).

## E. Entregables generados
`SEO-AUDIT.md` · `COMPETENCIA.md` · `KEYWORD-MAP.md` · `PLAN-GEO.md` · `CHANGELOG-SEO.md` · `PENDIENTES.md` (este).

---

### Estado
✅ Resueltos: **A1** (Alemania operativa), **A2** (PayPal/Crypto quitados), **A6** (dedicados no se venden, ya oculto).

Quedan para afinar (no bloquean el blog): **A3** (reseñas), **A4** (redes reales), **A5** (cifras medidas), **B2/B3** (OK explícito a entidad US + marca definitiva) y los técnicos del bloque C.
