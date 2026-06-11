import { NextResponse } from "next/server";
import { saveLead, clean, emailRe } from "@/lib/leads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TOPICS = new Set(["ventas", "soporte", "abuse", "otro"]);

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido." }, { status: 400 });
  }

  const name = clean(body.name, 120);
  const email = clean(body.email, 200);
  const message = clean(body.message, 4000);
  const topic = clean(body.topic, 20) || "otro";

  const errors: Record<string, string> = {};
  if (name.length < 2) errors.name = "Indica tu nombre.";
  if (!emailRe.test(email)) errors.email = "Introduce un email válido.";
  if (message.length < 10) errors.message = "Cuéntanos un poco más (mín. 10 caracteres).";
  if (!TOPICS.has(topic)) errors.topic = "Asunto no válido.";

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ ok: false, errors }, { status: 422 });
  }

  try {
    await saveLead("contacto", { name, email, message, topic });
  } catch {
    return NextResponse.json(
      { ok: false, error: "No se pudo registrar el mensaje. Inténtalo de nuevo." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
