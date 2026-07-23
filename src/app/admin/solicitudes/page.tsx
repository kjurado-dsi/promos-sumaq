"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, query, orderBy, doc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface Solicitud {
  id: string;
  locatarioNombre: string;
  local: string;
  celular?: string;
  productos: { nombre: string; precio: number; fotoUrl?: string }[];
  semana: number;
  estado: string;
  nota?: string;
  fechaInicio?: string;
  fechaFin?: string;
  logoUrl?: string;
  disenoUrl?: string;
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

export default function SolicitudesAdminPage() {
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState("todas");
  const [detalle, setDetalle] = useState<Solicitud | null>(null);

  useEffect(() => {
    const q = query(collection(db, "solicitudes"), orderBy("creadoEn", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setSolicitudes(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Solicitud)));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const eliminar = async (id: string) => {
    if (!confirm("¿Eliminar esta solicitud? Esta acción no se puede deshacer.")) return;
    await deleteDoc(doc(db, "solicitudes", id));
    if (detalle?.id === id) setDetalle(null);
  };

  const filtradas = filtro === "todas" ? solicitudes : solicitudes.filter((s) => s.estado === filtro);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Solicitudes</h1>
        <div className="flex gap-2">
          {["todas", "pendiente", "en_diseno", "publicado"].map((f) => (
            <button key={f} onClick={() => setFiltro(f)}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${filtro === f ? "bg-blue-600 text-white" : "border border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
              {f === "todas" ? "Todas" : estadoLabel[f]}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase">Locatario</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase">Productos</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase">Semana</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase">Fecha</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase">Estado</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtradas.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-10 text-gray-400">Sin solicitudes</td></tr>
              ) : (
                filtradas.map((s) => {
                  const fecha = s.creadoEn ? new Date(s.creadoEn.seconds * 1000).toLocaleDateString("es-PE", { day: "numeric", month: "short" }) : "—";
                  return (
                    <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer" onClick={() => setDetalle(s)}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{s.locatarioNombre}</p>
                        <p className="text-xs text-gray-400">Local {s.local}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {s.productos.map((p) => p.nombre).join(", ")}
                        {s.nota && <p className="italic text-gray-400 mt-0.5">"{s.nota}"</p>}
                      </td>
                      <td className="px-4 py-3 text-gray-500">Sem. {s.semana}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{fecha}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${estadoBadge[s.estado] ?? "bg-gray-50 text-gray-600"}`}>
                          {estadoLabel[s.estado] ?? s.estado}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => eliminar(s.id)} className="text-gray-300 hover:text-red-500 transition-colors text-lg">×</button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de detalle */}
      {detalle && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setDetalle(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{detalle.locatarioNombre}</h2>
                <p className="text-xs text-gray-400">Local {detalle.local} · Sem. {detalle.semana}{detalle.celular && ` · ${detalle.celular}`}</p>
              </div>
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${estadoBadge[detalle.estado]}`}>{estadoLabel[detalle.estado]}</span>
            </div>
            <div className="p-5 space-y-4">
              {detalle.disenoUrl && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2">Diseño final</p>
                  <img src={detalle.disenoUrl} alt="Diseño" className="w-full rounded-xl border border-gray-200" />
                </div>
              )}
              {detalle.logoUrl && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Logo</p>
                  <img src={detalle.logoUrl} alt="Logo" className="w-16 h-16 object-contain rounded-lg border border-gray-200 bg-gray-50 p-1" />
                </div>
              )}
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">Productos</p>
                {detalle.productos.map((p, i) => (
                  <div key={i} className="flex justify-between bg-gray-50 rounded-lg px-3 py-2 mb-1">
                    <span className="text-sm text-gray-800">{p.nombre}</span>
                    {p.precio > 0 && <span className="text-sm font-semibold text-gray-700">S/ {p.precio}</span>}
                  </div>
                ))}
              </div>
              {(detalle.fechaInicio || detalle.fechaFin) && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Vigencia</p>
                  <p className="text-sm text-gray-700">{detalle.fechaInicio} → {detalle.fechaFin}</p>
                </div>
              )}
              {detalle.nota && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Nota</p>
                  <p className="text-sm text-gray-700 italic">"{detalle.nota}"</p>
                </div>
              )}
              <button onClick={() => eliminar(detalle.id)} className="w-full text-red-500 text-sm border border-red-200 rounded-lg py-2 hover:bg-red-50 transition-colors mt-2">
                Eliminar solicitud
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
