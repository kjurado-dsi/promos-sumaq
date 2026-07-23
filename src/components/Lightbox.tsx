"use client";

import { useEffect } from "react";

interface Props {
  url: string;
  onClose: () => void;
  onDescargar?: () => void;
}

export default function Lightbox({ url, onClose, onDescargar }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="relative max-w-3xl w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={url}
          alt="Vista previa"
          className="w-full max-h-[80vh] object-contain rounded-xl"
        />
        <div className="absolute top-3 right-3 flex gap-2">
          {onDescargar && (
            <button
              onClick={onDescargar}
              className="bg-white text-gray-800 text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-gray-100 shadow transition-colors"
            >
              ⬇ Descargar
            </button>
          )}
          <button
            onClick={onClose}
            className="bg-white text-gray-800 text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-gray-100 shadow transition-colors"
          >
            ✕ Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
