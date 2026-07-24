"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, doc, deleteDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface Producto {
  id: string;
  uid: string;
  nombre: string;
  tipo: string;
  descripcion?: string;
  local?: string;
  locatarioNombre?: string;
  fotoUrl?: string;
  foto2Url?: string;
  foto3Url?: string;
}

const FOTO_SLOTS = ["fotoUrl", "foto2Url", "foto3Url"] as const;

export default function AdminCatalogosPage() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "productos"), (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Producto));
      docs.sort((a, b) => (a.local ?? "zzz").localeCompare(b.local ?? "zzz"));
      setProductos(docs);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const eliminarProducto = async (id: string, nombre: string) => {
    if (!confirm(`¿Eliminar "${nombre}" del catálogo? No se puede deshacer.`)) return;
    await deleteDoc(doc(db, "productos", id));
  };

  const eliminarFoto = async (id: string, slot: typeof FOTO_SLOTS[number]) => {
    if (!confirm("¿Eliminar esta foto?")) return;
    await updateDoc(doc(db, "productos", id), { [slot]: null });
  };

  const filtrados = productos.filter((p) =>
    !busqueda ||
    p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    (p.locatarioNombre ?? "").toLowerCase().includes(busqueda.toLowerCase()) ||
    (p.local ?? "").includes(busqueda)
  );

  // Agrupar por local/uid
  const grupos = filtrados.reduce<Record<string, Producto[]>>((acc, p) => {
    const key = `${(p.local ?? "zzz").padStart(4, "0")}__${p.uid}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(p);
    return acc;
  }, {});
  const gruposOrdenados = Object.entries(grupos).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Catálogos</h1>
          <p className="text-sm text-gray-500">Gestión de productos de locatarios</p>
        </div>
        <input
          placeholder="Buscar producto o locatario..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d1f3c] w-56"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0d1f3c]" />
        </div>
      ) : gruposOrdenados.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-4xl mb-3">📦</p>
          <p>Sin productos registrados</p>
        </div>
      ) : (
        <div className="space-y-8 max-w-4xl">
          {gruposOrdenados.map(([key, prods]) => {
            const p0 = prods[0];
            return (
              <div key={key}>
                <div className="flex items-center gap-3 mb-3">
                  <span className="bg-[#0d1f3c] text-white text-xs font-bold px-3 py-1 rounded-lg">
                    Local {p0.local ?? "—"}
                  </span>
                  <span className="text-sm font-semibold text-gray-800">{p0.locatarioNombre ?? "Sin nombre"}</span>
                  <span className="text-xs text-gray-400">{prods.length} producto{prods.length !== 1 ? "s" : ""}</span>
                </div>

                <div className="space-y-2">
                  {prods.map((p) => {
                    const fotos = FOTO_SLOTS.map((s) => ({ slot: s, url: p[s] })).filter((f) => f.url);
                    return (
                      <div key={p.id} className="bg-white border border-gray-200 rounded-xl p-4 flex gap-4">
                        {/* Fotos con botón eliminar */}
                        <div className="flex gap-2 flex-shrink-0 flex-wrap">
                          {fotos.map(({ slot, url }) => (
                            <div key={slot} className="relative group">
                              <img src={url!} alt={p.nombre} className="w-20 h-20 object-cover rounded-lg border border-gray-200" />
                              <button
                                onClick={() => eliminarFoto(p.id, slot)}
                                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow"
                                title="Eliminar foto"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                          {fotos.length === 0 && (
                            <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center text-2xl">📦</div>
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-medium text-gray-900">{p.nombre}</span>
                            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full capitalize">{p.tipo}</span>
                          </div>
                          {p.descripcion && <p className="text-xs text-gray-400">{p.descripcion}</p>}
                          <p className="text-xs text-gray-300 mt-1">{fotos.length}/3 fotos</p>
                        </div>

                        {/* Eliminar producto */}
                        <button
                          onClick={() => eliminarProducto(p.id, p.nombre)}
                          className="flex-shrink-0 text-xs text-red-400 hover:text-red-600 hover:bg-red-50 border border-red-200 rounded-lg px-3 py-1.5 transition-colors self-start"
                        >
                          Eliminar
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
