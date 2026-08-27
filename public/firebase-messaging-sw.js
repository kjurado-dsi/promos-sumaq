importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyBD3bNK-AAX4oGszHgiy1xQEVUdM9cOExo",
  authDomain: "promociones-sumaq-mercados.firebaseapp.com",
  projectId: "promociones-sumaq-mercados",
  storageBucket: "promociones-sumaq-mercados.firebasestorage.app",
  messagingSenderId: "756589819509",
  appId: "1:756589819509:web:1f4d25f35c08c7702e2a3c",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification ?? {};
  self.registration.showNotification(title ?? "Sumaq Operativo", {
    body: body ?? "",
    icon: "https://lh3.googleusercontent.com/d/1W27Jd23pjCvkMfP7JA3Od0PcQ_1XzqPc",
    badge: "https://lh3.googleusercontent.com/d/1W27Jd23pjCvkMfP7JA3Od0PcQ_1XzqPc",
    data: payload.data,
  });
});
