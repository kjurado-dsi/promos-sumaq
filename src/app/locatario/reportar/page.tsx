"use client";

import { useEffect, useState } from "react";
import { collection, addDoc, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";

const TIPOS = [
  { id: "incidente", label: "🚨 Incidente", desc: "Algo urgente que afecta el funcionamiento" },
  { id: "mantenimiento", label: "🔧 Mantenimiento", desc: "Reparación o revisión necesaria" },
  { id: "solicitud", label: "📋 Solicitud", desc: "Pedido al mercado (limpieza, seguridad...)" },
  { id: "sugerencia", label: "💡 Sugerencia", desc: "Idea para mejorar el mercado" },
];

const AREAS = [
  "Mi local",
  "Pasillo / Zona común",
  "Baños",
  "Estacionamiento",
  "Zona de carga / descarga",
  "Zona de comidas",
  "Servicios (agua / luz)",
  "Seguridad",
  "Otro",
];

export default function ReportarPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [perfil, setPerfil] = useState<{ nombreCompleto: string; local: string } | null>(null);
  const [tipo, setTipo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [area, setArea] = useState("");
  const [urgente, setUrgente] = useState(false);
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, "users", user.uid)).then((snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setPerfil({ nombreCompleto: d.nombreCompleto ?? user.displayName ?? "", local: d.local ?? "" });
      }
    });
  }, [user]);

  const handleFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFotoFile(f);
    setFotoPreview(URL.createObjectURL(f));
  };

  const enviar = async () => {
    if (!tipo) { setError("Selecciona el tipo de reporte."); return; }
    if (descripcion.trim().length < 10) { setError("Describe el problema con al menos 10 caracteres."); return; }
    if (!area) { setError("Selecciona el área afectada."); return; }
    if (!user || !perfil) return;
    setError("");
    setEnviando(true);

    let fotoUrl = "";
    if (fotoFile) {
      const form = new FormData();
      form.append("file", fotoFile);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const json = await res.json();
      fotoUrl = json.url ?? "";
    }

    await addDoc(collection(db, "reportes"), {
      uid: user.uid,
      locatarioNombre: perfil.nombreCompleto,
      locatarioEmail: user.email,
      local: perfil.local,
      tipo,
      descripcion: descripcion.trim(),
      area,
      urgente,
      fotoUrl,
      estado: "recibido",
      comentarioAdmin: "",
      historial: [],
      creadoEn: new Date(),
    });

    // Notificar al admin por email
    const tipoLabel: Record<string, string> = {
      incidente: "🚨 Incidente", mantenimiento: "🔧 Mantenimiento",
      solicitud: "📋 Solicitud", sugerencia: "💡 Sugerencia",
    };
    fetch("/api/send-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: "kaeloful@gmail.com",
        subject: `${urgente ? "🚨 URGENTE — " : ""}Nuevo reporte: ${perfil.nombreCompleto} (Local ${perfil.local})`,
        html: `
          <div style="font-family:sans-serif;max-width:520px;margin:0 auto">
            <h2 style="color:#0d1f3c;margin-bottom:4px">Nuevo reporte recibido</h2>
            <p style="color:#6b7280;font-size:14px;margin-bottom:16px">Sumaq Operativo · ${new Date().toLocaleString("es-PE")}</p>
            ${urgente ? '<div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:10px 14px;margin-bottom:16px;color:#b91c1c;font-weight:600">⚠️ MARCADO COMO URGENTE</div>' : ""}
            <table style="width:100%;border-collapse:collapse;font-size:14px">
              <tr><td style="padding:8px 0;color:#6b7280;width:120px">Locatario</td><td style="padding:8px 0;font-weight:600;color:#111">${perfil.nombreCompleto}</td></tr>
              <tr><td style="padding:8px 0;color:#6b7280">Local</td><td style="padding:8px 0;color:#111">${perfil.local}</td></tr>
              <tr><td style="padding:8px 0;color:#6b7280">Tipo</td><td style="padding:8px 0;color:#111">${tipoLabel[tipo] ?? tipo}</td></tr>
              <tr><td style="padding:8px 0;color:#6b7280">Área</td><td style="padding:8px 0;color:#111">${area}</td></tr>
              <tr><td style="padding:8px 0;color:#6b7280;vertical-align:top">Descripción</td><td style="padding:8px 0;color:#111">${descripcion.trim()}</td></tr>
              ${fotoUrl ? `<tr><td style="padding:8px 0;color:#6b7280">Foto</td><td style="padding:8px 0"><a href="${fotoUrl}" style="color:#2563eb">Ver foto adjunta</a></td></tr>` : ""}
            </table>
            <div style="margin-top:20px">
              <a href="https://operaciones-sumaq-five.vercel.app/admin/reportes" style="background:#0d1f3c;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">
                Ver en el panel →
              </a>
            </div>
          </div>
        `,
      }),
    }).catch(() => {}); // no bloquea el flujo si falla

    router.push("/locatario/reportes?nuevo=1");
  };

  return (
    <div className="p-4 md:p-8 max-w-xl">
      <h1 className="text-2xl font-semibold text-gray-900 mb-1">Nuevo reporte</h1>
      <p className="text-sm text-gray-500 mb-6">
        {perfil ? `${perfil.nombreCompleto} · Local ${perfil.local}` : "Cargando perfil..."}
      </p>

      {/* Tipo */}
      <div className="mb-5">
        <label className="block text-sm font-semibold text-gray-700 mb-2">¿Qué tipo de reporte es? *</label>
        <div className="grid grid-cols-2 gap-2">
          {TIPOS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTipo(t.id)}
              className={`text-left p-3 rounded-xl border-2 transition-all ${
                tipo === t.id ? "border-[#0d1f3c] bg-[#0d1f3c]/5" : "border-gray-200 bg-white hover:border-gray-300"
              }`}
            >
              <p className="text-sm font-semibold text-gray-900">{t.label}</p>
              <p className="text-xs text-gray-400 mt-0.5 leading-tight">{t.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Área */}
      <div className="mb-5">
        <label className="block text-sm font-semibold text-gray-700 mb-2">Área afectada *</label>
        <select
          value={area}
          onChange={(e) => setArea(e.target.value)}
          className="w-full bg-white border border-gray-300 rounded-xl px-3 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0d1f3c] appearance-none"
        >
          <option value="">Selecciona el área →</option>
          {AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      {/* Descripción */}
      <div className="mb-5">
        <label className="block text-sm font-semibold text-gray-700 mb-2">Describe el problema *</label>
        <textarea
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          rows={4}
          placeholder="Explica qué pasó, dónde exactamente y desde cuándo..."
          className="w-full bg-white border border-gray-300 rounded-xl px-3 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0d1f3c] resize-none"
        />
        <p className="text-xs text-gray-400 mt-1 text-right">{descripcion.length} caracteres</p>
      </div>

      {/* Urgente */}
      <label className="flex items-center gap-3 mb-5 cursor-pointer bg-white border border-gray-200 rounded-xl p-3">
        <div
          onClick={() => setUrgente(!urgente)}
          className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${urgente ? "bg-red-500 border-red-500" : "border-gray-300"}`}
        >
          {urgente && <span className="text-white text-xs">✓</span>}
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900">Es urgente</p>
          <p className="text-xs text-gray-400">Requiere atención inmediata</p>
        </div>
      </label>

      {/* Foto */}
      <div className="mb-6">
        <label className="block text-sm font-semibold text-gray-700 mb-2">Foto (opcional)</label>
        {fotoPreview ? (
          <div className="relative">
            <img src={fotoPreview} alt="Preview" className="w-full max-h-48 object-cover rounded-xl border border-gray-200" />
            <button
              onClick={() => { setFotoFile(null); setFotoPreview(null); }}
              className="absolute top-2 right-2 bg-white rounded-full w-7 h-7 flex items-center justify-center text-gray-500 shadow border border-gray-200 text-sm"
            >✕</button>
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center bg-white border-2 border-dashed border-gray-300 rounded-xl py-8 cursor-pointer hover:border-gray-400 transition-colors">
            <span className="text-2xl mb-1">📷</span>
            <span className="text-sm text-gray-500">Toca para agregar una foto</span>
            <input type="file" accept="image/*" className="hidden" onChange={handleFoto} />
          </label>
        )}
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <button
        onClick={enviar}
        disabled={enviando}
        className="w-full bg-[#0d1f3c] text-white font-semibold py-3.5 rounded-xl hover:bg-[#1a3358] disabled:opacity-50 transition-colors text-base"
      >
        {enviando ? "Enviando..." : "Enviar reporte"}
      </button>
    </div>
  );
}
