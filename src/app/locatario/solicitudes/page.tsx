"use client";

import { useEffect, useState } from "react";
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import Lightbox from "@/components/Lightbox";
import Link from "next/link";

interface Producto { nombre: string; precio: number; }

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

const descargarDiseno = async (url: string, nombre: string) => {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${nombre}.jpg`;
    a.click();
    URL.revokeObjectURL(a.href);
  } catch { window.open(url, "_blank"); }
};

function SolicitudCard({ s, onLightbox }: { s: Solicitud; onLightbox: (url: string, nombre: string) => void }) {
  const [expandida, setExpandida] = useState(false);
  const [editando, setEditando] = useState(false);
  const [editForm, setEditForm] = useState({ fechaInicio: s.fechaInicio ?? "", fechaFin: s.fechaFin ?? "", nota: s.nota ?? "", precios: Object.fromEntries(s.productos.map((p, i) => [i, String(p.precio)])) as Record<number, string> });
  const [guardando, setGuardando] = useState(false);

  const fecha = s.creadoEn ? new Date(s.creadoEn.seconds * 1000).toLocaleDateString("es-PE", { day: "numeric", month: "short", year: "numeric" }) : "";

  const guardar = async () => {
    setGuardando(true);
    await updateDoc(doc(db, "solicitudes", s.id), {
      productos: s.productos.map((p, i) => ({ ...p, precio: parseFloat(editForm.precios[i] ?? "0") || p.precio })),
      fechaInicio: editForm.fechaInicio,
      fechaFin: editForm.fechaFin,
      nota: editForm.nota,
    });
    setEditando(false);
    setGuardando(false);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      {/* Diseño expandible (solo publicados con diseño) */}
      {s.estado === "publicado" && s.disenoUrl && (
        <>
          <button
            onClick={() => setExpandida(!expandida)}
            className="w-full flex items-center justify-between px-4 py-3 bg-green-50 border-b border-green-100 hover:bg-green-100 transition-colors"
          >
            <span className="text-sm font-semibold text-green-700">🎨 Ver diseño publicado</span>
            <span className="text-xs text-green-600 font-medium">{expandida ? "▲ Ocultar" : "▼ Ver"}</span>
          </button>
          {expandida && (
            <div className="relative cursor-pointer group" onClick={() => onLightbox(s.disenoUrl!, `promo-semana${s.semana}`)}>
              <img src={s.disenoUrl} alt="Diseño" className="w-full max-h-72 object-contain bg-gray-50" />
              <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/10 transition-colors">
                <span className="opacity-0 group-hover:opacity-100 bg-white/90 text-gray-700 text-xs font-medium px-3 py-1.5 rounded-lg shadow">🔍 Ver completo</span>
              </div>
            </div>
          )}
        </>
      )}

      <div className="p-4 space-y-3">
        {/* Productos */}
        <div className="flex flex-wrap gap-1.5">
          {s.productos.map((p, i) => (
            <span key={i} className="bg-gray-50 border border-gray-200 text-gray-700 text-xs px-2.5 py-1 rounded-lg font-medium">
              {p.nombre}{p.precio > 0 ? ` — S/${p.precio}` : ""}
            </span>
          ))}
        </div>

        {/* Meta */}
        <div className="flex flex-col gap-0.5">
          <p className="text-xs text-gray-500">Semana {s.semana} · Enviado el {fecha}</p>
          {s.fechaInicio && (
            <p className="text-xs text-gray-500">📅 Vigencia: {s.fechaInicio} → {s.fechaFin}</p>
          )}
          {s.nota && <p className="text-xs text-gray-400 italic">"{s.nota}"</p>}
        </div>

        {/* Acciones según estado */}
        {s.estado === "pendiente" && !editando && (
          <button onClick={() => setEditando(true)} className="text-xs text-blue-600 font-medium hover:underline">
            ✏️ Editar solicitud
          </button>
        )}

        {s.estado === "publicado" && (
          <div className="flex items-center gap-2 pt-1">
            <p className="text-xs text-green-600 font-semibold flex-1">¡Tu promo fue publicada! 🎉</p>
            {s.disenoUrl && (
              <button
                onClick={() => descargarDiseno(s.disenoUrl!, `promo-semana${s.semana}`)}
                className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 transition-colors font-medium flex-shrink-0"
              >
                ⬇ Descargar
              </button>
            )}
          </div>
        )}

        {/* Formulario de edición */}
        {editando && (
          <div className="border-t border-gray-100 pt-3 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Desde</label>
                <input type="date" value={editForm.fechaInicio}
                  onChange={(e) => setEditForm({ ...editForm, fechaInicio: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Hasta</label>
                <input type="date" value={editForm.fechaFin} min={editForm.fechaInicio}
                  onChange={(e) => setEditForm({ ...editForm, fechaFin: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-xs text-gray-500 font-medium">Precios</p>
              {s.productos.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs text-gray-600 flex-1 truncate">{p.nombre}</span>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <span className="text-xs text-gray-400">S/</span>
                    <input type="number" placeholder="0" value={editForm.precios[i] ?? ""}
                      onChange={(e) => setEditForm({ ...editForm, precios: { ...editForm.precios, [i]: e.target.value } })}
                      className="w-20 border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
              ))}
            </div>
            <textarea placeholder="Nota (opcional)" value={editForm.nota}
              onChange={(e) => setEditForm({ ...editForm, nota: e.target.value })} rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            <div className="flex gap-2">
              <button onClick={guardar} disabled={guardando}
                className="flex-1 bg-blue-600 text-white text-sm font-medium py-2.5 rounded-xl hover:bg-blue-700 disabled:opacity-50">
                {guardando ? "Guardando..." : "Guardar cambios"}
              </button>
              <button onClick={() => setEditando(false)}
                className="px-4 border border-gray-300 text-gray-600 text-sm rounded-xl hover:bg-gray-50">
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const GRUPOS = [
  { estado: "en_diseno", label: "En diseño", icon: "✏️", bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-100" },
  { estado: "pendiente", label: "Pendientes", icon: "🕐", bg: "bg-yellow-50", text: "text-yellow-700", border: "border-yellow-100" },
  { estado: "publicado", label: "Publicadas", icon: "✅", bg: "bg-green-50", text: "text-green-700", border: "border-green-100" },
];

export default function SolicitudesPage() {
  const { user } = useAuth();
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState<{ url: string; nombre: string } | null>(null);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "solicitudes"), where("uid", "==", user.uid), orderBy("creadoEn", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setSolicitudes(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Solicitud)));
      setLoading(false);
    });
    return () => unsub();
  }, [user]);

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;

  if (solicitudes.length === 0) return (
    <div className="p-4 md:p-8">
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Mis solicitudes</h1>
      <div className="text-center py-16 text-gray-400">
        <p className="text-4xl mb-3">📭</p>
        <p className="font-medium text-gray-500">Aún no has enviado solicitudes</p>
        <Link href="/locatario/solicitar" className="text-blue-600 text-sm underline mt-2 inline-block">
          Solicitar primera promo
        </Link>
      </div>
    </div>
  );

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      {lightbox && (
        <Lightbox url={lightbox.url} onClose={() => setLightbox(null)}
          onDescargar={() => { descargarDiseno(lightbox.url, lightbox.nombre); setLightbox(null); }} />
      )}
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Mis solicitudes</h1>

      <div className="space-y-6">
        {GRUPOS.map(({ estado, label, icon, bg, text, border }) => {
          const grupo = solicitudes.filter((s) => s.estado === estado);
          if (grupo.length === 0) return null;
          return (
            <div key={estado}>
              {/* Encabezado de grupo */}
              <div className={`flex items-center gap-2 px-3 py-2 rounded-xl ${bg} border ${border} mb-3`}>
                <span className="text-base">{icon}</span>
                <span className={`text-sm font-bold ${text}`}>{label}</span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full bg-white/60 ${text}`}>{grupo.length}</span>
              </div>
              <div className="space-y-3 pl-1">
                {grupo.map((s) => (
                  <SolicitudCard key={s.id} s={s} onLightbox={(url, nombre) => setLightbox({ url, nombre })} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
