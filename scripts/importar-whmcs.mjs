#!/usr/bin/env node
/**
 * Importa una base de datos de WHMCS en los almacenes de datos de esta web
 * (`data/*.jsonl` + `data/catalogo.json`), para levantar OTRA instancia de este
 * sistema partiendo de la cartera de clientes de un WHMCS existente.
 *
 * Autocontenido: solo Node y el cliente `mysql`/`mariadb` del sistema. Lee las
 * tablas por JSON (JSON_ARRAYAGG), sin dependencias ni build de la app.
 *
 *   # 1) Simulación (no escribe nada): informe de lo que importaría
 *   node scripts/importar-whmcs.mjs --db whmcs --mysql-args "-u root"
 *   # 2) Desde un volcado .sql (lo carga en una BD temporal y la borra al acabar)
 *   node scripts/importar-whmcs.mjs --dump whmcs.sql --mysql-args "-u root"
 *   # 3) Aplicar de verdad sobre el directorio de datos de la instancia
 *   node scripts/importar-whmcs.mjs --db whmcs --mysql-args "-u root" --data ./data --aplicar
 *
 * Qué importa y a dónde:
 *   tblclients                → usuarios.jsonl        (contraseñas: ver abajo)
 *   tblinvoices + items       → facturas.jsonl        (Paid → FACT-AAAA-NNN; Unpaid → proforma)
 *   tblhosting (cPanel)       → hosting-intents.jsonl (cuenta activa: usuario cPanel + dominio)
 *   tblhosting (servidores)   → servidores.jsonl (proveedor "externo") + renovaciones-vps.jsonl
 *   tbldomains                → domain-intents.jsonl
 *   tbltickets + replies      → tickets.jsonl
 *   tblproductgroups/products → catalogo.json (categorías OCULTAS hasta revisarlas)
 *
 * Contraseñas: WHMCS guarda bcrypt y esta web scrypt; no se pueden convertir.
 * Cada cliente importado recibe un hash aleatorio (no puede entrar) y fija la
 * suya por "¿Olvidaste tu contraseña?" (/recuperar), que le llega por correo.
 * El informe deja la lista de emails para avisarles.
 *
 * Idempotente: `data/whmcs-import.json` recuerda qué id de WHMCS ya es qué
 * registro aquí; repetir la importación no duplica nada.
 */
import { execFileSync } from "node:child_process";
import { randomBytes, randomUUID, scryptSync } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

/* --------------------------------- CLI ----------------------------------- */

const args = process.argv.slice(2);
const opt = (name, def = undefined) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? (args[i + 1] ?? def) : def;
};
const flag = (name) => args.includes(`--${name}`);

const DB = opt("db");
const DUMP = opt("dump");
const MYSQL_ARGS = (opt("mysql-args", "") || "").split(/\s+/).filter(Boolean);
const DATA_DIR = path.resolve(opt("data", "data"));
const APLICAR = flag("aplicar");
const INCLUIR_CERRADOS = flag("incluir-cerrados");
const INCLUIR_TERMINADOS = flag("incluir-terminados");
const IDIOMA_POR_DEFECTO = opt("idioma", "es") === "en" ? "en" : "es";

if (!DB && !DUMP) {
  console.error("Uso: importar-whmcs.mjs (--db <bd> | --dump <fichero.sql>) [--mysql-args \"-u root -p…\"] [--data ./data] [--aplicar]");
  process.exit(2);
}

/* -------------------------------- MySQL ---------------------------------- */

function mysql(sql, db) {
  const out = execFileSync("mysql", [...MYSQL_ARGS, ...(db ? [db] : []), "-N", "-B", "--raw", "-e", sql], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 1024,
  });
  return out.trim();
}

let dbName = DB;
let dbTemporal = false;
if (DUMP) {
  dbName = `whmcs_import_${Date.now()}`;
  dbTemporal = true;
  console.log(`▸ Cargando ${DUMP} en la base de datos temporal ${dbName}…`);
  mysql(`CREATE DATABASE \`${dbName}\` CHARACTER SET utf8mb4`);
  execFileSync("mysql", [...MYSQL_ARGS, dbName], { input: readFileSync(DUMP), maxBuffer: 1024 * 1024 * 1024 });
}

