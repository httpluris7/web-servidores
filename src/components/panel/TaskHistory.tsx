"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { VpsTask } from "@/lib/provisioner/client";
import { CARD, SECTION_INDEX } from "./ui";

/** Prefijo de tipo de tarea de Proxmox → clave de traducción corta. */
const TIPO: Record<string, string> = {
  qmstart: "start",
  qmstop: "stop",
  qmshutdown: "shutdown",
  qmreboot: "reboot",
  qmreset: "reset",
  qmsuspend: "suspend",
  qmresume: "resume",
  qmsnapshot: "snapshot",
  qmrollback: "rollback",
  qmdelsnapshot: "delsnapshot",
  qmconfig: "config",
  qmclone: "clone",
  qmcreate: "create",
  qmdestroy: "destroy",
  qmigrate: "migrate",
  resize: "resize",
  vzdump: "backup",
  "guest-agent": "agent",
};

/**
 * "Historial de tareas": las últimas operaciones de Proxmox sobre esta VM. Se
 * relee solo (sondeo adaptativo: rápido si hay una tarea en curso, lento si no)
 * y también cuando `ServiceActions` avisa de que acaba de lanzar una acción.
 */
export function TaskHistory({ id }: { id: string }) {
  const t = useTranslations("panel");
  const locale = useLocale();
  const [tasks, setTasks] = useState<VpsTask[] | null>(null);
  const [error, setError] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const vivo = useRef(true);

  // Devuelve la lista leída (o null) para poder decidir el ritmo del sondeo.
  const fetchTasks = useCallback(async (): Promise<VpsTask[] | null> => {
    try {
      const res = await fetch(`/api/panel/servicios/${id}/tareas`);
      const j = await res.json().catch(() => null);
      if (!vivo.current) return null;
      if (j?.ok && Array.isArray(j.tasks)) {
        const lista = j.tasks as VpsTask[];
        setTasks(lista);
        setError(false);
        return lista;
      }
      setError(true);
      return null;
    } catch {
      if (vivo.current) setError(true);
      return null;
    }
  }, [id]);

  // Sondeo adaptativo: rápido (3 s) mientras hay una tarea en curso, lento (12 s)
  // en reposo. Además, refresco inmediato cuando ServiceActions lanza una acción.
  useEffect(() => {
    vivo.current = true;
    let cancelado = false;

    const ciclo = async () => {
      const lista = await fetchTasks();
      if (cancelado || !vivo.current) return;
      const hayEnCurso = (lista ?? []).some((x) => x.running);
      timer.current = setTimeout(ciclo, hayEnCurso ? 3000 : 12000);
    };
    void ciclo();

    const onRefresh = () => void fetchTasks();
    window.addEventListener("panel:refresh-tasks", onRefresh);

    return () => {
      cancelado = true;
      vivo.current = false;
      if (timer.current) clearTimeout(timer.current);
      window.removeEventListener("panel:refresh-tasks", onRefresh);
    };
  }, [fetchTasks]);

  return (
    <section id="historial" className={`${CARD} scroll-mt-28`}>
      <div className="px-6 pt-6">
        <p className={SECTION_INDEX}>/06</p>
        <h2 className="mt-2 text-lg font-semibold">{t("tasks.heading")}</h2>
      </div>

      {tasks === null && !error ? (
        <div className="space-y-3 px-6 py-6" aria-hidden="true">
          {Array.from({ length: 3 }).map((_, i) => (
            <span
              key={i}
              className="block h-4 animate-pulse rounded bg-[var(--color-bg-overlay)]"
              style={{ width: `${70 - i * 12}%` }}
            />
          ))}
        </div>
      ) : error ? (
        <p className="px-6 py-6 text-sm text-[var(--color-fg-dim)]">{t("tasks.error")}</p>
      ) : tasks && tasks.length === 0 ? (
        <p className="px-6 py-6 text-sm text-[var(--color-fg-dim)]">{t("tasks.empty")}</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[38rem] border-collapse text-sm">
            <thead>
              <tr className="border-t border-[var(--color-line)] text-left">
                {["colType", "colStatus", "colStarted", "colDuration"].map((c) => (
                  <th key={c} className="px-6 py-3 mono-label text-[0.6rem] font-normal">
                    {t(`tasks.${c}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tasks!.map((task) => (
                <tr key={task.upid} className="border-t border-[var(--color-line)]">
                  <td className="px-6 py-3 text-[var(--color-fg)]">{tipoLabel(task.type, t)}</td>
                  <td className="px-6 py-3">
                    <EstadoTarea task={task} t={t} />
                  </td>
                  <td className="px-6 py-3 font-mono text-xs text-[var(--color-fg-muted)]">
                    {task.starttime ? formatTs(task.starttime, locale) : "—"}
                  </td>
                  <td className="px-6 py-3 font-mono text-xs text-[var(--color-fg-muted)]">
                    {duracion(task)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function tipoLabel(tipo: string, t: ReturnType<typeof useTranslations>): string {
  const slug = TIPO[tipo];
  return slug ? t(`tasks.types.${slug}`) : tipo || "—";
}

function EstadoTarea({ task, t }: { task: VpsTask; t: ReturnType<typeof useTranslations> }) {
  if (task.running) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10 px-2.5 py-0.5 font-mono text-xs text-[var(--color-accent)]">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
        {t("tasks.running")}
      </span>
    );
  }
  const ok = task.exitstatus === "OK" || task.exitstatus === null;
  return ok ? (
    <span className="rounded-full border border-[var(--color-line-strong)] px-2.5 py-0.5 font-mono text-xs text-[var(--color-fg-muted)]">
      {t("tasks.ok")}
    </span>
  ) : (
    <span
      title={task.exitstatus ?? undefined}
      className="rounded-full border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 px-2.5 py-0.5 font-mono text-xs text-[var(--color-danger)]"
    >
      {t("tasks.failed")}
    </span>
  );
}

function formatTs(sec: number, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short" }).format(
      new Date(sec * 1000),
    );
  } catch {
    return "—";
  }
}

function duracion(task: VpsTask): string {
  if (task.running || task.starttime == null) return "—";
  if (task.endtime == null) return "—";
  const s = Math.max(0, task.endtime - task.starttime);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return `${m}m ${rest}s`;
}
