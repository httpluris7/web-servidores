/**
 * Crea (o actualiza la contraseña de) una cuenta de administrador en
 * `data/usuarios.jsonl`, con el MISMO formato de hash scrypt que usa
 * `src/lib/auth.ts`. Recuerda añadir el email a `ADMIN_EMAILS` en `.env`.
 *
 * Uso:
 *   node scripts/crear-admin.mjs <email> <password> ["Nombre" "Apellidos"]
 *
 * Ejemplo:
 *   node scripts/crear-admin.mjs administrador@cosmosdata.es 'TuClave!2026'
 */
import { randomBytes, randomUUID, scryptSync } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";

const [, , emailArg, password, nombre = "Administrador", apellidos = ""] = process.argv;

if (!emailArg || !password) {
  console.error('Uso: node scripts/crear-admin.mjs <email> <password> ["Nombre" "Apellidos"]');
  process.exit(1);
}

const email = emailArg.trim().toLowerCase();

// Política de contraseña (espejo de src/lib/password.ts).
const rules = [
  [password.length >= 8, "mínimo 8 caracteres"],
  [/[A-Z]/.test(password), "una letra mayúscula"],
  [/[0-9]/.test(password), "un número"],
  [/[^A-Za-z0-9]/.test(password), "un símbolo especial"],
];
const failed = rules.filter(([ok]) => !ok).map(([, msg]) => msg);
if (failed.length) {
  console.error("Contraseña no válida. Falta: " + failed.join(", ") + ".");
  process.exit(1);
}

function hashPassword(pw) {
  const salt = randomBytes(16);
  const derived = scryptSync(pw, salt, 64);
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "usuarios.jsonl");
mkdirSync(DATA_DIR, { recursive: true });

const lines = existsSync(FILE)
  ? readFileSync(FILE, "utf8").split("\n").filter((l) => l.trim())
  : [];
const users = lines.map((l) => JSON.parse(l));

const existing = users.find((u) => String(u.email).toLowerCase() === email);

if (existing) {
  // Solo actualizamos la contraseña de la cuenta ya existente.
  existing.passwordHash = hashPassword(password);
  const out = users.map((u) => JSON.stringify(u)).join("\n") + "\n";
  writeFileSync(FILE, out, "utf8");
  console.log(`✓ Contraseña actualizada para la cuenta existente: ${email}`);
} else {
  const user = {
    id: randomUUID(),
    nombre,
    apellidos,
    direccion: "",
    ciudad: "",
    pais: "",
    telefono: "",
    codigoPostal: "",
    email,
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString(),
  };
  writeFileSync(FILE, (lines.length ? "" : "") + JSON.stringify(user) + "\n", {
    encoding: "utf8",
    flag: "a",
  });
  console.log(`✓ Cuenta de administrador creada: ${email}`);
}

console.log("→ Asegúrate de que ADMIN_EMAILS incluye este email en .env y reinicia la app.");
