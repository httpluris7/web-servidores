"use client";

import Link from "next/link";
import { useCart } from "@/lib/cart";

/** Icono de carrito (outline). */
function CartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-5 w-5" aria-hidden="true">
      <path d="M3 4h2l2.4 11.2a1.5 1.5 0 0 0 1.47 1.2h7.86a1.5 1.5 0 0 0 1.47-1.18L21 8H6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="9.5" cy="20" r="1.2" />
      <circle cx="17.5" cy="20" r="1.2" />
    </svg>
  );
}

/** Botón del header: enlaza al carrito y muestra un badge con la cantidad. */
export function CartButton() {
  const { count, ready } = useCart();
  const show = ready && count > 0;

  return (
    <Link
      href="/carrito"
      aria-label={show ? `Cart, ${count} item${count === 1 ? "" : "s"}` : "Cart"}
      className="relative flex h-10 w-10 items-center justify-center rounded-full border border-[var(--color-line-strong)] text-[var(--color-fg-muted)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-fg)]"
    >
      <CartIcon />
      {show && (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--color-accent)] px-1 font-mono text-[0.6rem] font-semibold text-black">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
