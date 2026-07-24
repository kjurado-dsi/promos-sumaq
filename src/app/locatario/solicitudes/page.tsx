"use client";

import { useEffect, useState } from "react";
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import Lightbox from "@/components/Lightbox";

interface Producto {
  nombre: string;
  precio: number;
}

interface Solicitud {
  id: string;
  productos: Producto[];
  semana: number;
  estado: string;
  nota?: string;
  fechaInicio?: string;
  fechaFin?: string;
  disenoUrl?: string;
  creadoEn: { seconds: number };
}

const estadoConfig: Record<string, { label: string; class: string; icon: string }> = {
  pendiente: { label: "Pendiente", class: "bg-yellow-50 text-yellow-700", icon: "🕐" },
  en_diseno: { label: "En diseño", class: "bg-blue-50 text-blue-700", icon: "✏️" },
  publicado: { label: "Publicado", class: "bg-green-50 text-green-700", icon: "✅" },
};

const descargarDiseno = async (url: string, nombre: string) => {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${nombre}.jpg`;
    a.click();
    URL.revokeObjectURL(a.href);
  } catch {
    window.open(url, "_blank");
  }
};

export default function SolicitudesPage() {
  const { user } = useAuth();
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState<{ url: string; nombre: string } | null>(null);
  const [expandidas, setExpandidas] = useState<Set<string>>(new Set());
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ fechaInicio: "", fechaFin: "", nota: "", precios: {} as Record<number, string> });
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "solicitudes"),
      where("uid", "==", user.uid),
      orderBy("creadoEn", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setSolicitudes(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Solicitud)));
      setLoading(false);
    });
    return () => unsub();
  }, [user]);

  const abrirEdicion = (s: Solicitud) => {
    setEditandoId(s.id);
    const precios: Record<number, string> = {};
    s.productos.forEach((p, i) => { precios[i] = String(p.precio); });
    setEditForm({ fechaInicio: s.fechaInicio ?? "", fechaFin: s.fechaFin ?? "", nota: s.nota ?? "", precios });
  };

  const guardarEdicion = async (s: Solicitud) => {
    setGuardando(true);
    const productosActualizados = s.productos.map((p, i) => ({
      ...p,
      precio: parseFloat(editForm.precios[i] ?? String(p.precio)) || p.precio,
    }));
    await updateDoc(doc(db, "solicitudes", s.id), {
      productos: productosActualizados,
      fechaInicio: editForm.fechaInicio,
      fechaFin: editForm.fechaFin,
      nota: editForm.nota,
    });
    setEditandoId(null);
    setGuardando(false);
  };

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      {lightbox && (
        <Lightbox
          url={lightbox.url}
          onClose={() => setLightbox(null)}
          onDescargar={() => { descargarDiseno(lightbox.url, lightbox.nombre); setLightbox(null); }}
        />
      )}
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Mis solicitudes</h1>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : solicitudes.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">📭</p>
          <p className="font-medium">Aún no has enviado solicitudes</p>
          <a href="/locatario/solicitar" className="text-blue-600 text-sm underline mt-1 inline-block">
            Solicitar primera promo
          </a>
        </div>
      ) : (
        <div className="space-y-3">
          {solicitudes.map((s) => {
            const est = estadoConfig[s.estado] ?? estadoConfig.pendiente;
            const fecha = s.creadoEn ? new Date(s.creadoEn.seconds * 1000).toLocaleDateString("es-PE", { day: "numeric", month: "short" }) : "";
            const editando = editandoId === s.id;

            return (
              <div key={s.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                {/* Diseño publicado — colapsable */}
                {s.estado === "publicado" && s.disenoUrl && (
                  <>
                    <button
                      onClick={() => setExpandidas(prev => { const n = new Set(prev); n.has(s.id) ? n.delete(s.id) : n.add(s.id); return n; })}
                      className="w-full flex items-center justify-between px-4 py-2.5 bg-green-50 text-green-700 text-xs font-medium hover:bg-green-100 transition-colors"
                    >
                      <span>🎨 Ver diseño publicado</span>
                      <span>{expandidas.has(s.id) ? "▲ Ocultar" : "▼ Expandir"}</span>
                    </button>
                    {expandidas.has(s.id) && (
                      <div
                        className="relative cursor-pointer group"
                        onClick={() => setLightbox({ url: s.disenoUrl!, nombre: `promo-semana${s.semana}` })}
                      >
                        <img src={s.disenoUrl} alt="Diseño" className="w-full max-h-64 object-contain bg-gray-50" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                          <span className="opacity-0 group-hover:opacity-100 bg-white/90 text-gray-700 text-xs font-medium px-3 py-1.5 rounded-lg shadow">
                            🔍 Ver completo
                          </span>
                        </div>
                      </div>
                    )}
                  </>
                )}

                <div className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1">
                      <div className="flex flex-wrap gap-1.5 mb-1">
                        {s.productos.map((p, i) => (
                          <span key={i} className="bg-gray-50 border border-gray-200 text-gray-700 text-xs px-2.5 py-1 rounded-md font-medium">
                            {p.nombre}{p.precio > 0 ? ` — S/${p.precio}` : ""}
                          </span>
                        ))}
                      </div>
                      <p className="text-xs text-gray-400">
                        Sem. {s.semana} · {fecha}
                        {s.fechaInicio && ` · ${s.fechaInicio} → ${s.fechaFin}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${est.class}`}>
                        {est.icon} {est.label}
                      </span>
                      {s.estado === "pendiente" && !editando && (
                        <button onClick={() => abrirEdicion(s)} className="text-xs text-blue-600 hover:underline">
                          Editar
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Formulario de edición */}
                  {editando && (
                    <div className="border-t border-gray-100 pt-3 mt-1 space-y-3">
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <label className="block text-xs text-gray-400 mb-1">Desde</label>
                          <input type="date" value={editForm.fechaInicio} onChange={(e) => setEditForm({ ...editForm, fechaInicio: e.target.value })}
                            className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                        <div className="flex-1">
                          <label className="block text-xs text-gray-400 mb-1">Hasta</label>
                          <input type="date" value={editForm.fechaFin} min={editForm.fechaInicio} onChange={(e) => setEditForm({ ...editForm, fechaFin: e.target.value })}
                            className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 mb-1">Precios</p>
                        {s.productos.map((p, i) => (
                          <div key={i} className="flex items-center gap-2 mb-1">
                            <span className="text-xs text-gray-600 flex-1">{p.nombre}</span>
                            <input type="number" placeholder="0" value={editForm.precios[i] ?? ""} onChange={(e) => setEditForm({ ...editForm, precios: { ...editForm.precios, [i]: e.target.value } })}
                              className="w-24 border border-gray-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
                          </div>
                        ))}
                      </div>
                      <textarea placeholder="Nota (opcional)" value={editForm.nota} onChange={(e) => setEditForm({ ...editForm, nota: e.target.value })} rows={2}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                      <div className="flex gap-2">
                        <button onClick={() => guardarEdicion(s)} disabled={guardando} className="bg-blue-600 text-white text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                          {guardando ? "Guardando..." : "Guardar cambios"}
                        </button>
                        <button onClick={() => setEditandoId(null)} className="border border-gray-300 text-gray-600 text-xs px-3 py-1.5 rounded-lg hover:bg-gray-50">
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}

                  {s.estado === "publicado" && s.disenoUrl && (
                    <div className="mt-3 flex items-center gap-3">
                      <p className="text-xs text-green-600 font-medium">¡Tu promo fue publicada!</p>
                      <button
                        onClick={() => descargarDiseno(s.disenoUrl!, `promo-semana${s.semana}`)}
                        className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 transition-colors font-medium"
                      >
                        ⬇ Descargar diseño
                      </button>
                    </div>
                  )}
                  {s.estado === "publicado" && !s.disenoUrl && (
                    <p className="text-xs text-green-600 mt-2">Publicado — el equipo de marketing completó tu solicitud.</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
