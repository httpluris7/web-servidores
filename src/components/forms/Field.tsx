import { cn } from "@/lib/utils";

const base =
  "w-full rounded-[var(--radius-md)] border border-[var(--color-line-strong)] bg-[var(--color-bg-base)] px-4 py-3 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-fg-dim)] transition-colors focus:border-[var(--color-accent)] focus:outline-none";

type LabelProps = { htmlFor: string; children: React.ReactNode; required?: boolean };

export function Label({ htmlFor, children, required }: LabelProps) {
  return (
    <label htmlFor={htmlFor} className="mb-2 block font-mono text-xs uppercase tracking-wider text-[var(--color-fg-muted)]">
      {children}
      {required && <span className="text-[var(--color-accent)]"> *</span>}
    </label>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(base, props.className)} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(base, "min-h-32 resize-y", props.className)} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(base, "appearance-none", props.className)} />;
}

export function FieldError({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return <p className="mt-1.5 text-xs text-[var(--color-danger)]">{children}</p>;
}
