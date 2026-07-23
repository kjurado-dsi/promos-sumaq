"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface Solicitud {
  id: string;
  locatarioNombre: string;
  local: string;
  productos: { nombre: string }[];
  semana: string;
  estado: string;
  asignadoA?: string;
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

export default function AdminPage() {
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "solicitudes"), orderBy("creadoEn", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setSolicitudes(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Solicitud)));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const total = solicitudes.length;
  const atendidas = solicitudes.filter((s) => s.estado === "publicado").length;
  const pendientes = solicitudes.filter((s) => s.estado === "pendiente").length;
  const pct = total > 0 ? Math.round((atendidas / total) * 100) : 0;

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Panel de control</h1>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total solicitudes", value: total, sub: "esta semana" },
          { label: "Atendidas", value: atendidas, sub: `${pct}% de atención`, color: "text-green-600" },
          { label: "Pendientes", value: pendientes, sub: "por atender", color: pendientes > 0 ? "text-yellow-600" : undefined },
          { label: "Locatarios activos", value: "-", sub: "próximamente" },
        ].map((m) => (
          <div key={m.label} className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">{m.label}</p>
            <p className={`text-3xl font-semibold mt-1 ${m.color ?? "text-gray-900"}`}>{m.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{m.sub}</p>
          </div>
        ))}
      </div>

      <h2 className="text-sm font-semibold text-gray-700 mb-3">Solicitudes recientes</h2>

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {solicitudes.length === 0 ? (
            <p className="text-center py-10 text-gray-400 text-sm">Sin solicitudes aún</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {solicitudes.map((s) => (
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
  );
}