const columnas = (tabla) =>
  mysql(
    `SELECT GROUP_CONCAT(COLUMN_NAME ORDER BY ORDINAL_POSITION) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='${dbName}' AND TABLE_NAME='${tabla}'`,
  );

/** Todas las filas de una tabla como objetos (solo las columnas pedidas que existan). */
function tabla(nombre, cols, where = "") {
  const existentes = new Set((columnas(nombre) || "").split(",").filter(Boolean));
  if (existentes.size === 0) return null; // la tabla no existe en esta versión de WHMCS
  const pedidas = cols.filter((c) => existentes.has(c));
  const obj = pedidas.map((c) => `'${c}', \`${c}\``).join(", ");
  const sql = `SET SESSION group_concat_max_len = 4294967295; SELECT JSON_ARRAYAGG(JSON_OBJECT(${obj})) FROM \`${nombre}\` ${where}`;
  const out = mysql(sql, dbName);
  if (!out || out === "NULL") return [];
  return JSON.parse(out);
}

/* --------------------------------- Ayudas -------------------------------- */

const vacio = (v) => v == null || v === "" || String(v).startsWith("0000-00-00");
function iso(fecha) {
  if (vacio(fecha)) return null;
  const s = String(fecha);
  const d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T12:00:00Z`) : new Date(s.replace(" ", "T") + (s.includes("Z") ? "" : "Z"));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const slugify = (s) =>
  String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 48);
const hashAleatorio = () => {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString("hex")}$${scryptSync(randomBytes(32).toString("hex"), salt, 64).toString("hex")}`;
};
const idiomaDe = (lang) => (/^(spanish|es)/i.test(lang || "") ? "es" : /^(english|en)/i.test(lang || "") ? "en" : IDIOMA_POR_DEFECTO);
const MESES_CICLO = { Monthly: 1, Quarterly: 3, "Semi-Annually": 6, Annually: 12, Biennially: 24, Triennially: 36 };
function restarMeses(isoFecha, meses) {
  const d = new Date(isoFecha);
  d.setUTCMonth(d.getUTCMonth() - meses);
  return d.toISOString();
}

/* ------------------------------ Almacenes -------------------------------- */

function leerJsonl(nombre) {
  const f = path.join(DATA_DIR, nombre);
  if (!existsSync(f)) return [];
  return readFileSync(f, "utf8").split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l));
}
function escribirAtomico(f, contenido) {
  mkdirSync(path.dirname(f), { recursive: true });
  const tmp = `${f}.${process.pid}.tmp`;
  writeFileSync(tmp, contenido, { encoding: "utf8", mode: 0o600 });
  chmodSync(tmp, 0o600);
  renameSync(tmp, f);
}
const escribirJsonl = (nombre, filas) => escribirAtomico(path.join(DATA_DIR, nombre), filas.map((r) => JSON.stringify(r)).join("\n") + (filas.length ? "\n" : ""));

const MAPA_FILE = path.join(DATA_DIR, "whmcs-import.json");
const mapa = existsSync(MAPA_FILE)
  ? JSON.parse(readFileSync(MAPA_FILE, "utf8"))
  : { clientes: {}, facturas: {}, servicios: {}, dominios: {}, tickets: {}, categorias: {}, productos: {} };

const avisos = [];
const aviso = (s) => avisos.push(s);
const cuenta = { clientes: 0, facturas: 0, hosting: 0, servidores: 0, dominios: 0, tickets: 0, categorias: 0, productos: 0, saltados: 0 };

/* -------------------------------- Lectura -------------------------------- */

