"use client";

import { useEffect, useRef, useState } from "react";
import { useCart } from "@/lib/cart";
import { cn } from "@/lib/utils";

/**
 * Botón "Add to cart" para las tarjetas de plan. Añade el plan al carrito y
 * muestra feedback temporal ("Added ✓") sin sacar al usuario de la página.
 */
export function AddToCartButton({
  planId,
  className,
  variant = "primary",
}: {
  planId: string;
  className?: string;
  variant?: "primary" | "outline";
}) {
  const { add } = useCart();
  const [added, setAdded] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function onClick() {
    add(planId);
    setAdded(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setAdded(false), 1600);
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-live="polite"
      className={cn(
        "inline-flex items-center justify-center rounded-[var(--radius-md)] px-5 py-3 text-sm font-medium transition-all",
        variant === "primary"
          ? "bg-[var(--color-accent)] text-black hover:bg-[var(--color-accent-dim)]"
          : "border border-[var(--color-line-strong)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]",
        className
      )}
    >
      {added ? "Added ✓" : "Add to cart"}
    </button>
  );
}
