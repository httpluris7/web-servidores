/**
 * Codificador QR mínimo (ISO/IEC 18004) → SVG, sin dependencias.
 *
 * Solo lo que necesita el alta de 2FA: modo byte, corrección de errores nivel
 * M, versiones 1–15 (hasta 415 bytes; un `otpauth://` ronda los 120). Elige la
 * máscara por penalización como manda la norma. El algoritmo sigue la
 * estructura de referencia de Nayuki (dominio público), reescrita en TS.
 */

type Ec = [ecPorBloque: number, g1Bloques: number, g1Cw: number, g2Bloques: number, g2Cw: number];

/** Tabla de bloques para nivel M, versiones 1..15. */
const EC_M: Ec[] = [
  [10, 1, 16, 0, 0],
  [16, 1, 28, 0, 0],
  [26, 1, 44, 0, 0],
  [18, 2, 32, 0, 0],
  [24, 2, 43, 0, 0],
  [16, 4, 27, 0, 0],
  [18, 4, 31, 0, 0],
  [22, 2, 38, 2, 39],
  [22, 3, 36, 2, 37],
  [26, 4, 43, 1, 44],
  [30, 1, 50, 4, 51],
  [22, 6, 36, 2, 37],
  [22, 8, 37, 1, 38],
  [24, 4, 40, 5, 41],
  [24, 5, 41, 5, 42],
];

/* ------------------------------ GF(256) / RS ------------------------------ */

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]!;
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return EXP[LOG[a]! + LOG[b]!]!;
}

function rsGenerador(grado: number): number[] {
  let g = [1];
  for (let i = 0; i < grado; i++) {
    const n = new Array<number>(g.length + 1).fill(0);
    for (let j = 0; j < g.length; j++) {
      n[j] = n[j]! ^ g[j]!;
      n[j + 1] = n[j + 1]! ^ gfMul(g[j]!, EXP[i]!);
    }
    g = n;
  }
  return g;
}

function rsResto(datos: number[], grado: number): number[] {
  const gen = rsGenerador(grado);
  const msg = [...datos, ...new Array<number>(grado).fill(0)];
  for (let i = 0; i < datos.length; i++) {
    const c = msg[i]!;
    if (c === 0) continue;
    for (let j = 0; j < gen.length; j++) msg[i + j] = msg[i + j]! ^ gfMul(gen[j]!, c);
  }
  return msg.slice(datos.length);
}

/* --------------------------------- bits ---------------------------------- */

function empaquetar(bytes: Uint8Array, version: number): number[] {
  const [ec, g1n, g1cw, g2n, g2cw] = EC_M[version - 1]!;
  const dataCw = g1n * g1cw + g2n * g2cw;
  const bits: number[] = [];
  const push = (v: number, n: number) => {
    for (let i = n - 1; i >= 0; i--) bits.push((v >>> i) & 1);
  };
  push(0b0100, 4); // modo byte
  push(bytes.length, version >= 10 ? 16 : 8);
  for (const b of bytes) push(b, 8);
  push(0, Math.min(4, dataCw * 8 - bits.length)); // terminador
  while (bits.length % 8 !== 0) bits.push(0);
  for (let pad = 0xec; bits.length < dataCw * 8; pad ^= 0xec ^ 0x11) push(pad, 8);

  const cw: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let v = 0;
    for (let j = 0; j < 8; j++) v = (v << 1) | bits[i + j]!;
    cw.push(v);
  }

  // Bloques + corrección de errores, intercalados.
  const bloques: number[][] = [];
  const ecs: number[][] = [];
  let p = 0;
  for (let b = 0; b < g1n + g2n; b++) {
    const len = b < g1n ? g1cw : g2cw;
    const datos = cw.slice(p, p + len);
    p += len;
    bloques.push(datos);
    ecs.push(rsResto(datos, ec));
  }
  const out: number[] = [];
  const maxCw = Math.max(g1cw, g2cw);
  for (let i = 0; i < maxCw; i++) for (const b of bloques) if (i < b.length) out.push(b[i]!);
  for (let i = 0; i < ec; i++) for (const e of ecs) out.push(e[i]!);
  return out;
}

/* -------------------------------- matriz --------------------------------- */