console.log(`▸ Leyendo WHMCS (${dbName})…`);
const monedas = tabla("tblcurrencies", ["id", "code", "default"]) ?? [];
const monedaDefecto = monedas.find((m) => Number(m.default) === 1)?.code ?? monedas[0]?.code ?? "?";
if (monedaDefecto !== "EUR") aviso(`La moneda por defecto de WHMCS es ${monedaDefecto}; los importes se copian tal cual (esta web factura en EUR).`);

const clientes = tabla("tblclients", ["id", "firstname", "lastname", "companyname", "email", "address1", "address2", "city", "state", "postcode", "country", "phonenumber", "status", "datecreated", "language", "currency"]) ?? [];
const facturas = tabla("tblinvoices", ["id", "invoicenum", "userid", "date", "duedate", "datepaid", "subtotal", "tax", "taxrate", "total", "status", "paymentmethod", "notes"]) ?? [];
const lineas = tabla("tblinvoiceitems", ["id", "invoiceid", "userid", "type", "relid", "description", "amount", "taxed"]) ?? [];
const servicios = tabla("tblhosting", ["id", "userid", "packageid", "domain", "username", "regdate", "nextduedate", "billingcycle", "amount", "domainstatus", "server", "dedicatedip", "notes"]) ?? [];
const productos = tabla("tblproducts", ["id", "gid", "type", "name", "description", "paytype", "servertype", "hidden", "retired", "configoption1"]) ?? [];
const grupos = tabla("tblproductgroups", ["id", "name", "hidden", "order"]) ?? [];
const precios = tabla("tblpricing", ["id", "type", "currency", "relid", "monthly", "quarterly", "semiannually", "annually"]) ?? [];
const dominios = tabla("tbldomains", ["id", "userid", "registrationdate", "domain", "recurringamount", "registrar", "registrationperiod", "expirydate", "nextduedate", "status"]) ?? [];
const tickets = tabla("tbltickets", ["id", "tid", "did", "userid", "name", "email", "date", "title", "message", "status", "lastreply"]) ?? [];
const respuestas = tabla("tblticketreplies", ["id", "tid", "userid", "name", "email", "date", "message", "admin"]) ?? [];
const departamentos = tabla("tblticketdepartments", ["id", "name"]) ?? [];

/* ------------------------------- Clientes -------------------------------- */

const usuarios = leerJsonl("usuarios.jsonl");
const emailsUsados = new Map(usuarios.map((u) => [u.email.toLowerCase(), u.id]));
const clientePorWhmcs = new Map(); // whmcs id → { userId, email, nombre, idioma }
const paraRestablecer = [];

for (const c of clientes) {
  const email = String(c.email || "").trim().toLowerCase();
  if (!email) { cuenta.saltados++; continue; }
  if (c.status === "Closed" && !INCLUIR_CERRADOS) { cuenta.saltados++; continue; }
  const nombre = String(c.firstname || "").trim();
  const apellidos = String(c.lastname || "").trim();
  const idioma = idiomaDe(c.language);
  const yaMapeado = mapa.clientes[c.id];
  const existente = yaMapeado ? usuarios.find((u) => u.id === yaMapeado) : usuarios.find((u) => u.email.toLowerCase() === email);
  if (existente) {
    mapa.clientes[c.id] = existente.id;
    clientePorWhmcs.set(String(c.id), { userId: existente.id, email, nombre: `${nombre} ${apellidos}`.trim() || email, idioma });
    continue; // ya existe (o ya se importó): no se pisa
  }
  const u = {
    id: randomUUID(),
    email,
    passwordHash: hashAleatorio(),
    nombre,
    apellidos,
    direccion: [c.address1, c.address2].filter((x) => x && String(x).trim()).join(", "),
    ciudad: String(c.city || "").trim(),
    estado: String(c.state || "").trim(),
    pais: String(c.country || "").trim(),
    telefono: String(c.phonenumber || "").trim(),
    codigoPostal: String(c.postcode || "").trim(),
    createdAt: iso(c.datecreated) ?? new Date().toISOString(),
  };
  if (c.companyname && String(c.companyname).trim()) aviso(`Cliente ${email}: la empresa "${String(c.companyname).trim()}" no tiene campo aquí (no se guarda).`);
  usuarios.push(u);
  emailsUsados.set(email, u.id);
  mapa.clientes[c.id] = u.id;
  clientePorWhmcs.set(String(c.id), { userId: u.id, email, nombre: `${nombre} ${apellidos}`.trim() || email, idioma });
  paraRestablecer.push(email);
  cuenta.clientes++;
}

