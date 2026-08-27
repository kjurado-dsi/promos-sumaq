"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Link from "next/link";

interface Solicitud {
  id: string;
  locatarioNombre: string;
  local: string;
  productos: { nombre: string }[];
  semana: string;
  estado: string;
}

interface Reporte {
  id: string;
  locatarioNombre: string;
  local: string;
  tipo: string;
  descripcion: string;
  urgente: boolean;
  estado: string;
  creadoEn: { seconds: number };
}

const estadoBadge: Record<string, string> = {
  pendiente: "bg-yellow-50 text-yellow-700",
  en_diseno: "bg-blue-50 text-blue-700",
  publicado: "bg-green-50 text-green-700",
};

const estadoLabel: Record<string, string> = {
  pendiente: "Pendiente",
  en_diseno: "En diseño",
  publicado: "Publicado",
};

function diasDesde(seconds: number) {
  return Math.floor((Date.now() / 1000 - seconds) / 86400);
}

export default function AdminPage() {
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [reportes, setReportes] = useState<Reporte[]>([]);
  const [loadingSol, setLoadingSol] = useState(true);
  const [loadingRep, setLoadingRep] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "solicitudes"), orderBy("creadoEn", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setSolicitudes(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Solicitud)));
      setLoadingSol(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const q = query(collection(db, "reportes"), orderBy("creadoEn", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setReportes(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Reporte)));
      setLoadingRep(false);
    });
    return () => unsub();
  }, []);

  // Solicitudes stats
  const total = solicitudes.length;
  const atendidas = solicitudes.filter((s) => s.estado === "publicado").length;
  const pendientes = solicitudes.filter((s) => s.estado === "pendiente").length;
  const pct = total > 0 ? Math.round((atendidas / total) * 100) : 0;

  // Reportes stats
  const sinResolver = reportes.filter((r) => r.estado !== "resuelto");
  const urgentesActivos = sinResolver.filter((r) => r.urgente).length;
  const recibidos = reportes.filter((r) => r.estado === "recibido").length;
  const enProceso = reportes.filter((r) => r.estado === "en_proceso").length;

  // Días promedio sin solución (solo los no resueltos)
  const diasPromedio =
    sinResolver.length > 0
      ? Math.round(sinResolver.reduce((acc, r) => acc + diasDesde(r.creadoEn.seconds), 0) / sinResolver.length)
      : 0;

  // Reporte más antiguo sin resolver
  const masAntiguo =
    sinResolver.length > 0
      ? Math.max(...sinResolver.map((r) => diasDesde(r.creadoEn.seconds)))
      : 0;

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-2xl font-semibold text-gray-900 mb-1">Panel de control</h1>
      <p className="text-sm text-gray-400 mb-6">Vista gerencial · Operaciones Sumaq</p>

      {/* Bloque operaciones — Reportes */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Soporte Operacional</h2>
          <Link href="/admin/reportes" className="text-xs text-blue-600 hover:underline font-medium">
            Ver todos →
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
          {/* Sin resolver */}
          <div className={`bg-white border rounded-xl p-4 ${sinResolver.length > 0 ? "border-red-200" : "border-gray-200"}`}>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Sin resolver</p>
            <p className={`text-3xl font-bold mt-1 tabular-nums ${sinResolver.length > 0 ? "text-red-600" : "text-gray-900"}`}>
              {loadingRep ? "—" : sinResolver.length}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">reportes abiertos</p>
          </div>

          {/* Días promedio */}
          <div className={`bg-white border rounded-xl p-4 ${diasPromedio >= 3 ? "border-amber-200" : "border-gray-200"}`}>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Días promedio</p>
            <p className={`text-3xl font-bold mt-1 tabular-nums ${diasPromedio >= 3 ? "text-amber-600" : diasPromedio >= 1 ? "text-yellow-500" : "text-gray-900"}`}>
              {loadingRep ? "—" : diasPromedio}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">sin solución</p>
          </div>

          {/* Más antiguo */}
          <div className={`bg-white border rounded-xl p-4 ${masAntiguo >= 5 ? "border-red-200" : "border-gray-200"}`}>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Más antiguo</p>
            <p className={`text-3xl font-bold mt-1 tabular-nums ${masAntiguo >= 5 ? "text-red-700" : masAntiguo >= 2 ? "text-amber-600" : "text-gray-900"}`}>
              {loadingRep ? "—" : `${masAntiguo}d`}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">sin resolver</p>
          </div>

          {/* Urgentes activos */}
          <div className={`bg-white border rounded-xl p-4 ${urgentesActivos > 0 ? "border-red-300 bg-red-50" : "border-gray-200"}`}>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Urgentes</p>
            <p className={`text-3xl font-bold mt-1 tabular-nums ${urgentesActivos > 0 ? "text-red-600" : "text-gray-900"}`}>
              {loadingRep ? "—" : urgentesActivos}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">activos sin cerrar</p>
          </div>
        </div>

        {/* Fila detalle: Recibido / En proceso */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400">Recibidos (sin atender)</p>
              <p className="text-xl font-bold text-gray-800 tabular-nums mt-0.5">{loadingRep ? "—" : recibidos}</p>
            </div>
            <span className="text-2xl">📥</span>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400">En proceso</p>
              <p className="text-xl font-bold text-amber-600 tabular-nums mt-0.5">{loadingRep ? "—" : enProceso}</p>
            </div>
            <span className="text-2xl">⚙️</span>
          </div>
        </div>
      </div>

      {/* Bloque promociones */}
      <div className="mb-8">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">Solicitudes Promo</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
          {[
            { label: "Total", value: total, sub: "esta semana" },
            { label: "Atendidas", value: atendidas, sub: `${pct}% de atención`, color: "text-green-600" },
            { label: "Pendientes", value: pendientes, sub: "por atender", color: pendientes > 0 ? "text-yellow-600" : undefined },
          ].map((m) => (
            <div key={m.label} className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">{m.label}</p>
              <p className={`text-3xl font-semibold mt-1 tabular-nums ${m.color ?? "text-gray-900"}`}>{m.value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{m.sub}</p>
            </div>
          ))}
        </div>

        {loadingSol ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-2.5 border-b border-gray-100">
              Solicitudes recientes
            </p>
            {solicitudes.length === 0 ? (
              <p className="text-center py-8 text-gray-400 text-sm">Sin solicitudes aún</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {solicitudes.slice(0, 5).map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-gray-900 text-sm">{s.locatarioNombre}</p>
                        <span className="text-xs text-gray-400">Local {s.local} · Sem. {s.semana}</span>
                      </div>
                      <p className="text-xs text-gray-500 truncate">{s.productos.map((p) => p.nombre).join(", ")}</p>
                    </div>
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0 ${estadoBadge[s.estado] ?? "bg-gray-50 text-gray-600"}`}>
                      {estadoLabel[s.estado] ?? s.estado}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
