# Levantar otra instancia importando un WHMCS

Receta para montar un segundo sistema como este (otra marca/dominio) partiendo de la
cartera de clientes de un WHMCS. El importador es `scripts/importar-whmcs.mjs`.

## 1. Instancia nueva

```bash
git clone <repo> web-nuevamarca && cd web-nuevamarca
# Marca y datos legales: src/data/site.ts (nombre, dominio, emails, razón social).
cp .env.example .env            # rellenar: ADMIN_EMAILS, SMTP, Stripe/Wise, provisioner…
npm ci && npm run build
node scripts/crear-admin.mjs admin@nuevamarca.com 'Clave!Segura1'
npm run start                   # (o pm2/nginx como en docs/OPERACIONES.md)
```

Abre `/admin/catalogo` una vez: la primera lectura siembra `data/catalogo.json` con las
familias fijas (Cloud VPS, Hosting Web). Ajusta planes, precios y ubicaciones a la nueva marca.

## 2. Importar WHMCS

Necesitas la base de datos de WHMCS accesible desde esta máquina (MySQL/MariaDB), o un
volcado `mysqldump`. El script solo usa Node y el cliente `mysql` del sistema.

```bash
# Simulación (no escribe nada): informe de lo que importaría y avisos
node scripts/importar-whmcs.mjs --db whmcs --mysql-args "-u root -p"          # BD ya cargada
node scripts/importar-whmcs.mjs --dump whmcs.sql --mysql-args "-u root -p"    # desde un volcado

# Aplicar (con la app PARADA para no pisar escrituras concurrentes)
node scripts/importar-whmcs.mjs --db whmcs --mysql-args "-u root -p" --data ./data --aplicar
chown -R <usuario-de-la-app>:<grupo> data && chmod 600 data/*
```

Opciones: `--incluir-cerrados` (clientes `Closed`), `--incluir-terminados` (servicios y
dominios cancelados/terminados, se importan como terminados), `--idioma en` (idioma por defecto
de los clientes sin idioma reconocido), `--conservar-bd` (no borrar la BD temporal del volcado).

Es **idempotente**: `data/whmcs-import.json` guarda la correspondencia id de WHMCS → registro
de aquí; repetir la importación (p. ej. tras un segundo volcado más reciente) solo añade lo nuevo
y nunca pisa lo que ya existía (un cliente con el mismo email se reutiliza).

## 3. Qué se importa y con qué límites

| WHMCS | Aquí | Notas |
|---|---|---|
| `tblclients` | `usuarios.jsonl` | Nombre, dirección, país, teléfono, alta. **Sin contraseña utilizable** (ver abajo). La empresa no tiene campo. |
| `tblinvoices` + `tblinvoiceitems` | `facturas.jsonl` | `Paid` → factura fiscal `FACT-AAAA-NNN` (serie cronológica por fecha de pago, continuando la serie existente); `Unpaid`/`Collections` → proforma pendiente con referencia de pago `VH…`; `Cancelled`/`Refunded` → cancelada; `Draft` se salta. IVA = `taxrate`. Cada línea de WHMCS es una línea con cantidad 1. |
| `tblhosting` tipo `hostingaccount`/`reselleraccount` | `hosting-intents.jsonl` | Cuenta cPanel activa: usuario, dominio, plan. Entra en el barrido de renovaciones con el importe mensual (`amount` / meses del ciclo). |
| `tblhosting` tipo `server`/`other` | `servidores.jsonl` (proveedor `externo`) + `renovaciones-vps.jsonl` | El cliente lo ve en su panel, pero **no** tiene control (arrancar/parar) ni renovación automática: el módulo solo renueva Proxmox, v4vm y hosting. Cobrarlos sigue siendo manual (o dar de alta el servidor en un proveedor gestionado). |
| `tblproductgroups` / `tblproducts` / `tblpricing` | `catalogo.json` | Cada grupo es una categoría **oculta** de tipo dedicados; cada producto un plan con el precio mensual equivalente. Revisar specs y visibilidad en `/admin/catalogo`. |
| `tbldomains` | `domain-intents.jsonl` | Dominio, años y cliente. La caducidad y el registrador se listan en el informe: esta web no renueva dominios de otros registradores. |
| `tbltickets` + `tblticketreplies` | `tickets.jsonl` | Hilo completo (cliente/soporte), numeración `TCK-AAAA-NNN`, categoría por nombre de departamento. |

No se importan: credenciales de cPanel/servidores (WHMCS las guarda cifradas con su clave),
métodos de pago guardados (tarjetas/PayPal), créditos de cuenta, cupones, afiliados, pedidos
(`tblorders`) ni la configuración de WHMCS.

## 4. Contraseñas de los clientes

WHMCS guarda bcrypt y esta web scrypt: no hay conversión posible. Cada cliente importado
queda con una contraseña aleatoria que nadie conoce y fija la suya con **"¿Olvidaste tu
contraseña?"** (`/recuperar`), que le llega por correo. `data/whmcs-import-clientes.csv` tiene la
lista de emails para avisarles tras la migración.

(Alternativa no implementada: aceptar los hashes bcrypt de WHMCS en el login y re-hashear a
scrypt al entrar. Requiere añadir `bcryptjs` y tocar `src/lib/auth.ts`.)

## 5. Después de importar

- Moneda: si WHMCS no facturaba en EUR, los importes se copian tal cual (aviso en el informe).
- Revisar `/admin/catalogo` (categorías importadas ocultas), `/admin/facturas` y `/admin/servidores`.
- `data/whmcs-import-informe.txt` guarda el informe de la importación aplicada.