/* -------------------------------- Catálogo ------------------------------- */

const CAT_FILE = path.join(DATA_DIR, "catalogo.json");
let catalogo = existsSync(CAT_FILE) ? JSON.parse(readFileSync(CAT_FILE, "utf8")) : null;
if (!catalogo) {
  aviso("No existe data/catalogo.json: arranca la app una vez (siembra las familias VPS/Hosting) antes de importar el catálogo. Los productos de WHMCS se importan igualmente en un catálogo mínimo.");
  catalogo = { categorias: [], productos: [], ubicaciones: [] };
}
const ahoraIso = new Date().toISOString();
const categoriaPorGrupo = new Map();
const precioMensual = (productoId) => {
  const p = precios.find((x) => x.type === "product" && String(x.relid) === String(productoId) && (monedas.find((m) => String(m.id) === String(x.currency))?.code ?? monedaDefecto) === monedaDefecto)
    ?? precios.find((x) => x.type === "product" && String(x.relid) === String(productoId));
  if (!p) return 0;
  for (const [campo, meses] of [["monthly", 1], ["quarterly", 3], ["semiannually", 6], ["annually", 12]]) {
    if (num(p[campo]) > 0) return round2(num(p[campo]) / meses);
  }
  return 0;
};
for (const g of grupos) {
  const yaId = mapa.categorias[g.id];
  let cat = yaId ? catalogo.categorias.find((c) => c.id === yaId) : null;
  if (!cat) {
    const usados = new Set(catalogo.categorias.map((c) => c.slug));
    let slug = slugify(g.name) || `grupo-${g.id}`;
    for (let n = 2; usados.has(slug); n++) slug = `${slugify(g.name)}-${n}`;
    cat = {
      id: randomUUID(),
      tipo: "dedicados", // única familia que admite categorías nuevas; se revisa en /admin/catalogo
      slug,
      nombre: { en: String(g.name), es: String(g.name), fr: String(g.name) },
      descripcion: { en: "", es: "", fr: "" },
      etiqueta: { en: "", es: "", fr: "" },
      visible: false, // oculta hasta que el administrador la revise
      orden: catalogo.categorias.length,
      creadoAt: ahoraIso,
      actualizadoAt: ahoraIso,
    };
    catalogo.categorias.push(cat);
    mapa.categorias[g.id] = cat.id;
    cuenta.categorias++;
  }
  categoriaPorGrupo.set(String(g.id), cat);
}
const productoPorWhmcs = new Map(); // whmcs product id → { planId, nombre, tipo }
for (const p of productos) {
  const cat = categoriaPorGrupo.get(String(p.gid));
  const yaPlanId = mapa.productos[p.id];
  let prod = yaPlanId ? catalogo.productos.find((x) => x.planId === yaPlanId) : null;
  if (!prod && cat) {
    const usados = new Set(catalogo.productos.map((x) => x.planId));
    let planId = `ded-${cat.slug}-${slugify(p.name)}` || `whmcs-${p.id}`;
    for (let n = 2; usados.has(planId); n++) planId = `ded-${cat.slug}-${slugify(p.name)}-${n}`;
    prod = {
      id: randomUUID(),
      categoriaId: cat.id,
      planId,
      nombre: String(p.name),
      cpu: "",
      ram: "",
      almacenamiento: "",
      red: "",
      precio: precioMensual(p.id),
      popular: false,
      visible: !(Number(p.hidden) === 1 || Number(p.retired) === 1),
      orden: catalogo.productos.filter((x) => x.categoriaId === cat.id).length,
      creadoAt: ahoraIso,
      actualizadoAt: ahoraIso,
    };
    catalogo.productos.push(prod);
    mapa.productos[p.id] = planId;
    cuenta.productos++;
  }
  productoPorWhmcs.set(String(p.id), { planId: prod?.planId ?? `whmcs-${p.id}`, nombre: String(p.name), tipo: String(p.type || "other"), precio: prod?.precio ?? precioMensual(p.id) });
}

