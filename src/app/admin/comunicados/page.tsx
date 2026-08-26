"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";

interface Comunicado {
  id: string;
  titulo: string;
  contenido: string;
  tipo: "general" | "urgente" | "evento";
  activo: boolean;
  creadoEn: { seconds: number };
  autor: string;
}

const TIPOS = [
  { id: "general", label: "General", icon: "📢", color: "bg-blue-50 text-blue-700 border-blue-200" },
  { id: "urgente", label: "Urgente", icon: "🚨", color: "bg-red-50 text-red-700 border-red-200" },
  { id: "evento", label: "Evento", icon: "🎉", color: "bg-purple-50 text-purple-700 border-purple-200" },
] as const;

const EMPTY = { titulo: "", contenido: "", tipo: "general" as const, activo: true };

function tipoInfo(tipo: string) {
  return TIPOS.find(t => t.id === tipo) ?? TIPOS[0];
}

export default function ComunicadosAdminPage() {
  const { user } = useAuth();
  const [comunicados, setComunicados] = useState<Comunicado[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<Partial<Comunicado> | null>(null);
  const [guardando, setGuardando] = useState(false);

  const cargar = async () => {
    const snap = await getDocs(query(collection(db, "comunicados"), orderBy("creadoEn", "desc")));
    setComunicados(snap.docs.map(d => ({ id: d.id, ...d.data() } as Comunicado)));
    setLoading(false);
  };

  useEffect(() => { cargar(); }, []);

  const guardar = async () => {
    if (!modal?.titulo?.trim() || !modal?.contenido?.trim()) return;
    setGuardando(true);
    const { id, ...data } = modal as Comunicado;
    if (id) {
      await updateDoc(doc(db, "comunicados", id), data);
    } else {
      await addDoc(collection(db, "comunicados"), {
        ...data,
        autor: user?.displayName ?? "Admin",
        creadoEn: new Date(),
        activo: true,
      });
    }
    setModal(null);
    setGuardando(false);
    cargar();
  };

  const toggleActivo = async (c: Comunicado) => {
    await updateDoc(doc(db, "comunicados", c.id), { activo: !c.activo });
    cargar();
  };

  const eliminar = async (id: string) => {
    if (!confirm("¿Eliminar este comunicado?")) return;
    await deleteDoc(doc(db, "comunicados", id));
    cargar();
  };

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Comunicados</h1>
          <p className="text-sm text-gray-500 mt-0.5">Avisos que ven todos los locatarios</p>
        </div>
        <button onClick={() => setModal({ ...EMPTY })}
          className="text-sm px-4 py-2 bg-[#0d1f3c] text-white rounded-xl hover:bg-[#1a3358] transition-colors font-medium">
          + Nuevo comunicado
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : comunicados.length === 0 ? (
        <div className="text-center py-16 text-gray-400 bg-white border border-gray-200 rounded-2xl">
          <p className="text-4xl mb-3">📢</p>
          <p className="font-medium text-gray-500">No hay comunicados publicados</p>
        </div>
      ) : (
        <div className="space-y-3">
          {comunicados.map(c => {
            const t = tipoInfo(c.tipo);
            const fecha = c.creadoEn ? new Date(c.creadoEn.seconds * 1000).toLocaleDateString("es-PE", { day: "numeric", month: "short", year: "numeric" }) : "";
            return (
              <div key={c.id} className={`bg-white border rounded-2xl p-4 ${!c.activo ? "opacity-50" : ""}`}>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${t.color}`}>
                      {t.icon} {t.label}
                    </span>
                    {!c.activo && <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Oculto</span>}
                    <span className="text-xs text-gray-400">{fecha}</span>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => toggleActivo(c)} className="text-xs text-gray-500 hover:text-gray-700 hover:underline">
                      {c.activo ? "Ocultar" : "Mostrar"}
                    </button>
                    <button onClick={() => setModal(c)} className="text-xs text-blue-600 hover:underline">Editar</button>
                    <button onClick={() => eliminar(c.id)} className="text-xs text-red-400 hover:underline">Eliminar</button>
                  </div>
                </div>
                <p className="text-sm font-semibold text-gray-900 mb-1">{c.titulo}</p>
                <p className="text-sm text-gray-600 whitespace-pre-line leading-relaxed">{c.contenido}</p>
                <p className="text-xs text-gray-400 mt-2">Por {c.autor}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">{(modal as Comunicado).id ? "Editar comunicado" : "Nuevo comunicado"}</h2>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-2">Tipo</label>
                <div className="flex gap-2">
                  {TIPOS.map(t => (
                    <button key={t.id} onClick={() => setModal({ ...modal, tipo: t.id })}
                      className={`flex-1 text-xs py-2 rounded-lg border-2 font-medium transition-all ${modal.tipo === t.id ? t.color + " border-current" : "border-gray-200 text-gray-500 hover:border-gray-300"}`}>
                      {t.icon} {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Título *</label>
                <input value={modal.titulo ?? ""} onChange={e => setModal({ ...modal, titulo: e.target.value })}
                  placeholder="Ej: Reunión de locatarios — miércoles 27" maxLength={100}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Contenido *</label>
                <textarea value={modal.contenido ?? ""} onChange={e => setModal({ ...modal, contenido: e.target.value })}
                  rows={5} placeholder="Escribe el mensaje completo aquí..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={guardar} disabled={guardando || !modal.titulo?.trim() || !modal.contenido?.trim()}
                  className="flex-1 bg-[#0d1f3c] text-white font-semibold py-3 rounded-xl hover:bg-[#1a3358] disabled:opacity-40 transition-colors">
                  {guardando ? "Publicando..." : "Publicar"}
                </button>
                <button onClick={() => setModal(null)}
                  className="px-5 border border-gray-300 text-gray-600 rounded-xl hover:bg-gray-50 transition-colors">
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
