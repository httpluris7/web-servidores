"use client";

import { passwordRules, failedPasswordRules } from "@/lib/password";

/**
 * Lista de requisitos de contraseña con feedback en vivo (✓/○).
 * Compartida por los formularios de cambio/restablecimiento de contraseña.
 */
export function PasswordRulesList({ password }: { password: string }) {
  const failed = new Set(failedPasswordRules(password));
  return (
    <ul className="mt-2 grid gap-1 sm:grid-cols-2">
      {passwordRules.map((rule) => {
        const ok = password.length > 0 && !failed.has(rule.key);
        return (
          <li
            key={rule.key}
            className={
              "flex items-center gap-2 font-mono text-xs " +
              (ok ? "text-[var(--color-accent)]" : "text-[var(--color-fg-dim)]")
            }
          >
            <span aria-hidden="true">{ok ? "✓" : "○"}</span>
            {rule.label}
          </li>
        );
      })}
    </ul>
  );
}
