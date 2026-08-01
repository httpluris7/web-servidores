"use client";

/**
 * Carrito de la compra — estado global en cliente, persistido en localStorage.
 *
 * Solo se almacena lo mínimo y estable por línea: `{ planId, qty, region }`.
 * Los datos visibles (nombre, precio, specs, línea de producto) se derivan en
 * cada render desde el catálogo, de modo que este es la única fuente de verdad
 * y nunca se sirven precios obsoletos guardados en el navegador.
 *
 * El catálogo se edita desde `/admin/catalogo` y se lee del disco, así que
 * entra por prop desde el layout (`getCartCatalog`) en vez de importarse aquí.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CartCatalog, LocatedPlan, Plan } from "@/data/products";

const STORAGE_KEY = "vh_cart";
const MAX_QTY = 99;

export type CartLine = { planId: string; qty: number; region?: string };

/** Línea del carrito resuelta contra el catálogo, lista para pintar. */
export type ResolvedLine = {
  planId: string;
  qty: number;
  region?: string;
  plan: Plan;
  lineTitle: string;
  lineSlug: string;
  isVps: boolean;
  subtotal: number;
};

type CartContextValue = {
  /** Líneas crudas (lo persistido). */
  items: CartLine[];
  /** Líneas resueltas contra el catálogo (descarta planes que ya no existen). */
  lines: ResolvedLine[];
  /** Suma de cantidades (para el badge del header). */
  count: number;
  /** Total mensual del carrito en euros. */
  total: number;
  /** true cuando ya se hidrató desde localStorage (evita parpadeo/SSR mismatch). */
  ready: boolean;
  add: (planId: string, opts?: { region?: string; qty?: number }) => void;
  remove: (planId: string) => void;
  setQty: (planId: string, qty: number) => void;
  setRegion: (planId: string, region: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

function clampQty(qty: number): number {
  if (!Number.isFinite(qty)) return 1;
  return Math.min(MAX_QTY, Math.max(1, Math.floor(qty)));
}

export function CartProvider({
  catalog,
  children,
}: {
  catalog: CartCatalog;
  children: React.ReactNode;
}) {
  const [items, setItems] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);

  const porId = useMemo(
    () => new Map<string, LocatedPlan>(catalog.plans.map((p) => [p.plan.id, p])),
    [catalog]
  );

  // Los callbacks y las suscripciones se crean una sola vez y leen el catálogo
  // por referencia, para no tener que recrearse si este cambia.
  const porIdRef = useRef(porId);
  const defaultRegionRef = useRef(catalog.defaultRegion);
  useEffect(() => {
    porIdRef.current = porId;
    defaultRegionRef.current = catalog.defaultRegion;
  }, [porId, catalog.defaultRegion]);

  /** Descarta lo que no sea una línea válida de un plan que siga existiendo. */
  const sanitize = useCallback((raw: unknown): CartLine[] => {
    if (!Array.isArray(raw)) return [];
    const out: CartLine[] = [];
    for (const it of raw) {
      if (!it || typeof it !== "object") continue;
      const planId = (it as CartLine).planId;
      if (typeof planId !== "string" || !porIdRef.current.has(planId)) continue;
      if (out.some((l) => l.planId === planId)) continue; // una línea por plan
      const region =
        typeof (it as CartLine).region === "string" ? (it as CartLine).region : undefined;
      out.push({ planId, qty: clampQty((it as CartLine).qty), region });
    }
    return out;
  }, []);

  // Hidratar desde localStorage una sola vez, en cliente.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(sanitize(JSON.parse(raw)));
    } catch {
      // localStorage corrupto o no disponible: arrancamos con carrito vacío.
    }
    setReady(true);
  }, [sanitize]);

  // Persistir en cada cambio (solo tras hidratar, para no pisar lo guardado).
  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Sin persistencia (modo privado, cuota llena): el carrito sigue en memoria.
    }
  }, [items, ready]);

  // Sincroniza el carrito entre pestañas del mismo origen.
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== STORAGE_KEY) return;
      try {
        setItems(sanitize(e.newValue ? JSON.parse(e.newValue) : []));
      } catch {
        setItems([]);
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [sanitize]);

  const add = useCallback<CartContextValue["add"]>((planId, opts) => {
    const located = porIdRef.current.get(planId);
    if (!located) return;
    const addQty = clampQty(opts?.qty ?? 1);
    const region =
      opts?.region ??
      (located.lineTipo === "vps" ? defaultRegionRef.current ?? undefined : undefined);
    setItems((prev) => {
      const existing = prev.find((l) => l.planId === planId);
      if (existing) {
        return prev.map((l) => (l.planId === planId ? { ...l, qty: clampQty(l.qty + addQty) } : l));
      }
      return [...prev, { planId, qty: addQty, region }];
    });
  }, []);

  const remove = useCallback<CartContextValue["remove"]>((planId) => {
    setItems((prev) => prev.filter((l) => l.planId !== planId));
  }, []);

  const setQty = useCallback<CartContextValue["setQty"]>((planId, qty) => {
    setItems((prev) => prev.map((l) => (l.planId === planId ? { ...l, qty: clampQty(qty) } : l)));
  }, []);

  const setRegion = useCallback<CartContextValue["setRegion"]>((planId, region) => {
    setItems((prev) => prev.map((l) => (l.planId === planId ? { ...l, region } : l)));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const value = useMemo<CartContextValue>(() => {
    const lines: ResolvedLine[] = items.flatMap((l) => {
      const located = porId.get(l.planId);
      if (!located) return [];
      const isVps = located.lineTipo === "vps";
      return [
        {
          planId: l.planId,
          qty: l.qty,
          region: isVps ? l.region : undefined,
          plan: located.plan,
          lineTitle: located.lineTitle,
          lineSlug: located.lineSlug,
          isVps,
          subtotal: located.plan.price * l.qty,
        },
      ];
    });
    return {
      items,
      lines,
      count: items.reduce((n, l) => n + l.qty, 0),
      total: lines.reduce((sum, l) => sum + l.subtotal, 0),
      ready,
      add,
      remove,
      setQty,
      setRegion,
      clear,
    };
  }, [items, porId, ready, add, remove, setQty, setRegion, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}
