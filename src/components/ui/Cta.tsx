import Link from "next/link";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost";

const styles: Record<Variant, string> = {
  primary:
    "bg-[var(--color-accent)] text-black font-medium hover:bg-[var(--color-accent-dim)] hover:shadow-[0_0_40px_-6px_var(--color-accent-glow)]",
  secondary:
    "border border-[var(--color-line-strong)] text-[var(--color-fg)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]",
  ghost: "text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]",
};

type Props = {
  href: string;
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
  external?: boolean;
};

/** CTA con estilo consistente. Detecta enlaces externos para rel/target. */
export function Cta({ href, children, variant = "primary", className, external }: Props) {
  const isExternal = external ?? /^https?:\/\//.test(href);
  const cls = cn(
    "inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] px-5 py-3 text-sm transition-all duration-200 focus-visible:outline-2",
    styles[variant],
    className
  );

  if (isExternal) {
    return (
      <a href={href} className={cls} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={cls}>
      {children}
    </Link>
  );
}
