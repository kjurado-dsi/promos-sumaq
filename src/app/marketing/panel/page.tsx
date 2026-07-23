"use client";

import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface Solicitud {
  id: string;
  locatarioNombre: string;
  local: string;
  productos: { nombre: string }[];
  semana: number;
  estado: string;
  creadoEn: { seconds: number };
}

export default function MarketingPanelPage() {
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [loading, setLoading] = useState(true);

  const semanaActual = (() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    return Math.ceil(((now.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7);
  })();

  useEffect(() => {
    const q = query(
      collection(db, "solicitudes"),
      where("semana", "==", semanaActual)
    );
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Solicitud));
      docs.sort((a, b) => (b.creadoEn?.seconds ?? 0) - (a.creadoEn?.seconds ?? 0));
      setSolicitudes(docs);
      setLoading(false);
    });
    return () => unsub();
  }, [semanaActual]);

  const total = solicitudes.length;
  const publicadas = solicitudes.filter((s) => s.estado === "publicado").length;
  const enDiseno = solicitudes.filter((s) => s.estado === "en_diseno").length;
  const pendientes = solicitudes.filter((s) => s.estado === "pendiente").length;
  const porcentaje = total > 0 ? Math.round((publicadas / total) * 100) : 0;

  const cards = [
    { label: "Total esta semana", value: total, color: "text-gray-900" },
    { label: "Publicadas", value: publicadas, color: "text-green-600" },
    { label: "En diseño", value: enDiseno, color: "text-blue-600" },
    { label: "Pendientes", value: pendientes, color: "text-yellow-600" },
  ];

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold text-gray-900 mb-1">Panel de control</h1>
      <p className="text-sm text-gray-500 mb-6">Semana {semanaActual} · {porcentaje}% atendido</p>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 mb-8 max-w-2xl">
            {cards.map((c) => (
              <div key={c.label} className="bg-white border border-gray-200 rounded-xl p-5">
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{c.label}</p>
                <p className={`text-3xl font-bold ${c.color}`}>{c.value}</p>
              </div>
            ))}
          </div>

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden max-w-3xl">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700">Solicitudes de esta semana</h2>
            </div>
            {solicitudes.length === 0 ? (
              <p className="text-center py-10 text-gray-400 text-sm">Sin solicitudes esta semana</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-50">
                    <th className="text-left px-4 py-2 text-xs text-gray-400 font-medium">Locatario</th>
                    <th className="text-left px-4 py-2 text-xs text-gray-400 font-medium">Productos</th>
                    <th className="text-left px-4 py-2 text-xs text-gray-400 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {solicitudes.map((s) => (
                    <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-800">{s.locatarioNombre}</p>
                        <p className="text-xs text-gray-400">Local {s.local}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{s.productos.map((p) => p.nombre).join(", ")}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${
                          s.estado === "publicado" ? "bg-green-50 text-green-700" :
                          s.estado === "en_diseno" ? "bg-blue-50 text-blue-700" :
                          "bg-yellow-50 text-yellow-700"
                        }`}>
                          {s.estado === "publicado" ? "Publicado" : s.estado === "en_diseno" ? "En diseño" : "Pendiente"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
