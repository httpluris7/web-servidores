import { Reveal } from "./Reveal";
import { cn } from "@/lib/utils";

type Props = {
  index?: string; // ej. "/02"
  kicker?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  align?: "left" | "center";
  className?: string;
};

/** Cabecera de sección con numeración mono /0X y titular. */
export function SectionHeader({
  index,
  kicker,
  title,
  description,
  align = "left",
  className,
}: Props) {
  return (
    <Reveal
      className={cn(
        "flex flex-col gap-4",
        align === "center" && "items-center text-center",
        className
      )}
    >
      {(index || kicker) && (
        <div className="flex items-center gap-3">
          {index && <span className="font-mono text-sm text-[var(--color-accent)]">{index}</span>}
          {kicker && <span className="mono-label">{kicker}</span>}
        </div>
      )}
      <h2 className="max-w-3xl text-balance text-3xl font-semibold leading-[1.05] tracking-tight sm:text-4xl md:text-5xl">
        {title}
      </h2>
      {description && (
        <p
          className={cn(
            "max-w-2xl text-base leading-relaxed text-[var(--color-fg-muted)] md:text-lg",
            align === "center" && "mx-auto"
          )}
        >
          {description}
        </p>
      )}
    </Reveal>
  );
}
