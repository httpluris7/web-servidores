"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onLogout() {
    setBusy(true);
    try {
      await fetch("/api/logout", { method: "POST" });
      router.push("/acceder");
      router.refresh();
    } catch {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onLogout}
      disabled={busy}
      className="inline-flex items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-line-strong)] px-5 py-2.5 text-sm font-medium text-[var(--color-fg)] transition-colors hover:border-[var(--color-danger)] hover:text-[var(--color-danger)] disabled:opacity-60"
    >
      {busy ? "Logging out…" : "Log out"}
    </button>
  );
}
