"use client";

import { useEffect, useState } from "react";
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface Comunicado {
  id: string;
  titulo: string;
  contenido: string;
  tipo: "general" | "urgente" | "evento";
  creadoEn: { seconds: number };
  autor: string;
}

const TIPOS = {
  general: { icon: "📢", color: "bg-blue-50 border-blue-100", badge: "bg-blue-50 text-blue-700 border-blue-200", label: "General" },
  urgente: { icon: "🚨", color: "bg-red-50 border-red-100", badge: "bg-red-50 text-red-700 border-red-200", label: "Urgente" },
  evento: { icon: "🎉", color: "bg-purple-50 border-purple-100", badge: "bg-purple-50 text-purple-700 border-purple-200", label: "Evento" },
};

function formatFecha(seconds: number) {
  return new Date(seconds * 1000).toLocaleDateString("es-PE", {
    day: "numeric", month: "long", year: "numeric",
  });
}

export default function ComunicadosPage() {
  const [comunicados, setComunicados] = useState<Comunicado[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, "comunicados"),
      where("activo", "==", true),
      orderBy("creadoEn", "desc")
    );
    const unsub = onSnapshot(q, snap => {
      setComunicados(snap.docs.map(d => ({ id: d.id, ...d.data() } as Comunicado)));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  );

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <h1 className="text-2xl font-semibold text-gray-900 mb-1">Comunicados</h1>
      <p className="text-sm text-gray-500 mb-6">Avisos oficiales del mercado</p>

      {comunicados.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">📢</p>
          <p className="font-medium text-gray-500">No hay comunicados por ahora</p>
          <p className="text-sm text-gray-400 mt-1">Cuando el mercado publique un aviso aparecerá aquí.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {comunicados.map((c, i) => {
            const t = TIPOS[c.tipo] ?? TIPOS.general;
            const esNuevo = i === 0;
            return (
              <div key={c.id} className={`rounded-2xl border p-5 ${t.color}`}>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${t.badge}`}>
                      {t.icon} {t.label}
                    </span>
                    {esNuevo && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white border border-gray-200 text-gray-600">
                        Nuevo
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">{formatFecha(c.creadoEn.seconds)}</span>
                </div>
                <h2 className="text-base font-semibold text-gray-900 mb-2">{c.titulo}</h2>
                <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">{c.contenido}</p>
                <p className="text-xs text-gray-400 mt-3">Publicado por {c.autor}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
