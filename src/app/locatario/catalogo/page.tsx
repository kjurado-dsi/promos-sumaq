"use client";

import { useEffect, useState, useRef } from "react";
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, updateDoc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";

interface Producto {
  id: string;
  nombre: string;
  tipo: "producto" | "servicio";
  descripcion?: string;
  fotoUrl?: string;
  foto2Url?: string;
  foto3Url?: string;
}

type FotoSlot = "fotoUrl" | "foto2Url" | "foto3Url";

const subirFoto = async (file: File): Promise<string> => {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: fd });
  const data = await res.json();
  return data.url ?? "";
};

export default function CatalogoPage() {
  const { user } = useAuth();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState<Producto | null>(null);
  const [form, setForm] = useState({ nombre: "", tipo: "producto", descripcion: "" });
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  // Para fotos adicionales en edición
  const [subiendo, setSubiendo] = useState<FotoSlot | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const extraFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "productos"), where("uid", "==", user.uid));
    const unsub = onSnapshot(q, (snap) => {
      setProductos(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Producto)));
    });
    return () => unsub();
  }, [user]);

  const handleFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFotoFile(file);
    setFotoPreview(URL.createObjectURL(file));
  };

  const handleExtraFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!editando || !subiendo) return;
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await subirFoto(file);
    if (url) {
      await updateDoc(doc(db, "productos", editando.id), { [subiendo]: url });
      setEditando({ ...editando, [subiendo]: url });
    }
    e.target.value = "";
    setSubiendo(null);
  };

  const abrirExtraFoto = (slot: FotoSlot) => {
    setSubiendo(slot);
    setTimeout(() => extraFileRef.current?.click(), 50);
  };

  const guardar = async () => {
    if (!form.nombre || !user) return;
    setSaving(true);
    let fotoUrl = "";
    if (fotoFile) fotoUrl = await subirFoto(fotoFile);

    if (editando) {
      await updateDoc(doc(db, "productos", editando.id), {
        nombre: form.nombre,
        tipo: form.tipo,
        descripcion: form.descripcion,
        ...(fotoUrl && { fotoUrl }),
      });
    } else {
      // Leer perfil para incluir local y nombre en el producto
      const perfil = await getDoc(doc(db, "users", user.uid));
      const perfilData = perfil.exists() ? perfil.data() : {};
      await addDoc(collection(db, "productos"), {
        uid: user.uid,
        locatarioNombre: perfilData.nombreCompleto ?? user.displayName,
        local: perfilData.local ?? "",
        nombre: form.nombre,
        tipo: form.tipo,
        descripcion: form.descripcion,
        fotoUrl,
        creadoEn: new Date(),
      });
    }
    resetForm();
    setSaving(false);
  };

  const resetForm = () => {
    setForm({ nombre: "", tipo: "producto", descripcion: "" });
    setFotoFile(null);
    setFotoPreview(null);
    setShowForm(false);
    setEditando(null);
  };

  const abrirEdicion = (p: Producto) => {
    setEditando(p);
    setForm({ nombre: p.nombre, tipo: p.tipo, descripcion: p.descripcion ?? "" });
    setFotoPreview(p.fotoUrl ?? null);
    setFotoFile(null);
    setShowForm(true);
  };

  const eliminarFoto = async (p: Producto, slot: FotoSlot) => {
    await updateDoc(doc(db, "productos", p.id), { [slot]: "" });
    if (editando?.id === p.id) setEditando({ ...editando, [slot]: "" });
  };

  const eliminar = async (id: string) => {
    if (confirm("¿Eliminar este producto?")) await deleteDoc(doc(db, "productos", id));
  };

  const productoActual = editando
    ? productos.find((p) => p.id === editando.id) ?? editando
    : null;

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Mi catálogo</h1>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="bg-blue-600 text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-blue-700 transition-colors"
          >
            + Agregar
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">
            {editando ? "Editar producto" : "Nuevo producto o servicio"}
          </h2>
          <div className="space-y-3">
            <div className="flex gap-3">
              {["producto", "servicio"].map((t) => (
                <label key={t} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer capitalize">
                  <input type="radio" name="tipo" value={t} checked={form.tipo === t} onChange={(e) => setForm({ ...form, tipo: e.target.value })} />
                  {t}
                </label>
              ))}
            </div>
            <input
              placeholder="Nombre"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              placeholder="Descripción (opcional)"
              value={form.descripcion}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            {/* Foto principal */}
            <div>
              <p className="text-sm text-gray-700 mb-2">Foto principal</p>
              <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleFoto} className="hidden" />
              {fotoPreview ? (
                <div className="relative w-32 h-32">
                  <img src={fotoPreview} alt="Preview" className="w-32 h-32 object-cover rounded-lg border border-gray-200" />
                  <button onClick={() => { setFotoPreview(null); setFotoFile(null); }} className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full text-xs flex items-center justify-center">×</button>
                </div>
              ) : (
                <button onClick={() => fileRef.current?.click()} className="w-full border-2 border-dashed border-gray-300 rounded-lg py-5 text-center hover:border-blue-400 transition-colors">
                  <p className="text-2xl mb-1">📷</p>
                  <p className="text-sm text-gray-500">Tomar foto o elegir de galería</p>
                </button>
              )}
            </div>

            {/* Fotos adicionales solo en edición */}
            {editando && (
              <div>
                <p className="text-sm text-gray-700 mb-2">Fotos adicionales para MKT <span className="text-xs text-gray-400">(máx. 2 extra)</span></p>
                <input ref={extraFileRef} type="file" accept="image/*" capture="environment" onChange={handleExtraFoto} className="hidden" />
                <div className="flex gap-2">
                  {(["foto2Url", "foto3Url"] as FotoSlot[]).map((slot, i) => {
                    const url = productoActual?.[slot];
                    return url ? (
                      <div key={slot} className="relative w-24 h-24">
                        <img src={url} alt={`Foto ${i + 2}`} className="w-24 h-24 object-cover rounded-lg border border-gray-200" />
                        <button onClick={() => eliminarFoto(productoActual!, slot)} className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center">×</button>
                      </div>
                    ) : (
                      productoActual?.[i === 0 ? "foto2Url" : "foto2Url"] !== undefined || i === 0 ? (
                        <button key={slot} onClick={() => abrirExtraFoto(slot)} className="w-24 h-24 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:border-blue-400 transition-colors text-xs gap-1">
                          <span className="text-xl">+</span>
                          <span>Foto {i + 2}</span>
                        </button>
                      ) : null
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button onClick={guardar} disabled={saving} className="bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {saving ? "Guardando..." : "Guardar"}
              </button>
              <button onClick={resetForm} className="border border-gray-300 text-gray-600 text-sm px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {productos.length === 0 && !showForm ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">📦</p>
          <p className="font-medium text-gray-500">Tu catálogo está vacío</p>
          <p className="text-sm mt-1">Agrega tus productos o servicios para poder solicitar promos</p>
        </div>
      ) : (
        <div className="space-y-2">
          {productos.map((p) => {
            const fotos = [p.fotoUrl, p.foto2Url, p.foto3Url].filter(Boolean) as string[];
            return (
              <div key={p.id} className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-4">
                <div className="flex gap-1.5 flex-shrink-0">
                  {fotos.length > 0 ? (
                    fotos.map((url, i) => (
                      <img key={i} src={url} alt={p.nombre} className="w-14 h-14 object-cover rounded-lg border border-gray-100" />
                    ))
                  ) : (
                    <div className="w-14 h-14 bg-gray-100 rounded-lg flex items-center justify-center text-2xl">📦</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{p.nombre}</span>
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full capitalize">{p.tipo}</span>
                  </div>
                  {p.descripcion && <p className="text-xs text-gray-400 mt-0.5 truncate">{p.descripcion}</p>}
                  <p className="text-xs text-gray-300 mt-0.5">{fotos.length}/3 fotos</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => abrirEdicion(p)} className="text-xs text-blue-600 hover:underline">Editar</button>
                  <button onClick={() => eliminar(p.id)} className="text-gray-300 hover:text-red-500 transition-colors text-lg">×</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
