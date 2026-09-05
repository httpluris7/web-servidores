import { NextResponse } from "next/server";
import { panelGuard, falloProvisioner } from "@/lib/panel/bff";
import {
  deleteVpsBackupSchedule,
  setVpsBackupSchedule,
  vpsBackupSchedule,
  type VpsBackupScheduleInput,
} from "@/lib/provisioner/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Programación de copias automáticas del servidor: GET la lee, PUT la crea o
 * modifica (frecuencia diaria/semanal, hora UTC, retención), DELETE la quita.
 * La ejecuta el worker del aprovisionador; aquí solo se valida y se reenvía.
 */
export async function GET(_req: Request, ctx: Ctx) {
  const g = await panelGuard(ctx, "panel-backup-sched", 60);
  if (g.error) return g.error;
  try {
    const r = await vpsBackupSchedule(g.ficha!.remoteId);
    return NextResponse.json({ ok: true, schedule: r.schedule });
  } catch (err) {
    return falloProvisioner("programación de copias", err);
  }
}

export async function PUT(req: Request, ctx: Ctx) {
  const g = await panelGuard(ctx, "panel-backup-sched", 20);
  if (g.error) return g.error;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }
  const input = validar(body);
  if (!input) return NextResponse.json({ ok: false, error: "invalid_schedule" }, { status: 422 });
  try {
    const r = await setVpsBackupSchedule(g.ficha!.remoteId, input);
    return NextResponse.json({ ok: true, schedule: r.schedule });
  } catch (err) {
    return falloProvisioner("programación de copias", err);
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const g = await panelGuard(ctx, "panel-backup-sched", 20);
  if (g.error) return g.error;
  try {
    await deleteVpsBackupSchedule(g.ficha!.remoteId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return falloProvisioner("programación de copias", err);
  }
}

type Ctx = { params: Promise<{ id: string }> };

function validar(b: Record<string, unknown>): VpsBackupScheduleInput | null {
  const frecuencia = b.frecuencia === "weekly" ? "weekly" : b.frecuencia === "daily" ? "daily" : null;
  const hora = Number(b.hora);
  const retencion = Number(b.retencion);
  const dia = b.dia_semana == null ? null : Number(b.dia_semana);
  if (!frecuencia) return null;
  if (!Number.isInteger(hora) || hora < 0 || hora > 23) return null;
  if (!Number.isInteger(retencion) || retencion < 1 || retencion > 14) return null;
  if (frecuencia === "weekly" && (dia === null || !Number.isInteger(dia) || dia < 0 || dia > 6)) return null;
  return { activo: b.activo !== false, frecuencia, hora, retencion, dia_semana: frecuencia === "weekly" ? dia : null };
}
