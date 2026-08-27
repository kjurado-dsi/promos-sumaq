import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || apiKey.startsWith("re_XXX")) {
    return NextResponse.json({ ok: false, error: "RESEND_API_KEY no configurada" }, { status: 503 });
  }

  try {
    const body = await req.json();
    const { to, subject, html } = body;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Sumaq Operativo <operaciones@sumaqmercados.pe>",
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ ok: false, error: err }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
