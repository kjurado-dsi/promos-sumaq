"use client";

import { useEffect, useState } from "react";

export default function IosInstallBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true
      || window.matchMedia("(display-mode: standalone)").matches;
    const dismissed = sessionStorage.getItem("ios_banner_dismissed");

    if (isIos && !isStandalone && !dismissed) {
      setTimeout(() => setShow(true), 1500);
    }
  }, []);

  const dismiss = () => {
    sessionStorage.setItem("ios_banner_dismissed", "1");
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 animate-in slide-in-from-bottom duration-300">
      <div className="bg-[#0d1f3c] text-white rounded-2xl shadow-2xl p-4 max-w-sm mx-auto">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <img
              src="https://lh3.googleusercontent.com/d/1805yoxKxdQRbWqmeCQ8abT7Efl7F-rgP"
              alt="Sumaq"
              className="w-8 h-8 rounded-lg flex-shrink-0"
            />
            <p className="text-sm font-bold">Instalar Sumaq Promos</p>
          </div>
          <button onClick={dismiss} className="text-white/60 hover:text-white text-xl leading-none flex-shrink-0">✕</button>
        </div>

        <p className="text-xs text-white/80 mb-3">
          Instálala en tu iPhone en 3 pasos desde <span className="font-bold text-white">Safari o Chrome</span>:
        </p>

        <div className="space-y-2">
          {[
            { n: "1", text: 'Toca el botón compartir de tu navegador', icon: "⬆" },
            { n: "2", text: 'Selecciona "Agregar a pantalla de inicio"', icon: "➕" },
            { n: "3", text: 'Toca "Agregar" para confirmar', icon: "✅" },
          ].map(({ n, text, icon }) => (
            <div key={n} className="flex items-center gap-3 bg-white/10 rounded-xl px-3 py-2">
              <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold flex-shrink-0">{n}</span>
              <span className="text-xs text-white/90 flex-1">{text}</span>
              <span className="text-base">{icon}</span>
            </div>
          ))}
        </div>

        <button
          onClick={dismiss}
          className="mt-3 w-full text-xs text-white/50 hover:text-white/80 py-1"
        >
          Ahora no
        </button>
      </div>
    </div>
  );
}