class Matriz {
  readonly size: number;
  readonly mod: Uint8Array;
  readonly fn: Uint8Array;
  constructor(size: number) {
    this.size = size;
    this.mod = new Uint8Array(size * size);
    this.fn = new Uint8Array(size * size);
  }
  get(x: number, y: number): number {
    return this.mod[y * this.size + x]!;
  }
  setFn(x: number, y: number, oscuro: boolean): void {
    this.mod[y * this.size + x] = oscuro ? 1 : 0;
    this.fn[y * this.size + x] = 1;
  }
}

function posicionesAlineacion(version: number): number[] {
  if (version === 1) return [];
  const n = Math.floor(version / 7) + 2;
  const size = version * 4 + 17;
  const paso = Math.ceil((version * 4 + 4) / (n * 2 - 2)) * 2;
  const out = [6];
  for (let pos = size - 7; out.length < n; pos -= paso) out.splice(1, 0, pos);
  return out;
}

function dibujarFinder(m: Matriz, cx: number, cy: number): void {
  for (let dy = -4; dy <= 4; dy++)
    for (let dx = -4; dx <= 4; dx++) {
      const x = cx + dx;
      const y = cy + dy;
      if (x < 0 || y < 0 || x >= m.size || y >= m.size) continue;
      const d = Math.max(Math.abs(dx), Math.abs(dy));
      m.setFn(x, y, d !== 2 && d !== 4);
    }
}

function dibujarAlineacion(m: Matriz, cx: number, cy: number): void {
  for (let dy = -2; dy <= 2; dy++)
    for (let dx = -2; dx <= 2; dx++) m.setFn(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
}

function dibujarFormato(m: Matriz, mascara: number): void {
  const data = (0 << 3) | mascara; // nivel M = 00
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  const bits = ((data << 10) | rem) ^ 0x5412;
  const bit = (i: number) => ((bits >>> i) & 1) === 1;
  const s = m.size;
  for (let i = 0; i <= 5; i++) m.setFn(8, i, bit(i));
  m.setFn(8, 7, bit(6));
  m.setFn(8, 8, bit(7));
  m.setFn(7, 8, bit(8));
  for (let i = 9; i < 15; i++) m.setFn(14 - i, 8, bit(i));
  for (let i = 0; i < 8; i++) m.setFn(s - 1 - i, 8, bit(i));
  for (let i = 8; i < 15; i++) m.setFn(8, s - 15 + i, bit(i));
  m.setFn(8, s - 8, true); // módulo oscuro fijo
}

function dibujarVersion(m: Matriz, version: number): void {
  if (version < 7) return;
  let rem = version;
  for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
  const bits = (version << 12) | rem;
  for (let i = 0; i < 18; i++) {
    const b = ((bits >>> i) & 1) === 1;
    const a = m.size - 11 + (i % 3);
    const c = Math.floor(i / 3);
    m.setFn(a, c, b);
    m.setFn(c, a, b);
  }
}

function dibujarPatrones(m: Matriz, version: number): void {
  const s = m.size;
  for (let i = 0; i < s; i++) {
    m.setFn(6, i, i % 2 === 0);
    m.setFn(i, 6, i % 2 === 0);
  }
  dibujarFinder(m, 3, 3);
  dibujarFinder(m, s - 4, 3);
  dibujarFinder(m, 3, s - 4);
  const al = posicionesAlineacion(version);
  const n = al.length;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0)) continue;
      dibujarAlineacion(m, al[i]!, al[j]!);
    }
  dibujarFormato(m, 0); // reserva; se reescribe con la máscara elegida
  dibujarVersion(m, version);
}

function colocarDatos(m: Matriz, cw: number[]): void {
  const s = m.size;
  let i = 0;
  const total = cw.length * 8;
  for (let right = s - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < s; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const arriba = ((right + 1) & 2) === 0;
        const y = arriba ? s - 1 - vert : vert;
        if (!m.fn[y * s + x] && i < total) {
          m.mod[y * s + x] = (cw[i >>> 3]! >>> (7 - (i & 7))) & 1;
          i++;
        }
      }
    }
  }
}

