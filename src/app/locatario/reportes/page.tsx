"use client";

import { useEffect, useState } from "react";
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

interface Reporte {
  id: string;
  tipo: string;
  descripcion: string;
  area: string;
  urgente: boolean;
  estado: string;
  fotoUrl?: string;
  comentarioAdmin?: string;
  creadoEn: { seconds: number };
}

const TIPO_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  incidente:    { label: "🚨 Incidente",    bg: "bg-red-50",    text: "text-red-700" },
  mantenimiento:{ label: "🔧 Mantenimiento",bg: "bg-orange-50", text: "text-orange-700" },
  solicitud:    { label: "📋 Solicitud",    bg: "bg-blue-50",   text: "text-blue-700" },
  sugerencia:   { label: "💡 Sugerencia",   bg: "bg-yellow-50", text: "text-yellow-700" },
};

const ESTADO_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  recibido:   { label: "Recibido",    bg: "bg-gray-100",   text: "text-gray-600" },
  en_proceso: { label: "En proceso",  bg: "bg-amber-50",   text: "text-amber-700" },
  resuelto:   { label: "Resuelto ✓", bg: "bg-green-50",   text: "text-green-700" },
};

function ReportesContent() {
  const { user } = useAuth();
  const params = useSearchParams();
  const [reportes, setReportes] = useState<Reporte[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandido, setExpandido] = useState<string | null>(null);
  const nuevo = params.get("nuevo") === "1";

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "reportes"),
      where("uid", "==", user.uid),
      orderBy("creadoEn", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setReportes(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Reporte)));
      setLoading(false);
    });
    return () => unsub();
  }, [user]);

  const formatFecha = (seconds: number) =>
    new Date(seconds * 1000).toLocaleDateString("es-PE", { day: "numeric", month: "short", year: "numeric" });

  return (
    <div className="p-4 md:p-8 max-w-xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Mis reportes</h1>
          <p className="text-sm text-gray-500 mt-0.5">Seguimiento en tiempo real</p>
        </div>
        <Link
          href="/locatario/reportar"
          className="bg-[#0d1f3c] text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-[#1a3358] transition-colors flex-shrink-0"
        >
          + Nuevo
        </Link>
      </div>

      {nuevo && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <span className="text-green-600 text-lg">✅</span>
          <div>
            <p className="text-sm font-semibold text-green-800">¡Reporte enviado!</p>
            <p className="text-xs text-green-600">El equipo de operaciones lo revisará pronto.</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0d1f3c]" />
        </div>
      ) : reportes.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
          <p className="text-3xl mb-3">📋</p>
          <p className="font-medium text-gray-600">Sin reportes aún</p>
          <p className="text-sm text-gray-400 mt-1 mb-4">¿Hay algo que reportar en el mercado?</p>
          <Link href="/locatario/reportar" className="text-[#0d1f3c] text-sm font-semibold underline">
            Hacer primer reporte
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {reportes.map((r) => {
            const tipo = TIPO_CONFIG[r.tipo] ?? { label: r.tipo, bg: "bg-gray-50", text: "text-gray-600" };
            const estado = ESTADO_CONFIG[r.estado] ?? { label: r.estado, bg: "bg-gray-50", text: "text-gray-600" };
            const abierto = expandido === r.id;
            return (
              <div key={r.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                <button
                  onClick={() => setExpandido(abierto ? null : r.id)}
                  className="w-full text-left p-4"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-lg ${tipo.bg} ${tipo.text}`}>
                        {tipo.label}
                      </span>
                      {r.urgente && (
                        <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-lg">URGENTE</span>
                      )}
                    </div>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${estado.bg} ${estado.text}`}>
                      {estado.label}
                    </span>
                  </div>
                  <p className="text-sm text-gray-800 font-medium line-clamp-2">{r.descripcion}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <p className="text-xs text-gray-400">{r.area}</p>
                    <span className="text-gray-200">·</span>
                    <p className="text-xs text-gray-400">{formatFecha(r.creadoEn.seconds)}</p>
                  </div>
                </button>

                {abierto && (
                  <div className="border-t border-gray-100 px-4 py-3 space-y-3 bg-gray-50">
                    {r.fotoUrl && (
                      <img src={r.fotoUrl} alt="Foto" className="w-full max-h-48 object-cover rounded-xl" />
                    )}
                    {r.comentarioAdmin ? (
                      <div className="bg-[#0d1f3c]/5 border border-[#0d1f3c]/10 rounded-xl px-3 py-2.5">
                        <p className="text-xs font-bold text-[#0d1f3c] mb-1">Respuesta de Operaciones</p>
                        <p className="text-sm text-gray-700">{r.comentarioAdmin}</p>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 italic">Sin respuesta aún — te notificaremos cuando haya avances.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ReportesPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0d1f3c]" /></div>}>
      <ReportesContent />
    </Suspense>
  );
}
