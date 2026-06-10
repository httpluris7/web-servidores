import { cn } from "@/lib/utils";

type Props = {
  children: React.ReactNode;
  duration?: number; // segundos por ciclo
  className?: string;
};

/**
 * Marquee infinito con CSS puro (sólo transform). Duplica el contenido para
 * un bucle sin costuras. Se detiene con prefers-reduced-motion (ver globals.css).
 */
export function Marquee({ children, duration = 30, className }: Props) {
  return (
    <div className={cn("group relative overflow-hidden", className)}>
      <div
        className="flex w-max animate-marquee gap-0 group-hover:[animation-play-state:paused]"
        style={{ ["--marquee-duration" as string]: `${duration}s` }}
      >
        <div className="flex shrink-0 items-center">{children}</div>
        <div className="flex shrink-0 items-center" aria-hidden="true">
          {children}
        </div>
      </div>
      {/* Difuminado en los bordes */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-[var(--color-bg-base)] to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-[var(--color-bg-base)] to-transparent" />
    </div>
  );
}
