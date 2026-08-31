import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

/**
 * Cifrado de las copias de seguridad.
 *
 * Un backup lleva DENTRO todos los secretos del servicio (claves de sesión del
 * `.env`, hashes de contraseñas de clientes, tokens de agente, facturas) y se
 * sube a un tercero (Dropbox / un SFTP ajeno). Por eso NUNCA sale en claro: se
 * cifra con AES-256-GCM y una clave derivada de una frase de paso.
 *
 * GCM además autentica: si el fichero llega corrupto o alguien lo manipula, el
 * descifrado falla en vez de devolver basura. Eso da también un chequeo de
 * integridad gratis para el `restore`.
 *
 * IMPORTANTE — el formato de este fichero lo replica a mano `scripts/restaurar.mjs`
 * (el restore corre en un servidor recién levantado, sin build ni node_modules
 * de la app). Si cambias la cabecera, los parámetros de scrypt o el algoritmo,
 * cambia también el script o los backups viejos dejarán de poder restaurarse.
 */

/** Cabecera mágica + versión de formato. 4 bytes ASCII + 1 byte de versión. */
const MAGIC = Buffer.from("VHBK", "ascii");
const VERSION = 1;
const SALT_LEN = 16;
const IV_LEN = 12; // recomendado para GCM
const TAG_LEN = 16;

/**
 * Parámetros de scrypt. N=2^14 mantiene el coste de derivación por debajo de
 * los 32 MB de `maxmem` por defecto de Node (128·N·r = 16,7 MB) y aun así hace
 * caro el ataque por diccionario contra la frase de paso.
 */
const SCRYPT = { N: 16384, r: 8, p: 1 } as const;
const KEY_LEN = 32; // AES-256

function derivarClave(passphrase: string, salt: Buffer): Buffer {
  return scryptSync(passphrase, salt, KEY_LEN, { ...SCRYPT });
}

/**
 * Cifra `plano` con la frase de paso. El resultado es autocontenido:
 *
 *   MAGIC(4) · VERSION(1) · salt(16) · iv(12) · tag(16) · ciphertext
 *
 * salt e iv son aleatorios por backup, así que dos copias del mismo contenido
 * nunca dan el mismo fichero.
 */
export function cifrar(plano: Buffer, passphrase: string): Buffer {
  if (!passphrase) throw new Error("Falta la frase de paso para cifrar el backup.");
  const salt = randomBytes(SALT_LEN);
  const iv = randomBytes(IV_LEN);
  const clave = derivarClave(passphrase, salt);
  const cipher = createCipheriv("aes-256-gcm", clave, iv);
  const cuerpo = Buffer.concat([cipher.update(plano), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([MAGIC, Buffer.from([VERSION]), salt, iv, tag, cuerpo]);
}

/**
 * Descifra un fichero producido por `cifrar`. Lanza si la frase es incorrecta,
 * el formato no es el esperado o el contenido está manipulado/corrupto (GCM).
 */
export function descifrar(fichero: Buffer, passphrase: string): Buffer {
  if (!passphrase) throw new Error("Falta la frase de paso para descifrar el backup.");
  let o = 0;
  if (fichero.length < MAGIC.length + 1 + SALT_LEN + IV_LEN + TAG_LEN) {
    throw new Error("El fichero de backup es demasiado corto o no es un backup.");
  }
  if (!fichero.subarray(0, MAGIC.length).equals(MAGIC)) {
    throw new Error("El fichero no es un backup de viahost (cabecera desconocida).");
  }
  o += MAGIC.length;
  const version = fichero[o]!;
  o += 1;
  if (version !== VERSION) {
    throw new Error(`Versión de backup no soportada: ${version}.`);
  }
  const salt = fichero.subarray(o, (o += SALT_LEN));
  const iv = fichero.subarray(o, (o += IV_LEN));
  const tag = fichero.subarray(o, (o += TAG_LEN));
  const cuerpo = fichero.subarray(o);
  const clave = derivarClave(passphrase, salt);
  const decipher = createDecipheriv("aes-256-gcm", clave, iv);
  decipher.setAuthTag(tag);
  try {
    return Buffer.concat([decipher.update(cuerpo), decipher.final()]);
  } catch {
    // `final()` falla si el tag no cuadra: frase incorrecta o fichero alterado.
    throw new Error("No se pudo descifrar: la frase de paso es incorrecta o el fichero está dañado.");
  }
}

/** Extensión de los backups cifrados (informativa; el formato va en la cabecera). */
export const EXT_BACKUP = ".vhbk";
