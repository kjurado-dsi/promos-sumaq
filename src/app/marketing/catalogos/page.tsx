"use client";

import { useEffect, useState, useRef } from "react";
import { collection, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Lightbox from "@/components/Lightbox";

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

type FotoSlot = "foto2Url" | "foto3Url";

const descargar = async (url: string, nombre: string) => {
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

export default function MarketingCatalogosPage() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [filtroRubro, setFiltroRubro] = useState("todos");
  const [filtroLocal, setFiltroLocal] = useState("todos");
  const [subiendoFoto, setSubiendoFoto] = useState<{ id: string; slot: FotoSlot } | null>(null);
  const [lightbox, setLightbox] = useState<{ url: string; nombre: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "productos"), (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Producto));
      docs.sort((a, b) => (a.local ?? "zzz").localeCompare(b.local ?? "zzz"));
      setProductos(docs);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const abrirSubida = (id: string, slot: FotoSlot) => {
    setSubiendoFoto({ id, slot });
    setTimeout(() => fileRef.current?.click(), 50);
  };

  const handleFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!subiendoFoto) return;
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const data = await res.json();
    if (data.url) await updateDoc(doc(db, "productos", subiendoFoto.id), { [subiendoFoto.slot]: data.url });
    e.target.value = "";
    setSubiendoFoto(null);
  };

  // Locales únicos para el filtro
  const localesUnicos = ["todos", ...Array.from(new Set(productos.map((p) => p.local ?? "").filter(Boolean))).sort()];
  const rubrosUnicos = ["todos", ...Array.from(new Set(productos.map((p) => p.tipo))).sort()];

  const filtrados = productos
    .filter((p) => filtroRubro === "todos" || p.tipo === filtroRubro)
    .filter((p) => filtroLocal === "todos" || p.local === filtroLocal)
    .filter((p) => !busqueda || p.nombre.toLowerCase().includes(busqueda.toLowerCase()) || p.locatarioNombre?.toLowerCase().includes(busqueda.toLowerCase()));

  // Agrupar por local + locatarioNombre, ordenado por local
  const grupos = filtrados.reduce<Record<string, Producto[]>>((acc, p) => {
    const key = `${(p.local ?? "Sin local").padStart(4, "0")}__${p.uid}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(p);
    return acc;
  }, {});
  const gruposOrdenados = Object.entries(grupos).sort(([a], [b]) => a.localeCompare(b));
  const [colapsados, setColapsados] = useState<Set<string>>(new Set());
  const toggleGrupo = (key: string) =>
    setColapsados((prev) => { const s = new Set(prev); s.has(key) ? s.delete(key) : s.add(key); return s; });

  return (
    <div className="p-4 md:p-8">
      {lightbox && (
        <Lightbox
          url={lightbox.url}
          onClose={() => setLightbox(null)}
          onDescargar={() => { descargar(lightbox.url, lightbox.nombre); setLightbox(null); }}
        />
      )}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold text-gray-900">Catálogos</h1>
        <input
          placeholder="Buscar nombre o locatario..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-60"
        />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 font-medium">Rubro:</span>
          <div className="flex gap-1 flex-wrap">
            {rubrosUnicos.map((r) => (
              <button key={r} onClick={() => setFiltroRubro(r)}
                className={`text-xs px-3 py-1 rounded-full border capitalize transition-colors ${filtroRubro === r ? "bg-blue-600 text-white border-blue-600" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}>
                {r === "todos" ? "Todos" : r}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 font-medium">Local:</span>
          <div className="flex gap-1 flex-wrap">
            {localesUnicos.map((l) => (
              <button key={l} onClick={() => setFiltroLocal(l)}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${filtroLocal === l ? "bg-blue-600 text-white border-blue-600" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}>
                {l === "todos" ? "Todos" : `Local ${l}`}
              </button>
            ))}
          </div>
        </div>
      </div>

      <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleFoto} className="hidden" />

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
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
            const colapsado = colapsados.has(key);
            return (
              <div key={key}>
                {/* Cabecera del grupo — clic para colapsar */}
                <button
                  onClick={() => toggleGrupo(key)}
                  className="w-full flex items-center gap-3 mb-3 hover:opacity-80 transition-opacity text-left"
                >
                  <span className="bg-blue-900 text-white text-xs font-bold px-3 py-1 rounded-lg">
                    Local {p0.local ?? "—"}
                  </span>
                  <span className="text-sm font-semibold text-gray-800">{p0.locatarioNombre ?? "Sin nombre"}</span>
                  <span className="text-xs text-gray-400">{prods.length} producto{prods.length !== 1 ? "s" : ""}</span>
                  <span className="ml-auto text-gray-400 text-sm">{colapsado ? "▶" : "▼"}</span>
                </button>

                {!colapsado && <div className="space-y-2">
                  {prods.map((p) => {
                    const fotos = [p.fotoUrl, p.foto2Url, p.foto3Url].filter(Boolean) as string[];
                    return (
                      <div key={p.id} className="bg-white border border-gray-200 rounded-xl p-4 flex gap-4">
                        {/* Fotos con descarga */}
                        <div className="flex gap-2 flex-shrink-0 flex-wrap">
                          {fotos.map((url, i) => (
                            <div key={i} className="relative group cursor-pointer" onClick={() => setLightbox({ url, nombre: `${p.local}-${p.nombre}-foto${i + 1}` })}>
                              <img src={url} alt={p.nombre} className="w-20 h-20 object-cover rounded-lg border border-gray-200" />
                              <div className="absolute inset-0 bg-black/40 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <span className="text-white text-xs font-medium">🔍</span>
                              </div>
                            </div>
                          ))}
                          {fotos.length < 3 && (
                            <button
                              onClick={() => abrirSubida(p.id, fotos.length === 1 ? "foto2Url" : "foto3Url")}
                              className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors"
                            >
                              <span className="text-xl">+</span>
                              <span className="text-xs">foto</span>
                            </button>
                          )}
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
                      </div>
                    );
                  })}
                </div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
