"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { collection, query, where, onSnapshot, orderBy, limit, getDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Link from "next/link";

interface Reporte {
  id: string;
  tipo: string;
  descripcion: string;
  estado: string;
  urgente: boolean;
  creadoEn: { seconds: number };
  comentarioAdmin?: string;
}

const ESTADO_CONFIG: Record<string, { label: string; dot: string; bg: string; text: string }> = {
  recibido:   { label: "Recibido",    dot: "bg-gray-400",  bg: "bg-gray-100",  text: "text-gray-600" },
  en_proceso: { label: "En proceso",  dot: "bg-amber-400", bg: "bg-amber-50",  text: "text-amber-700" },
  resuelto:   { label: "Resuelto",    dot: "bg-green-400", bg: "bg-green-50",  text: "text-green-700" },
};

const TIPO_ICON: Record<string, string> = {
  incidente: "🚨",
  mantenimiento: "🔧",
  solicitud: "📋",
  sugerencia: "💡",
};

export default function LocatarioHome() {
  const { user } = useAuth();
  const [perfil, setPerfil] = useState<{ local?: string; nombreCompleto?: string } | null>(null);
  const [reportesActivos, setReportesActivos] = useState<Reporte[]>([]);
  const [loadingReportes, setLoadingReportes] = useState(true);

  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, "users", user.uid)).then((snap) => {
      if (snap.exists()) setPerfil(snap.data() as { local?: string; nombreCompleto?: string });
    });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "reportes"),
      where("uid", "==", user.uid),
      where("estado", "in", ["recibido", "en_proceso"]),
      orderBy("creadoEn", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setReportesActivos(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Reporte)));
      setLoadingReportes(false);
    });
    return () => unsub();
  }, [user]);

  const nombre = perfil?.nombreCompleto?.split(" ")[0] ?? user?.displayName?.split(" ")[0] ?? "Locatario";
  const urgentes = reportesActivos.filter((r) => r.urgente).length;
  const enProceso = reportesActivos.filter((r) => r.estado === "en_proceso").length;

  return (
    <div className="p-4 md:p-8 max-w-lg">
      {/* Saludo */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Hola, {nombre} 👋
        </h1>
        {perfil?.local && (
          <p className="text-sm text-gray-500 mt-1">
            Local <span className="font-semibold text-amber-700">{perfil.local}</span>
          </p>
        )}
      </div>

      {/* Resumen de reportes activos */}
      {!loadingReportes && (
        <div className={`rounded-2xl border p-4 mb-5 ${
          urgentes > 0
            ? "bg-red-50 border-red-200"
            : reportesActivos.length > 0
            ? "bg-amber-50 border-amber-200"
            : "bg-green-50 border-green-200"
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-xs font-bold uppercase tracking-wide mb-0.5 ${
                urgentes > 0 ? "text-red-500" : reportesActivos.length > 0 ? "text-amber-600" : "text-green-600"
              }`}>
                {urgentes > 0 ? "¡Atención requerida!" : reportesActivos.length > 0 ? "En seguimiento" : "Todo al día"}
              </p>
              {reportesActivos.length === 0 ? (
                <p className="text-sm font-semibold text-green-800">No tienes reportes pendientes</p>
              ) : (
                <p className="text-sm font-semibold text-gray-900">
                  {reportesActivos.length} {reportesActivos.length === 1 ? "reporte activo" : "reportes activos"}
                  {urgentes > 0 && ` · ${urgentes} urgente${urgentes > 1 ? "s" : ""}`}
                </p>
              )}
            </div>
            <div className={`text-2xl font-bold ${
              urgentes > 0 ? "text-red-500" : reportesActivos.length > 0 ? "text-amber-500" : "text-green-500"
            }`}>
              {urgentes > 0 ? "🚨" : reportesActivos.length > 0 ? "⏳" : "✅"}
            </div>
          </div>

          {/* Mini-lista de reportes activos */}
          {reportesActivos.length > 0 && (
            <div className="mt-3 space-y-2">
              {reportesActivos.slice(0, 3).map((r) => {
                const e = ESTADO_CONFIG[r.estado];
                return (
                  <div key={r.id} className="flex items-center gap-2 bg-white/70 rounded-xl px-3 py-2">
                    <span className="text-sm">{TIPO_ICON[r.tipo] ?? "📋"}</span>
                    <p className="text-xs text-gray-700 flex-1 truncate">{r.descripcion}</p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${e?.bg} ${e?.text} flex-shrink-0`}>
                      {e?.label}
                    </span>
                  </div>
                );
              })}
              {reportesActivos.length > 3 && (
                <p className="text-xs text-center text-gray-400 pt-0.5">
                  +{reportesActivos.length - 3} más
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Acciones principales — Soporte Operacional */}
      <p className="text-xs font-bold text-[#0d1f3c] uppercase tracking-wide mb-3">Soporte operacional</p>
      <div className="grid grid-cols-2 gap-3 mb-6">
        <Link
          href="/locatario/reportar"
          className="col-span-2 bg-[#0d1f3c] text-white rounded-2xl p-5 hover:bg-[#1a3358] transition-all active:scale-[0.98] flex items-center gap-4"
        >
          <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">📝</div>
          <div>
            <p className="font-bold text-base">Nuevo reporte</p>
            <p className="text-sm text-white/70 mt-0.5">Incidentes, mantenimiento, solicitudes</p>
          </div>
        </Link>

        <Link
          href="/locatario/reportes"
          className="bg-white border border-gray-200 rounded-2xl p-4 hover:border-[#0d1f3c]/30 hover:shadow-sm transition-all active:scale-[0.98] group"
        >
          <div className="text-2xl mb-2">📋</div>
          <p className="font-semibold text-gray-900 text-sm group-hover:text-[#0d1f3c]">Mis reportes</p>
          <p className="text-xs text-gray-400 mt-0.5">Ver estado y respuestas</p>
          {reportesActivos.length > 0 && (
            <span className="inline-block mt-2 text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
              {reportesActivos.length} activo{reportesActivos.length > 1 ? "s" : ""}
            </span>
          )}
        </Link>

        <Link
          href="/locatario/comunicados"
          className="bg-white border border-gray-200 rounded-2xl p-4 hover:border-[#0d1f3c]/30 hover:shadow-sm transition-all active:scale-[0.98] group"
        >
          <div className="text-2xl mb-2">📢</div>
          <p className="font-semibold text-gray-900 text-sm group-hover:text-[#0d1f3c]">Comunicados</p>
          <p className="text-xs text-gray-400 mt-0.5">Avisos del mercado</p>
        </Link>
      </div>

      {/* Sección secundaria — Promos */}
      <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Promociones</p>
      <div className="grid grid-cols-3 gap-2">
        <Link
          href="/locatario/solicitar"
          className="bg-white border border-gray-100 rounded-xl p-3 hover:border-gray-300 hover:shadow-sm transition-all active:scale-[0.98] text-center"
        >
          <div className="text-xl mb-1.5">📤</div>
          <p className="text-xs font-semibold text-gray-600">Solicitar</p>
        </Link>
        <Link
          href="/locatario/catalogo"
          className="bg-white border border-gray-100 rounded-xl p-3 hover:border-gray-300 hover:shadow-sm transition-all active:scale-[0.98] text-center"
        >
          <div className="text-xl mb-1.5">📦</div>
          <p className="text-xs font-semibold text-gray-600">Mi catálogo</p>
        </Link>
        <Link
          href="/locatario/solicitudes"
          className="bg-white border border-gray-100 rounded-xl p-3 hover:border-gray-300 hover:shadow-sm transition-all active:scale-[0.98] text-center"
        >
          <div className="text-xl mb-1.5">🕐</div>
          <p className="text-xs font-semibold text-gray-600">Solicitudes</p>
        </Link>
      </div>
    </div>
  );
}
