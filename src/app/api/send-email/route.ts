import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// Mientras el dominio no esté verificado en Resend, usamos onboarding@resend.dev
// Una vez verificado ds-inmobiliario.com, cambiar a: operaciones@ds-inmobiliario.com
const FROM = "Sumaq Operativo <onboarding@resend.dev>";

export async function POST(req: NextRequest) {
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ ok: false, error: "RESEND_API_KEY no configurada" }, { status: 503 });
  }

  try {
    const { to, subject, html } = await req.json();

    const { error } = await resend.emails.send({
      from: FROM,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
    });

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