/* -------------------------------- Facturas ------------------------------- */

const facturasLocal = leerJsonl("facturas.jsonl");
const numerosUsados = new Set(facturasLocal.map((f) => f.numero));
const siguienteFiscal = {};
for (const f of facturasLocal) {
  const m = /^FACT-(\d{4})-(\d+)$/.exec(f.numeroFactura || "");
  if (m) siguienteFiscal[m[1]] = Math.max(siguienteFiscal[m[1]] ?? 0, Number(m[2]));
}
const nuevaProforma = (year) => {
  let n;
  do n = `PRO-${year}-${randomBytes(3).toString("hex").toUpperCase()}`; while (numerosUsados.has(n));
  numerosUsados.add(n);
  return n;
};
const ESTADO = { Paid: "pagada", Unpaid: "pendiente", "Payment Pending": "pendiente", Cancelled: "cancelada", Refunded: "cancelada", Collections: "pendiente" };
const METODO = { stripe: "stripe", paypal: "paypal", banktransfer: "transferencia", mailin: "transferencia" };
const facturaPorWhmcs = new Map();
const lineasPorFactura = new Map();
for (const l of lineas) {
  if (!lineasPorFactura.has(String(l.invoiceid))) lineasPorFactura.set(String(l.invoiceid), []);
  lineasPorFactura.get(String(l.invoiceid)).push(l);
}
// Las pagadas se numeran por orden de pago para que la serie fiscal sea cronológica.
const facturasOrdenadas = [...facturas].sort((a, b) => String(a.datepaid || a.date).localeCompare(String(b.datepaid || b.date)));
for (const f of facturasOrdenadas) {
  if (f.status === "Draft" || ESTADO[f.status] === undefined) { cuenta.saltados++; continue; }
  if (mapa.facturas[f.id]) { facturaPorWhmcs.set(String(f.id), mapa.facturas[f.id]); continue; }
  const cli = clientePorWhmcs.get(String(f.userid));
  const emitida = iso(f.date) ?? ahoraIso;
  const year = Number(emitida.slice(0, 4));
  const numero = nuevaProforma(year);
  const estado = ESTADO[f.status];
  const pagadaAt = estado === "pagada" ? (iso(f.datepaid) ?? emitida) : null;
  let numeroFactura = null;
  if (estado === "pagada") {
    const y = Number((pagadaAt ?? emitida).slice(0, 4));
    siguienteFiscal[y] = (siguienteFiscal[y] ?? 0) + 1;
    numeroFactura = `FACT-${y}-${String(siguienteFiscal[y]).padStart(3, "0")}`;
  }
  const items = (lineasPorFactura.get(String(f.id)) ?? []).map((l) => {
    const importe = round2(num(l.amount));
    return { concepto: String(l.description || "").split("\n")[0].slice(0, 120) || "Servicio", descripcion: String(l.description || "").split("\n").slice(1).join(" ").slice(0, 400), cantidad: 1, precioUnitario: importe, subtotal: importe, productId: null };
  });
  if (items.length === 0) items.push({ concepto: `Factura WHMCS #${f.invoicenum || f.id}`, descripcion: "", cantidad: 1, precioUnitario: round2(num(f.subtotal)), subtotal: round2(num(f.subtotal)), productId: null });
  const base = round2(items.reduce((s, l) => s + l.subtotal, 0));
  const inv = {
    id: randomUUID(),
    numero,
    numeroFactura,
    refPago: `VH${numero.split("-").pop()}`,
    metodoPago: METODO[String(f.paymentmethod || "").toLowerCase()] ?? null,
    pago: null,
    userId: cli?.userId ?? null,
    clienteEmail: cli?.email ?? "",
    clienteNombre: cli?.nombre ?? "",
    lineas: items,
    base,
    ivaPct: round2(num(f.taxrate)),
    total: round2(num(f.total)) || base,
    estado,
    emitidaAt: emitida,
    vencimientoAt: iso(f.duedate) ?? emitida,
    pagadaAt,
    notas: [`Importada de WHMCS (factura #${f.invoicenum || f.id}, estado ${f.status})`, f.notes ? String(f.notes).trim() : ""].filter(Boolean).join(" · "),
  };
  if (!cli) aviso(`Factura WHMCS #${f.invoicenum || f.id}: cliente ${f.userid} no importado; queda sin cliente vinculado.`);
  facturasLocal.push(inv);
  mapa.facturas[f.id] = inv.id;
  facturaPorWhmcs.set(String(f.id), inv.id);
  cuenta.facturas++;
}

