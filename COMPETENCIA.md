# COMPETENCIA.md — Análisis competitivo (mercado España + comparadores internacionales)

_Fecha: 2026-09-02. Precios "desde" **consultados en 2026-09, orientativos — verificar antes de publicar** (fluctúan y muchos usan precio promocional que sube en renovación). Fuentes al final._

Contexto ViaHost (referencia interna, de catálogo): **VPS desde 8 €/mes** (2 vCore EPYC / 4 GB / 50 GB NVMe), **Hosting cPanel desde 2,95 €/mes** (precio **plano**, sin subida en renovación), **dominios con privacidad WHOIS incluida**. Infra en **Ámsterdam (NL) + Alemania**, panel Proxmox self-service + consola noVNC, DDoS incluido, aprovisionamiento 60 s. Entidad: ViaHost Networks, LLC (US) con datacenters en la UE.

---

## 1. Tabla comparativa

| Proveedor | DC / país | Panel | ¿cPanel? | VPS desde | Hosting desde | ¿Sube en renovación? | DDoS incl. | Foco |
|---|---|---|---|---|---|---|---|---|
| **ViaHost** | 🇳🇱🇩🇪 NL/DE | Proxmox propio + noVNC | ✅ (hosting) | 8 €/mes | **2,95 €/mes (plano)** | ❌ **No** | ✅ | VPS+hosting+dominios integrado, privacidad |
| Contabo | 🇩🇪 DE / global | Propio | ✅ (opcional) | ~4,50 €/mes (4vCPU/8GB) | ~ | ❌ (plano) | Parcial | VPS barato, mucha RAM/€, soporte flojo |
| Hetzner | 🇩🇪🇫🇮 DE/FI | Cloud Console | ❌ | ~5,49 €/mes (CX23) | — | ❌ (plano) | ✅ | VPS técnico, **subió +37–176% en 2026** |
| Clouding.io | 🇪🇸 Barcelona | Propio | ❌ (gestionado extra) | ~3 €/mes (pago/hora) | — | ❌ (por uso) | ✅ | Cloud VPS flexible español |
| Stackscale | 🇪🇸🇳🇱 Madrid/Ams | Propio | ❌ | (bajo demanda) | — | ✅ | ❌/gestionado | Cloud privado / bare metal enterprise |
| SW Hosting | 🇪🇸 Girona | SWPanel propio | ❌ (SWPanel) | ~5–10 €/mes | ~3–5 €/mes | Moderado | Parcial | Todo-en-uno español, DC propio |
| Raiola Networks | 🇪🇸 España | cPanel | ✅ | (VPS +licencia cPanel 59,99€) | 5,33→6,66 €/mes | ⚠️ Sí (descuento→renov.) | Parcial | Hosting WordPress/cPanel, gran blog SEO |
| Webempresa | 🇪🇸 Madrid | cPanel | ✅ | — | 3,95→**9,95** €/mes | ⚠️ **Sí (fuerte)** | Parcial | Hosting WordPress premium, marca 2003 |
| Dinahosting | 🇪🇸 Galicia | Propio + cPanel | ✅ (opcional) | ~5–9 €/mes | ~3–5 €/mes | Moderado | Parcial | Dominios + hosting, soporte 24/7 ES |
| Arsys | 🇪🇸 Logroño | Propio | Parcial | ~5–15 €/mes | ~3–6 €/mes | Sí (intro) | Parcial | Incumbente SMB, parte de IONOS |
| Hostinger | 🌍 global | hPanel (no cPanel) | ❌ | ~6,49$→11,99$ (KVM1) | 2,99$→**11,99$** | ⚠️ **Sí (fuerte en shared)** | Parcial | Volumen, precio gancho agresivo |
| OVHcloud | 🇫🇷 EU | Propio | ✅ (opcional) | ~3,50–5 €/mes | ~ | ❌ (plano) | ✅ | Gigante EU, barato, soporte/complejidad |
| IONOS | 🇩🇪 DE | Propio | ✅ (opcional) | ~1–2 €/mes intro | ~1 €/mes intro | ⚠️ Sí (intro→sube) | Parcial | SMB, precio gancho muy bajo |

---

## 2. Notas por competidor (estructura, naming, schema, contenido)