function mascara(k: number, x: number, y: number): boolean {
  switch (k) {
    case 0: return (x + y) % 2 === 0;
    case 1: return y % 2 === 0;
    case 2: return x % 3 === 0;
    case 3: return (x + y) % 3 === 0;
    case 4: return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
    case 5: return ((x * y) % 2) + ((x * y) % 3) === 0;
    case 6: return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
    default: return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
  }
}

function aplicarMascara(m: Matriz, k: number): void {
  const s = m.size;
  for (let y = 0; y < s; y++)
    for (let x = 0; x < s; x++) if (!m.fn[y * s + x] && mascara(k, x, y)) m.mod[y * s + x] = m.mod[y * s + x]! ^ 1;
}

function penalizacion(m: Matriz): number {
  const s = m.size;
  let p = 0;
  const linea = (get: (i: number) => number) => {
    let run = 0;
    let prev = -1;
    const hist: number[] = [];
    for (let i = 0; i < s; i++) {
      const v = get(i);
      if (v === prev) run++;
      else {
        hist.push(run);
        run = 1;
        prev = v;
      }
    }
    hist.push(run);
    for (let i = 1; i < hist.length; i++) if (hist[i]! >= 5) p += 3 + hist[i]! - 5;
    // Patrón tipo finder 1:1:3:1:1 con 4 claros a un lado.
    for (let i = 1; i + 4 < hist.length; i++) {
      const [a, b, c, d, e] = [hist[i]!, hist[i + 1]!, hist[i + 2]!, hist[i + 3]!, hist[i + 4]!];
      const oscuroPrimero = (i % 2 === 1) === (get(0) === 1);
      if (oscuroPrimero && a === b && b === d && d === e && c === 3 * a) {
        const antes = i >= 2 ? hist[i - 1]! : 0;
        const despues = i + 5 < hist.length ? hist[i + 5]! : 0;
        if (antes >= 4 * a || despues >= 4 * a) p += 40;
      }
    }
  };
  for (let y = 0; y < s; y++) linea((x) => m.get(x, y));
  for (let x = 0; x < s; x++) linea((y) => m.get(x, y));
  for (let y = 0; y + 1 < s; y++)
    for (let x = 0; x + 1 < s; x++) {
      const v = m.get(x, y);
      if (v === m.get(x + 1, y) && v === m.get(x, y + 1) && v === m.get(x + 1, y + 1)) p += 3;
    }
  let oscuros = 0;
  for (const v of m.mod) oscuros += v;
  const total = s * s;
  p += Math.floor(Math.abs(oscuros * 20 - total * 10) / total) * 10;
  return p;
}

/* --------------------------------- API ----------------------------------- */

export function qrMatriz(texto: string): { size: number; mod: Uint8Array } {
  const bytes = new TextEncoder().encode(texto);
  let version = 0;
  for (let v = 1; v <= EC_M.length; v++) {
    const [, g1n, g1cw, g2n, g2cw] = EC_M[v - 1]!;
    const capBits = (g1n * g1cw + g2n * g2cw) * 8;
    if (4 + (v >= 10 ? 16 : 8) + bytes.length * 8 <= capBits) {
      version = v;
      break;
    }
  }
  if (!version) throw new Error("Texto demasiado largo para el QR (máx. 415 bytes).");

  const cw = empaquetar(bytes, version);
  const m = new Matriz(version * 4 + 17);
  dibujarPatrones(m, version);
  colocarDatos(m, cw);

  let mejor = 0;
  let mejorP = Infinity;
  for (let k = 0; k < 8; k++) {
    aplicarMascara(m, k);
    dibujarFormato(m, k);
    const p = penalizacion(m);
    if (p < mejorP) {
      mejorP = p;
      mejor = k;
    }
    aplicarMascara(m, k); // deshacer (XOR)
  }
  aplicarMascara(m, mejor);
  dibujarFormato(m, mejor);
  return { size: m.size, mod: m.mod };
}

/** SVG cuadrado con zona de silencio de 4 módulos; escala con `width`/CSS. */
export function qrSvg(texto: string, { margen = 4 }: { margen?: number } = {}): string {
  const { size, mod } = qrMatriz(texto);
  const total = size + margen * 2;
  let d = "";
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) if (mod[y * size + x]) d += `M${x + margen} ${y + margen}h1v1h-1z`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges" role="img" aria-label="QR">` +
    `<rect width="${total}" height="${total}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`
  );
}