/* ------------------------------- Servicios ------------------------------- */

const hostingIntents = leerJsonl("hosting-intents.jsonl");
const servidores = leerJsonl("servidores.jsonl");
const renovaciones = leerJsonl("renovaciones-vps.jsonl");
for (const s of servicios) {
  const activo = ["Active", "Suspended"].includes(s.domainstatus);
  if (!activo && !INCLUIR_TERMINADOS) { cuenta.saltados++; continue; }
  if (mapa.servicios[s.id]) continue;
  const cli = clientePorWhmcs.get(String(s.userid));
  if (!cli) { aviso(`Servicio WHMCS #${s.id} (${s.domain || "sin dominio"}): cliente ${s.userid} no importado; se salta.`); cuenta.saltados++; continue; }
  const prod = productoPorWhmcs.get(String(s.packageid)) ?? { planId: `whmcs-${s.packageid}`, nombre: "Servicio", tipo: "other", precio: 0 };
  const meses = MESES_CICLO[s.billingcycle] ?? 0;
  const importeMes = meses ? round2(num(s.amount) / meses) : 0;
  const hasta = iso(s.nextduedate);
  const esCpanel = ["hostingaccount", "reselleraccount"].includes(prod.tipo) && s.username;
  let servidorId;
  if (esCpanel) {
    const rec = {
      invoiceId: "",
      planId: prod.planId,
      cpanelPackage: String(productos.find((p) => String(p.id) === String(s.packageid))?.configoption1 || ""),
      userId: cli.userId,
      email: cli.email,
      nombre: cli.nombre,
      idioma: cli.idioma,
      requestedDomain: s.domain ? String(s.domain).toLowerCase() : null,
      creadoAt: iso(s.regdate) ?? ahoraIso,
      provisioned: true,
      cpanelUser: String(s.username),
      domain: s.domain ? String(s.domain).toLowerCase() : null,
      terminatedAt: activo ? null : ahoraIso,
    };
    hostingIntents.push(rec);
    servidorId = `hosting:${rec.cpanelUser}`;
    cuenta.hosting++;
  } else {
    const ficha = {
      id: randomUUID(),
      proveedor: "externo",
      remoteId: 0,
      remoteUuid: "",
      userId: cli.userId,
      etiqueta: String(s.domain || prod.nombre),
      host: String(s.dedicatedip || ""),
      notas: [`Importado de WHMCS (servicio #${s.id}, ${prod.nombre}, ${s.billingcycle || "?"}, estado ${s.domainstatus})`, s.username ? `usuario ${s.username}` : "", s.notes ? String(s.notes).trim() : ""].filter(Boolean).join(" · "),
      agenteTokenHash: null,
      agenteAltaAt: null,
      agenteAutoAt: null,
      creadoAt: iso(s.regdate) ?? ahoraIso,
      actualizadoAt: ahoraIso,
    };
    servidores.push(ficha);
    servidorId = ficha.id;
    cuenta.servidores++;
  }
  if (hasta && activo) {
    renovaciones.push({
      id: `manual-${randomUUID()}`,
      tipo: esCpanel ? "hosting" : "vps",
      servidorId,
      remoteId: 0,
      userId: cli.userId,
      invoiceId: "",
      periodoDesde: meses ? restarMeses(hasta, meses) : hasta,
      periodoHasta: hasta,
      importe: importeMes,
      planSlug: prod.planId,
      planNombre: prod.nombre,
      estado: "pagada",
      creadoAt: ahoraIso,
      pagadaAt: ahoraIso,
      nota: `Importado de WHMCS: ciclo ${s.billingcycle || "?"} (${num(s.amount)} ${monedaDefecto}), siguiente vencimiento ${String(s.nextduedate).slice(0, 10)}`,
    });
  } else if (activo) aviso(`Servicio WHMCS #${s.id} (${s.domain || prod.nombre}) sin fecha de vencimiento: no entra en renovaciones.`);
  if (activo && !meses) aviso(`Servicio WHMCS #${s.id} (${s.domain || prod.nombre}) con ciclo "${s.billingcycle}": importe mensual 0.`);
  mapa.servicios[s.id] = servidorId;
}

