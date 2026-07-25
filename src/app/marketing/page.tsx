"use client";

import { useEffect, useState, useRef } from "react";
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, getDocs, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Lightbox from "@/components/Lightbox";

interface Producto {
  nombre: string;
  precio: number;
  tipo?: string;
  descripcion?: string;
  fotoUrl?: string;
}

interface Solicitud {
  id: string;
  uid: string;
  locatarioNombre: string;
  locatarioEmail?: string;
  local: string;
  celular?: string;
  productos: Producto[];
  semana: number;
  fechaInicio?: string;
  fechaFin?: string;
  fechaEstimada?: string;
  nota?: string;
  logoUrl?: string;
  disenoUrl?: string;
  estado: "pendiente" | "en_diseno" | "publicado";
  creadoEn: { seconds: number };
}

interface HistorialItem {
  semana: number;
  productos: string[];
  disenoUrl?: string;
}

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

export default function MarketingPage() {
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [historial, setHistorial] = useState<Record<string, HistorialItem[]>>({});
  const [lightbox, setLightbox] = useState<{ url: string; nombre: string } | null>(null);
  const [modalId, setModalId] = useState<string | null>(null);
  const [disenoFile, setDisenoFile] = useState<File | null>(null);
  const [disenoPreview, setDisenoPreview] = useState<string | null>(null);
  const [redSocialUrl, setRedSocialUrl] = useState("");
  const [subiendo, setSubiendo] = useState(false);
  const [urlPublicada, setUrlPublicada] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const q = query(
      collection(db, "solicitudes"),
      where("estado", "in", ["pendiente", "en_diseno"]),
      orderBy("creadoEn", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setSolicitudes(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Solicitud)));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const tomar = async (id: string) => {
    await updateDoc(doc(db, "solicitudes", id), { estado: "en_diseno" });
  };

  const guardarFechaEstimada = async (id: string, fecha: string) => {
    await updateDoc(doc(db, "solicitudes", id), { fechaEstimada: fecha });
  };

  const expandir = async (s: Solicitud) => {
    const nuevoId = expandido === s.id ? null : s.id;
    setExpandido(nuevoId);
    // Cargar historial si no está cargado aún
    if (nuevoId && !historial[s.uid]) {
      const snap = await getDocs(
        query(
          collection(db, "solicitudes"),
          where("uid", "==", s.uid),
          where("estado", "==", "publicado"),
          orderBy("creadoEn", "desc"),
          limit(5)
        )
      );
      const items: HistorialItem[] = snap.docs
        .filter((d) => d.id !== s.id)
        .map((d) => {
          const data = d.data();
          return {
            semana: data.semana,
            productos: data.productos?.map((p: Producto) => p.nombre) ?? [],
            disenoUrl: data.disenoUrl,
          };
        });
      setHistorial((prev) => ({ ...prev, [s.uid]: items }));
    }
  };

  const abrirModal = (id: string) => {
    setModalId(id);
    setDisenoFile(null);
    setDisenoPreview(null);
  };

  const cerrarModal = () => {
    setModalId(null);
    setDisenoFile(null);
    setDisenoPreview(null);
    setRedSocialUrl("");
    setUrlPublicada(null);
    setCopiado(false);
  };

  const handleDiseno = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDisenoFile(file);
    setDisenoPreview(URL.createObjectURL(file));
  };

  const confirmarPublicar = async () => {
    if (!modalId) return;
    setSubiendo(true);
    let disenoUrl = "";
    if (disenoFile) {
      const fd = new FormData();
      fd.append("file", disenoFile);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      disenoUrl = data.url ?? "";
    }
    const sol = solicitudes.find((s) => s.id === modalId);
    await updateDoc(doc(db, "solicitudes", modalId), {
      estado: "publicado",
      ...(disenoUrl && { disenoUrl }),
      ...(redSocialUrl.trim() && { redSocialUrl: redSocialUrl.trim() }),
      publicadoEn: new Date(),
    });
    // Enviar correo al locatario
    if (sol?.locatarioEmail) {
      fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: sol.locatarioEmail,
          locatarioNombre: sol.locatarioNombre,
          local: sol.local,
          productos: sol.productos,
          disenoUrl,
          fechaInicio: sol.fechaInicio,
          fechaFin: sol.fechaFin,
        }),
      });
    }
    if (disenoUrl) setUrlPublicada(disenoUrl);
    else cerrarModal();
    setSubiendo(false);
  };

  const pendientes = solicitudes.filter((s) => s.estado === "pendiente");
  const enDiseno = solicitudes.filter((s) => s.estado === "en_diseno");
  const solicitudModal = solicitudes.find((s) => s.id === modalId);

  return (
    <div className="p-4 md:p-8">
      {lightbox && (
        <Lightbox
          url={lightbox.url}
          onClose={() => setLightbox(null)}
          onDescargar={() => { descargar(lightbox.url, lightbox.nombre); setLightbox(null); }}
        />
      )}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Cola de trabajo</h1>
        <div className="flex gap-2">
          <span className="bg-yellow-50 text-yellow-700 text-xs font-medium px-3 py-1 rounded-full">
            {pendientes.length} pendientes
          </span>
          <span className="bg-blue-50 text-blue-700 text-xs font-medium px-3 py-1 rounded-full">
            {enDiseno.length} en diseño
          </span>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : solicitudes.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-4xl mb-3">✅</p>
          <p className="font-medium">Todo al día — no hay solicitudes pendientes</p>
        </div>
      ) : (
        <div className="space-y-3 max-w-3xl w-full">
          {solicitudes.map((s) => {
            const abierto = expandido === s.id;
            return (
              <div key={s.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                {/* Cabecera */}
                <div
                  className="flex items-center gap-4 p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => expandir(s)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900">{s.locatarioNombre}</span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        s.estado === "pendiente" ? "bg-yellow-50 text-yellow-700" : "bg-blue-50 text-blue-700"
                      }`}>
                        {s.estado === "pendiente" ? "Pendiente" : "En diseño"}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Local {s.local} · Sem. {s.semana}
                      {s.celular && ` · ${s.celular}`}
                      {s.fechaInicio && s.fechaFin && ` · ${s.fechaInicio} → ${s.fechaFin}`}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{s.productos.map((p) => p.nombre).join(", ")}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {s.estado === "pendiente" && (
                      <button
                        onClick={(e) => { e.stopPropagation(); tomar(s.id); }}
                        className="bg-blue-600 text-white text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Tomar
                      </button>
                    )}
                    {s.estado === "en_diseno" && (
                      <button
                        onClick={(e) => { e.stopPropagation(); abrirModal(s.id); }}
                        className="bg-green-600 text-white text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-green-700 transition-colors"
                      >
                        Subir diseño ↑
                      </button>
                    )}
                    <span className="text-gray-300">{abierto ? "▲" : "▼"}</span>
                  </div>
                </div>

                {/* Detalle expandido */}
                {abierto && (
                  <div className="border-t border-gray-100 p-4 bg-gray-50 space-y-4">
                    <div className="flex gap-4 flex-wrap">
                      {s.logoUrl && (
                        <div>
                          <p className="text-xs text-gray-400 mb-1">Logo</p>
                          <div className="relative group w-16 h-16 cursor-pointer" onClick={() => setLightbox({ url: s.logoUrl!, nombre: `logo-local${s.local}` })}>
                            <img src={s.logoUrl} alt="Logo" className="w-16 h-16 object-contain rounded-lg border border-gray-200 bg-white p-1" />
                            <div className="absolute inset-0 bg-black/40 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <span className="text-white text-xs font-bold">🔍</span>
                            </div>
                          </div>
                        </div>
                      )}
                      {s.productos.some((p) => p.fotoUrl) && (
                        <div>
                          <p className="text-xs text-gray-400 mb-1">Fotos <span className="text-gray-300">(hover = descargar)</span></p>
                          <div className="flex gap-2 flex-wrap">
                            {s.productos.filter((p) => p.fotoUrl).map((p, i) => (
                              <div key={i} className="text-center">
                                <div className="relative group w-16 h-16 cursor-pointer" onClick={() => setLightbox({ url: p.fotoUrl!, nombre: `${p.nombre}-foto${i + 1}` })}>
                                  <img src={p.fotoUrl} alt={p.nombre} className="w-16 h-16 object-cover rounded-lg border border-gray-200" />
                                  <div className="absolute inset-0 bg-black/40 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <span className="text-white text-xs font-bold">🔍</span>
                                  </div>
                                </div>
                                <p className="text-xs text-gray-400 mt-0.5 w-16 truncate">{p.nombre}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-2">Productos y precios</p>
                      <div className="space-y-1.5">
                        {s.productos.map((p, i) => (
                          <div key={i} className="bg-white rounded-lg border border-gray-200 px-3 py-2 flex justify-between">
                            <div>
                              <span className="text-sm font-medium text-gray-800">{p.nombre}</span>
                              {p.descripcion && <p className="text-xs text-gray-400">{p.descripcion}</p>}
                            </div>
                            <span className="text-sm font-semibold text-gray-700">S/ {p.precio}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    {s.fechaInicio && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-1">Vigencia de la promo</p>
                        <p className="text-sm text-gray-700">{s.fechaInicio} → {s.fechaFin}</p>
                      </div>
                    )}
                    {s.nota && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-1">Nota del locatario</p>
                        <p className="text-sm text-gray-700 bg-white rounded-lg border border-gray-200 px-3 py-2">{s.nota}</p>
                      </div>
                    )}

                    {s.estado === "en_diseno" && (
                      <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 flex items-center gap-3">
                        <div className="flex-1">
                          <p className="text-xs font-semibold text-blue-700 mb-1">📅 Fecha de publicación estimada</p>
                          <p className="text-xs text-blue-500">El locatario podrá verla en sus solicitudes</p>
                        </div>
                        <input
                          type="date"
                          defaultValue={s.fechaEstimada ?? ""}
                          onBlur={(e) => { if (e.target.value) guardarFechaEstimada(s.id, e.target.value); }}
                          className="border border-blue-200 bg-white rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />
                      </div>
                    )}

                    {/* Historial de promos anteriores del mismo locatario */}
                    {(historial[s.uid] ?? []).length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-2">Promos anteriores de este locatario</p>
                        <div className="flex gap-2 flex-wrap">
                          {(historial[s.uid] ?? []).map((h, i) => (
                            <div key={i} className="bg-white border border-gray-200 rounded-lg p-2 flex gap-2 items-center">
                              {h.disenoUrl && (
                                <div className="relative group cursor-pointer" onClick={() => setLightbox({ url: h.disenoUrl!, nombre: `semana${h.semana}-diseno` })}>
                                  <img src={h.disenoUrl} alt="" className="w-12 h-12 object-cover rounded-md" />
                                  <div className="absolute inset-0 bg-black/40 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <span className="text-white text-xs">🔍</span>
                                  </div>
                                </div>
                              )}
                              <div>
                                <p className="text-xs font-medium text-gray-600">Sem. {h.semana}</p>
                                <p className="text-xs text-gray-400">{h.productos.join(", ")}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de publicación */}
      {modalId && (solicitudModal || urlPublicada) && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-md">
            {!urlPublicada && solicitudModal && (
              <div className="p-6 border-b border-gray-100">
                <h2 className="text-lg font-semibold text-gray-900">Subir diseño final</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {solicitudModal.locatarioNombre} · Local {solicitudModal.local}
                </p>
              </div>
            )}
            <div className="p-6">
              {urlPublicada && (
                <div className="text-center space-y-4">
                  <div className="text-4xl">✅</div>
                  <p className="font-semibold text-gray-900">¡Publicado exitosamente!</p>
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                    <p className="text-xs text-gray-500 mb-2">URL del diseño — comparte con el locatario</p>
                    <p className="text-xs text-blue-600 break-all mb-3 font-mono">{urlPublicada}</p>
                    <button
                      onClick={() => { navigator.clipboard.writeText(urlPublicada); setCopiado(true); }}
                      className={`w-full py-2 rounded-lg text-sm font-medium transition-colors ${copiado ? "bg-green-100 text-green-700" : "bg-[#0d1f3c] text-white hover:bg-[#1a3358]"}`}
                    >
                      {copiado ? "✓ URL copiada" : "🔗 Copiar URL"}
                    </button>
                  </div>
                  <button onClick={cerrarModal} className="w-full text-sm text-gray-500 hover:text-gray-700 py-2">
                    Cerrar
                  </button>
                </div>
              )}
              {!urlPublicada && (
                <>
                  <input ref={fileRef} type="file" accept="image/*" onChange={handleDiseno} className="hidden" />

                  {/* Imagen del diseño — obligatoria */}
                  {disenoPreview ? (
                    <div className="relative mb-4">
                      <img src={disenoPreview} alt="Diseño" className="w-full max-h-64 object-contain rounded-xl border border-gray-200" />
                      <button
                        onClick={() => { setDisenoPreview(null); setDisenoFile(null); }}
                        className="absolute top-2 right-2 w-7 h-7 bg-red-500 text-white rounded-full text-sm flex items-center justify-center"
                      >×</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => fileRef.current?.click()}
                      className="w-full border-2 border-dashed border-red-200 bg-red-50 rounded-xl py-10 text-center hover:border-red-400 transition-colors mb-4"
                    >
                      <p className="text-3xl mb-2">🎨</p>
                      <p className="text-sm font-medium text-gray-700">Seleccionar imagen del diseño</p>
                      <p className="text-xs text-red-400 mt-1 font-medium">Obligatorio para publicar</p>
                    </button>
                  )}

                  {/* URL de red social — opcional */}
                  <div className="mb-4">
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">
                      Link de Instagram / TikTok <span className="text-gray-300 font-normal">(opcional)</span>
                    </label>
                    <input
                      type="url"
                      placeholder="https://www.instagram.com/p/..."
                      value={redSocialUrl}
                      onChange={(e) => setRedSocialUrl(e.target.value)}
                      className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-400 mt-1">El locatario verá este link para ver su diseño publicado</p>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={confirmarPublicar}
                      disabled={subiendo || !disenoPreview}
                      className="flex-1 bg-green-600 text-white font-medium py-2.5 rounded-xl hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      {subiendo ? "Publicando..." : "Confirmar publicación ✓"}
                    </button>
                    <button
                      onClick={cerrarModal}
                      className="px-4 border border-gray-300 text-gray-600 rounded-xl hover:bg-gray-50 transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
