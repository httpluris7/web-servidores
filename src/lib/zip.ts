import { deflateRawSync } from "node:zlib";

/**
 * Constructor mínimo de ficheros ZIP, sin dependencias externas (misma
 * filosofía que el resto de `lib/`: el proyecto vive con las cuatro
 * dependencias que ya tiene). Formato clásico de 32 bits —sin ZIP64—, que es
 * de sobra para un lote de facturas: el límite práctico son 65 535 ficheros y
 * 4 GB, y la ruta de descarga corta mucho antes.
 *
 * Cada entrada se guarda con deflate salvo que comprimir no compense, en cuyo
 * caso se almacena tal cual (los PDF ya vienen comprimidos por dentro).
 */

const TABLA_CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = TABLA_CRC[(c ^ buf[i]!) & 0xff]! ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

/** Hora y fecha en formato MS-DOS (lo que el ZIP guarda por cada entrada). */
function dosFecha(d: Date): { hora: number; fecha: number } {
  const year = Math.max(1980, d.getFullYear());
  return {
    hora: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    fecha: ((year - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

export type ZipEntry = {
  /** Ruta dentro del zip (se guarda en UTF-8). */
  name: string;
  data: Buffer;
  /** Fecha de modificación; por defecto, la de creación del zip. */
  date?: Date;
};

export function createZip(entries: ZipEntry[]): Buffer {
  const ahora = new Date();
  const locales: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nombre = Buffer.from(entry.name, "utf8");
    const crc = crc32(entry.data);
    const comprimido = deflateRawSync(entry.data, { level: 6 });
    // Si deflate no gana nada (PDF, sobre todo), guardamos sin comprimir.
    const usaDeflate = comprimido.length < entry.data.length;
    const cuerpo = usaDeflate ? comprimido : entry.data;
    const metodo = usaDeflate ? 8 : 0;
    const { hora, fecha } = dosFecha(entry.date ?? ahora);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); // firma
    local.writeUInt16LE(20, 4); // versión necesaria
    local.writeUInt16LE(0x0800, 6); // bandera: nombres en UTF-8
    local.writeUInt16LE(metodo, 8);
    local.writeUInt16LE(hora, 10);
    local.writeUInt16LE(fecha, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(cuerpo.length, 18);
    local.writeUInt32LE(entry.data.length, 22);
    local.writeUInt16LE(nombre.length, 26);
    local.writeUInt16LE(0, 28); // sin campo extra
    locales.push(local, nombre, cuerpo);

    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4); // versión que lo creó
    cd.writeUInt16LE(20, 6); // versión necesaria
    cd.writeUInt16LE(0x0800, 8);
    cd.writeUInt16LE(metodo, 10);
    cd.writeUInt16LE(hora, 12);
    cd.writeUInt16LE(fecha, 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(cuerpo.length, 20);
    cd.writeUInt32LE(entry.data.length, 24);
    cd.writeUInt16LE(nombre.length, 28);
    cd.writeUInt16LE(0, 30); // extra
    cd.writeUInt16LE(0, 32); // comentario
    cd.writeUInt16LE(0, 34); // disco
    cd.writeUInt16LE(0, 36); // atributos internos
    cd.writeUInt32LE(0, 38); // atributos externos
    cd.writeUInt32LE(offset, 42); // dónde empieza la cabecera local
    central.push(cd, nombre);

    offset += local.length + nombre.length + cuerpo.length;
  }

  const directorio = Buffer.concat(central);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0);
  fin.writeUInt16LE(0, 4); // nº de disco
  fin.writeUInt16LE(0, 6); // disco del directorio
  fin.writeUInt16LE(entries.length, 8);
  fin.writeUInt16LE(entries.length, 10);
  fin.writeUInt32LE(directorio.length, 12);
  fin.writeUInt32LE(offset, 16);
  fin.writeUInt16LE(0, 20); // sin comentario

  return Buffer.concat([...locales, directorio, fin]);
}

/** Deja un nombre de fichero seguro para meterlo en el zip. */
export function nombreSeguro(raw: string, porDefecto = "archivo"): string {
  const limpio = raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // marcas diacríticas sueltas tras el NFD
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 100);
  return limpio || porDefecto;
}