/* -------------------------------- Dominios ------------------------------- */

const domainIntents = leerJsonl("domain-intents.jsonl");
for (const d of dominios) {
  if (mapa.dominios[d.id]) continue;
  const activo = ["Active", "Pending Transfer", "Grace"].includes(d.status);
  if (!activo && !INCLUIR_TERMINADOS) { cuenta.saltados++; continue; }
  const cli = clientePorWhmcs.get(String(d.userid));
  if (!cli) { aviso(`Dominio ${d.domain}: cliente ${d.userid} no importado; se salta.`); cuenta.saltados++; continue; }
  domainIntents.push({
    invoiceId: "",
    domain: String(d.domain).toLowerCase(),
    years: Number(d.registrationperiod) || 1,
    userId: cli.userId,
    email: cli.email,
    idioma: cli.idioma,
    renewal: false,
    creadoAt: iso(d.registrationdate) ?? ahoraIso,
    registered: d.status === "Active",
    njallaName: null,
  });
  if (!vacio(d.expirydate)) aviso(`Dominio ${d.domain}: caduca el ${String(d.expirydate).slice(0, 10)} en el registrador "${d.registrar || "?"}" (esta web no guarda la caducidad; renovar allí).`);
  mapa.dominios[d.id] = String(d.domain).toLowerCase();
  cuenta.dominios++;
}

/* --------------------------------- Tickets ------------------------------- */

