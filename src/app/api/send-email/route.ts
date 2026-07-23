import { NextRequest, NextResponse } from "next/server";

// Fase 2: activar cuando se tenga API key de Resend
// import { Resend } from "resend";
// const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(_req: NextRequest) {
  return NextResponse.json({ ok: true, message: "Email pendiente fase 2" });
}
