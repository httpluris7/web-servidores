import { NextResponse } from "next/server";
import { saveLead, clean, emailRe } from "@/lib/leads";
import { sendContactMail } from "@/lib/mail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TOPICS = new Set(["ventas", "soporte", "abuse", "otro"]);

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const name = clean(body.name, 120);
  const email = clean(body.email, 200);
  const message = clean(body.message, 4000);
  const topic = clean(body.topic, 20) || "otro";

  const errors: Record<string, string> = {};
  if (name.length < 2) errors.name = "Enter your name.";
  if (!emailRe.test(email)) errors.email = "Enter a valid email.";
  if (message.length < 10) errors.message = "Tell us a little more (min. 10 characters).";
  if (!TOPICS.has(topic)) errors.topic = "Invalid subject.";

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ ok: false, errors }, { status: 422 });
  }

  try {
    await saveLead("contacto", { name, email, message, topic });
  } catch {
    return NextResponse.json(
      { ok: false, error: "The message could not be saved. Please try again." },
      { status: 500 }
    );
  }

  // Aviso por correo al buzón correspondiente al tema. Best-effort: el lead ya
  // quedó persistido en disco, así que un fallo de envío no rompe el formulario.
  try {
    await sendContactMail({ name, email, message, topic });
  } catch (err) {
    console.error("contacto: fallo al enviar el aviso por correo", err);
  }

  return NextResponse.json({ ok: true });
}