const ticketsLocal = leerJsonl("tickets.jsonl");
const siguienteTicket = {};
for (const t of ticketsLocal) {
  const m = /^TCK-(\d{4})-(\d+)$/.exec(t.numero || "");
  if (m) siguienteTicket[m[1]] = Math.max(siguienteTicket[m[1]] ?? 0, Number(m[2]));
}
const CAT_TICKET = (nombreDep) => (/factur|billing|pago|payment|ventas|sales/i.test(nombreDep) ? "facturacion" : /t[eé]cnic|support|soporte/i.test(nombreDep) ? "tecnico" : "otro");
const EST_TICKET = { Open: "abierto", "Customer-Reply": "abierto", Answered: "respondido", "On Hold": "respondido", "In Progress": "respondido", Closed: "cerrado" };
const respuestasPorTicket = new Map();
for (const r of respuestas) {
  if (!respuestasPorTicket.has(String(r.tid))) respuestasPorTicket.set(String(r.tid), []);
  respuestasPorTicket.get(String(r.tid)).push(r);
}
for (const t of [...tickets].sort((a, b) => String(a.date).localeCompare(String(b.date)))) {
  if (mapa.tickets[t.id]) continue;
  const cli = clientePorWhmcs.get(String(t.userid));
  if (!cli) { cuenta.saltados++; continue; }
  const creado = iso(t.date) ?? ahoraIso;
  const y = Number(creado.slice(0, 4));
  siguienteTicket[y] = (siguienteTicket[y] ?? 0) + 1;
  const mensajes = [{ id: randomUUID(), autor: "cliente", nombre: String(t.name || cli.nombre), cuerpo: String(t.message || ""), creadoAt: creado }];
  for (const r of (respuestasPorTicket.get(String(t.id)) ?? []).sort((a, b) => String(a.date).localeCompare(String(b.date)))) {
    const esSoporte = !!(r.admin && String(r.admin).trim());
    mensajes.push({ id: randomUUID(), autor: esSoporte ? "soporte" : "cliente", nombre: String(esSoporte ? r.admin : r.name || cli.nombre), cuerpo: String(r.message || ""), creadoAt: iso(r.date) ?? creado });
  }
  const tk = {
    id: randomUUID(),
    numero: `TCK-${y}-${String(siguienteTicket[y]).padStart(3, "0")}`,
    userId: cli.userId,
    clienteEmail: cli.email,
    clienteNombre: cli.nombre,
    asunto: String(t.title || `Ticket WHMCS ${t.tid}`),
    categoria: CAT_TICKET(departamentos.find((d) => String(d.id) === String(t.did))?.name || ""),
    servidorId: null,
    servidorEtiqueta: "",
    estado: EST_TICKET[t.status] ?? "cerrado",
    mensajes,
    creadoAt: creado,
    actualizadoAt: iso(t.lastreply) ?? mensajes[mensajes.length - 1].creadoAt,
  };
  ticketsLocal.push(tk);
  mapa.tickets[t.id] = tk.id;
  cuenta.tickets++;
}

/* --------------------------------- Informe ------------------------------- */

const informe = [
  `Importación WHMCS → ${DATA_DIR} (${APLICAR ? "APLICADA" : "SIMULACIÓN, nada escrito"})`,
  `  clientes nuevos: ${cuenta.clientes}   facturas: ${cuenta.facturas}   cuentas hosting: ${cuenta.hosting}   servidores (externos): ${cuenta.servidores}`,
  `  dominios: ${cuenta.dominios}   tickets: ${cuenta.tickets}   categorías: ${cuenta.categorias}   productos: ${cuenta.productos}   saltados: ${cuenta.saltados}`,
  ...(avisos.length ? ["  avisos:", ...avisos.map((a) => `   - ${a}`)] : []),
  ...(paraRestablecer.length ? [`  clientes que deben fijar contraseña por /recuperar (${paraRestablecer.length}): ver whmcs-import-clientes.csv`] : []),
];
console.log(informe.join("\n"));

if (APLICAR) {
  mkdirSync(DATA_DIR, { recursive: true });
  escribirJsonl("usuarios.jsonl", usuarios);
  escribirJsonl("facturas.jsonl", facturasLocal);
  escribirJsonl("hosting-intents.jsonl", hostingIntents);
  escribirJsonl("servidores.jsonl", servidores);
  escribirJsonl("renovaciones-vps.jsonl", renovaciones);
  escribirJsonl("domain-intents.jsonl", domainIntents);
  escribirJsonl("tickets.jsonl", ticketsLocal);
  escribirAtomico(CAT_FILE, JSON.stringify(catalogo, null, 2) + "\n");
  escribirAtomico(MAPA_FILE, JSON.stringify(mapa, null, 2) + "\n");
  if (paraRestablecer.length) escribirAtomico(path.join(DATA_DIR, "whmcs-import-clientes.csv"), "email\n" + paraRestablecer.join("\n") + "\n");
  escribirAtomico(path.join(DATA_DIR, "whmcs-import-informe.txt"), informe.join("\n") + "\n");
  console.log(`✓ Escrito en ${DATA_DIR}`);
} else {
  console.log("\n(simulación) Repite con --aplicar para escribir los datos.");
}

if (dbTemporal && !flag("conservar-bd")) mysql(`DROP DATABASE \`${dbName}\``);