- **Contabo** — URLs `/vps`, `/vds`, `/dedicated-servers`; naming numérico ("Cloud VPS 10/20/30"). Precio plano (no trampa). Debilidad conocida: **soporte y panel**. Poco contenido en español. → *ViaHost gana en panel/soporte/UE-privacidad, pierde en €/spec.*
- **Hetzner** — naming por familias (CX/CPX/CCX). Sin cPanel (unmanaged). **Oportunidad 2026: subida de precios masiva** → auge de "Hetzner alternative". Público técnico. → *ViaHost: alternativa UE con panel gestionado + DDoS incluido.*
- **Clouding.io** (🇪🇸) — fuerte SEO español, **calculadora/sliders** de config, blog activo, pago por hora. DC Barcelona (baza "España"). Naming "Cloud VPS". → *Referente de UX de configuración a imitar; ViaHost compite con panel + cPanel + dominios.*
- **Raiola Networks** (🇪🇸) — **máquina de contenido SEO** (guías WordPress, comparativas "mejor hosting"), cPanel, planes "Inicio/Base/Avanzado", **modelo descuento→renovación**, DC España, migración gratis. FAQ extensas por plan. → *ViaHost: mismo cPanel pero **precio plano** + dominios privacidad; desventaja: sin DC España ni track record.*
- **Webempresa** (🇪🇸) — marca desde 2003, WordPress, soporte 24/7 ES, uptime 99,95%, **fuerte salto en renovación** (3,95→9,95). Blog y academia potentes. → *Angle ViaHost: honestidad de precio + cPanel + NVMe, a menor coste real a 12 meses.*
- **SW Hosting / Dinahosting / Arsys** (🇪🇸) — DC en España, paneles propios (SW usa SWPanel, no cPanel), gama amplia. Dinahosting fuerte en **dominios**. Arsys incumbente (IONOS). → *Hueco: cPanel real + privacidad de dominios + panel VPS moderno.*
- **Stackscale** (🇪🇸) — enterprise/cloud privado, no es competidor de VPS barato; útil como referencia de credibilidad técnica (DCs Madrid/Ámsterdam). 
- **Hostinger / IONOS** — precio gancho muy bajo con **renovación agresiva**; hPanel/panel propio (no cPanel de verdad en Hostinger). → *ViaHost: cPanel real + precio plano honesto.*
- **OVHcloud** — barato y potente pero soporte/complejidad; cPanel opcional. → *ViaHost: experiencia guiada + soporte ES.*

**Patrón de schema/contenido del sector español (Raiola/Webempresa/Clouding):** Product/Offer en planes, **FAQPage** por producto, blogs enormes de tutoriales y comparativas ("mejor hosting España", "cómo instalar WordPress"), tablas de specs, y **badges de confianza** (uptime, reseñas, "servidores en España"). ViaHost ya tiene Product/Offer + FAQPage (VPS) tras la FASE 1; le falta **blog** y **tablas/FAQ en hosting y dominios**.

---

## 3. Conclusiones accionables para ViaHost

### Dónde **NO** competir
- **No competir en €/vCPU contra Contabo/Hetzner/IONOS.** ViaHost es más caro por specs crudos (VPS Start 8 € vs Contabo 4,50 €). Pelear precio ahí es perder.
- **No reclamar "servidores en España"**: la infra es **NL/DE**. Para queries "hosting/VPS en España" el ángulo es "Europa, baja latencia a España (Ámsterdam ~20–30 ms)", no DC español.

### Dónde **SÍ** ganar (diferenciadores reales)
1. **Precio de hosting PLANO sin trampa de renovación.** Webempresa 3,95→9,95, Raiola 5,33→6,66, Hostinger 2,99→11,99. ViaHost **2,95 € plano** es chec-mate honesto. → Mensaje central en `/hosting` y comparativas.
2. **"Alternativa a Hetzner" (post-subida 2026)** y **"alternativa a Contabo con panel y soporte de verdad"**: dos páginas de comparativa con datos.
3. **Ecosistema integrado**: VPS (Proxmox + consola noVNC + snapshots) **+** hosting cPanel **+** dominios con **privacidad WHOIS incluida** en un mismo panel. Ninguno de los baratos lo junta.
4. **Privacidad de dominios incluida**: casi nadie la regala ni la comunica. Baza única.
5. **Aprovisionamiento 60 s automatizado** (VPS y hosting) + **DDoS incluido**: comunicar como cifra/beneficio concreto.

### Huecos de mercado sin cubrir bien
- **Comparativas honestas y actualizadas post-subidas 2026** (Hetzner/Contabo) en español → tráfico alto, poca competencia fresca.
- **"Hosting cPanel sin subida en renovación"** como categoría de intención propia.
- **Migración gratis cPanel→cPanel** comunicada (Raiola/Webempresa lo explotan; ViaHost lo ofrece pero no lo comunica).
- **Contenido técnico VPS+Proxmox/KVM** en español (hueco frente a Hetzner, cuya doc es inglesa).

### Debilidades a gestionar (para credibilidad, no ocultar)
- **Sin reseñas/track record** (marca nueva): priorizar Trustpilot real + casos → hasta entonces, **nada de AggregateRating**.
- **Sin DC en España**: enmarcar como Europa/latencia.
- **Entidad US**: frase clara "empresa US, infraestructura en la UE".

---

## Fuentes (consultadas 2026-09)
- Contabo pricing: [bestusavps.com](https://bestusavps.com/reviews/contabo/), [affinco.com](https://affinco.com/contabo-pricing/)
- Hetzner pricing/subidas 2026: [northflank.com](https://northflank.com/blog/hetzner-cloud-server-price-increases), [wz-it.com](https://wz-it.com/en/blog/hetzner-price-increase-june-2026-cpx-ccx-alternatives/), [costgoat.com](https://costgoat.com/pricing/hetzner)
- Clouding.io: [urbantecno.com](https://urbantecno.com/windows/probamos-los-vps-en-espana-de-clouding-io), [vpspricetracker.com](https://vpspricetracker.com/es/provider/Clouding_io)
- Raiola Networks: [hostingexperto.es](https://www.hostingexperto.es/opiniones/raiola-networks/), [quondos.com](https://quondos.com/mag/raiola-networks/)
- Webempresa: [hostingexperto.es](https://www.hostingexperto.es/opiniones/webempresa/), [ecosistemastartup.com](https://ecosistemastartup.com/hosting-web-2026-guia-con-7-proveedores-y-precios-reales/)
- Hostinger: [es.hostadvice.com](https://es.hostadvice.com/hosting-company/hostinger-reviews/vps-pricing/)
