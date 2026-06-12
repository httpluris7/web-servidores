/**
 * Reglas de validación compartidas entre cliente y servidor.
 *
 * Este módulo NO importa nada de Node (fs/crypto), por lo que es seguro
 * importarlo desde componentes cliente (formularios) y desde las rutas API.
 */

export type PasswordRule = { key: string; label: string; test: (pw: string) => boolean };

/**
 * Política de contraseña: mínimo 8 caracteres, alfanumérica (letra + número)
 * con al menos una mayúscula y un símbolo especial.
 */
export const passwordRules: PasswordRule[] = [
  { key: "length", label: "At least 8 characters", test: (p) => p.length >= 8 },
  { key: "upper", label: "One uppercase letter", test: (p) => /[A-Z]/.test(p) },
  { key: "number", label: "One number", test: (p) => /[0-9]/.test(p) },
  { key: "special", label: "One symbol (!@#$…)", test: (p) => /[^A-Za-z0-9]/.test(p) },
];

/** Devuelve las claves de las reglas que NO cumple la contraseña. */
export function failedPasswordRules(pw: string): string[] {
  return passwordRules.filter((r) => !r.test(pw)).map((r) => r.key);
}

/** Una contraseña es válida cuando cumple todas las reglas. */
export function isPasswordValid(pw: string): boolean {
  return failedPasswordRules(pw).length === 0;
}

/** Validación de email razonable (no exhaustiva, pero suficiente). */
export const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Teléfono: dígitos, espacios, +, -, paréntesis; entre 7 y 20 dígitos. */
export function isPhoneValid(value: string): boolean {
  const digits = value.replace(/[^0-9]/g, "");
  return /^[+0-9()\s-]+$/.test(value) && digits.length >= 7 && digits.length <= 20;
}
