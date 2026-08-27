import { NextRequest, NextResponse } from "next/server";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";

function getAdminApp() {
  if (getApps().length > 0) return getApps()[0];
  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

export async function POST(req: NextRequest) {
  try {
    const { token, title, body, data } = await req.json();
    if (!token) return NextResponse.json({ ok: false, error: "sin token" }, { status: 400 });

    const app = getAdminApp();
    await getMessaging(app).send({
      token,
      notification: { title, body },
      data: data ?? {},
      webpush: {
        notification: {
          icon: "https://lh3.googleusercontent.com/d/1W27Jd23pjCvkMfP7JA3Od0PcQ_1XzqPc",
          badge: "https://lh3.googleusercontent.com/d/1W27Jd23pjCvkMfP7JA3Od0PcQ_1XzqPc",
          requireInteraction: false,
        },
        fcmOptions: { link: "/locatario/reportes" },
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
