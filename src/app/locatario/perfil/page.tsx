"use client";

import { useEffect, useState, useRef } from "react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";

interface Perfil {
  nombreCompleto: string;
  celular: string;
  local: string;
  logoUrl?: string;
}

export default function PerfilPage() {
  const { user } = useAuth();
  const [perfil, setPerfil] = useState<Perfil>({ nombreCompleto: "", celular: "", local: "" });
  const [form, setForm] = useState<Perfil>({ nombreCompleto: "", celular: "", local: "" });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const logoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, "users", user.uid)).then((snap) => {
      if (snap.exists()) {
        const d = snap.data();
        const datos: Perfil = {
          nombreCompleto: d.nombreCompleto ?? user.displayName ?? "",
          celular: d.celular ?? "",
          local: d.local ?? "",
          logoUrl: d.logoUrl,
        };
        setPerfil(datos);
        setForm(datos);
        if (d.logoUrl) setLogoPreview(d.logoUrl);
      } else {
        // Primer acceso — abrir en modo edición
        setForm({ nombreCompleto: user.displayName ?? "", celular: "", local: "" });
        setEditing(true);
      }
      setLoading(false);
    });
  }, [user]);

  const handleLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const cancelar = () => {
    setForm(perfil);
    setLogoPreview(perfil.logoUrl ?? null);
    setLogoFile(null);
    setEditing(false);
  };

  const guardar = async () => {
    if (!user || !form.nombreCompleto || !form.local || !form.celular) return;
    setSaving(true);
    let logoUrl: string | undefined;
    if (logoFile) {
      const fd = new FormData();
      fd.append("file", logoFile);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      logoUrl = data.url ?? "";
    }
    const updated: Perfil = {
      ...form,
      logoUrl: logoUrl ?? perfil.logoUrl,
    };
    await updateDoc(doc(db, "users", user.uid), {
      nombreCompleto: form.nombreCompleto,
      celular: form.celular,
      local: form.local,
      ...(logoUrl !== undefined && { logoUrl }),
    });
    setPerfil(updated);
    setLogoFile(null);
    setSaving(false);
    setSaved(true);
    setEditing(false);
    setTimeout(() => setSaved(false), 2500);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-lg">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-semibold text-gray-900">Mi perfil</h1>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="text-sm text-blue-600 hover:underline font-medium"
          >
            Editar perfil
          </button>
        )}
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Estos datos se incluyen automáticamente en cada solicitud de promo
      </p>

      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        {/* Logo */}
        <div className="flex items-center gap-4">
          {logoPreview ? (
            <img src={logoPreview} alt="Logo" className="w-20 h-20 object-contain rounded-xl border border-gray-200 bg-gray-50 p-1 flex-shrink-0" />
          ) : (
            <div className="w-20 h-20 bg-gray-100 rounded-xl flex items-center justify-center text-3xl flex-shrink-0">🖼️</div>
          )}
          <div>
            <p className="text-sm font-medium text-gray-700">Logo del local</p>
            {editing ? (
              <>
                <input ref={logoRef} type="file" accept="image/*" onChange={handleLogo} className="hidden" />
                <button onClick={() => logoRef.current?.click()} className="text-xs text-blue-600 hover:underline mt-1">
                  {logoPreview ? "Cambiar logo" : "Subir logo"}
                </button>
              </>
            ) : (
              <p className="text-xs text-gray-400 mt-0.5">{logoPreview ? "Logo cargado" : "Sin logo"}</p>
            )}
          </div>
        </div>

        <hr className="border-gray-100" />

        {/* Nombre */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">Nombre completo</label>
          {editing ? (
            <input
              value={form.nombreCompleto}
              onChange={(e) => setForm({ ...form, nombreCompleto: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          ) : (
            <p className="text-sm text-gray-900 font-medium">{perfil.nombreCompleto || <span className="text-gray-400 italic">No registrado</span>}</p>
          )}
        </div>

        {/* Local y celular */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Número de local</label>
            {editing ? (
              <input
                placeholder="Ej: 14"
                value={form.local}
                onChange={(e) => setForm({ ...form, local: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            ) : (
              <p className="text-sm text-gray-900 font-medium">{perfil.local || <span className="text-gray-400 italic">No registrado</span>}</p>
            )}
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Celular</label>
            {editing ? (
              <input
                placeholder="Ej: 999 888 777"
                value={form.celular}
                onChange={(e) => setForm({ ...form, celular: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            ) : (
              <p className="text-sm text-gray-900 font-medium">{perfil.celular || <span className="text-gray-400 italic">No registrado</span>}</p>
            )}
          </div>
        </div>

        {/* Botones */}
        {editing && (
          <div className="flex gap-2 pt-1">
            <button
              onClick={guardar}
              disabled={saving || !form.nombreCompleto || !form.local || !form.celular}
              className="flex-1 bg-blue-600 text-white text-sm font-medium py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors"
            >
              {saving ? "Guardando..." : "Guardar"}
            </button>
            <button
              onClick={cancelar}
              className="px-4 border border-gray-300 text-gray-600 text-sm rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
          </div>
        )}

        {saved && (
          <p className="text-sm text-green-600 text-center font-medium">¡Perfil guardado correctamente ✓</p>
        )}
      </div>
    </div>
  );
}
