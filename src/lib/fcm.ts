import { getToken } from "firebase/messaging";
import { doc, updateDoc } from "firebase/firestore";
import { getMessagingInstance, db } from "./firebase";

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ?? "";

export async function registrarTokenFCM(uid: string) {
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return;

    const messaging = await getMessagingInstance();
    if (!messaging) return;

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: await navigator.serviceWorker.getRegistration("/firebase-messaging-sw.js"),
    });

    if (token) {
      await updateDoc(doc(db, "users", uid), { fcmToken: token });
    }
  } catch {
    // Notificaciones no disponibles en este dispositivo/browser
  }
}
