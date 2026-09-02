import "server-only";
import { randomInt } from "node:crypto";

/**
 * Contraseña fuerte para cPanel: 20 caracteres con las 4 clases (mayús, minús,
 * dígito, símbolo), garantizando al menos una de cada y barajando el resto con
 * aleatoriedad criptográfica. Se usa tanto en el alta como en el reset.
 */
export function generarPasswordCpanel(): string {
  const U = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const L = "abcdefghijkmnpqrstuvwxyz";
  const D = "23456789";
  const S = "!@#%^*-_=+";
  const todos = U + L + D + S;
  const pick = (set: string) => set[randomInt(set.length)];
  const chars = [pick(U), pick(L), pick(D), pick(S)];
  while (chars.length < 20) chars.push(pick(todos));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}
