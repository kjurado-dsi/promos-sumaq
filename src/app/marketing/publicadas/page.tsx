"use client";

import { useEffect, useState } from "react";
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Lightbox from "@/components/Lightbox";

interface Solicitud {
  id: string;
  locatarioNombre: string;
  local: string;
  celular?: string;
  productos: { nombre: string; precio: number }[];
  semana: number;
  fechaInicio?: string;
  fechaFin?: string;
  disenoUrl?: string;
  redSocialUrl?: string;
  creadoEn: { seconds: number };
}

const semanaActual = (() => {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  return Math.ceil(((now.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7);
})();

const descargarImagen = async (url: string, nombre: string) => {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `diseno-${nombre}.jpg`;
    a.click();
    URL.revokeObjectURL(a.href);
  } catch {
    window.open(url, "_blank");
  }
};

const WaIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" xmlns="http://www.w3.org/2000/svg">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

const buildMensaje = (s: Solicitud) => {
  const productos = s.productos
    .map((p) => `• ${p.nombre}${p.precio > 0 ? ` — S/${p.precio}` : ""}`)
    .join("\n");
  const fechas = s.fechaInicio ? `📅 ${s.fechaInicio} → ${s.fechaFin}` : "";
  return [
    `📍 *Local ${s.local} — ${s.locatarioNombre}*`,
    productos,
    fechas,
    s.redSocialUrl ?? "",
  ].filter(Boolean).join("\n");
};

const esMobile = () => typeof navigator !== "undefined" && navigator.maxTouchPoints > 0;

const compartirConImagen = async (s: Solicitud) => {
  const texto = buildMensaje(s);
  // Móvil: Web Share API con imagen como archivo (llega como imagen real en WhatsApp)
  if (s.disenoUrl && typeof navigator !== "undefined" && "share" in navigator) {
    try {
      const res = await fetch(s.disenoUrl);
      const blob = await res.blob();
      const file = new File([blob], `promo-sem${s.semana}-local${s.local}.jpg`, { type: blob.type || "image/jpeg" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: texto });
        return;
      }
    } catch { /* fallback */ }
  }
  // Desktop: texto solo (sin URL de imagen)
  window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank");
};

// Modal de cola de envío semanal
function ModalCola({ solicitudes, onClose }: { solicitudes: Solicitud[]; onClose: () => void }) {
  const [enviados, setEnviados] = useState<Set<string>>(new Set());

  const marcarEnviado = (id: string) => {
    setEnviados((prev) => new Set([...prev, id]));
  };

  const pendientes = solicitudes.filter((s) => !enviados.has(s.id));
  const listos = solicitudes.filter((s) => enviados.has(s.id));

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[85vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <h2 className="font-semibold text-gray-900">Compartir semana {semanaActual}</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Envía cada promo al grupo de WhatsApp una por una
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        {/* Lista */}
        <div className="overflow-y-auto flex-1 p-4 space-y-3">
          {pendientes.length === 0 && (
            <div className="text-center py-8">
              <p className="text-3xl mb-2">✅</p>
              <p className="text-sm font-medium text-gray-700">¡Todas enviadas!</p>
              <p className="text-xs text-gray-400 mt-1">Ya compartiste las {solicitudes.length} promos de esta semana.</p>
            </div>
          )}

          {pendientes.map((s) => (
            <div key={s.id} className="flex items-start gap-3 bg-gray-50 rounded-xl p-3">
              {s.disenoUrl && (
                <img src={s.disenoUrl} alt="" className="w-14 h-14 object-cover rounded-lg flex-shrink-0 border border-gray-200" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 leading-tight">
                  Local {s.local} — {s.locatarioNombre}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {s.productos.map((p) => p.nombre).join(", ")}
                </p>
                {s.fechaInicio && (
                  <p className="text-xs text-gray-400">{s.fechaInicio} → {s.fechaFin}</p>
                )}
              </div>
              <button
                onClick={() => { compartirConImagen(s); marcarEnviado(s.id); }}
                className="flex items-center gap-1.5 bg-[#25D366] text-white text-xs font-medium px-3 py-2 rounded-lg hover:bg-[#1ebe5d] transition-colors flex-shrink-0"
              >
                <WaIcon /> Enviar
              </button>
            </div>
          ))}

          {listos.length > 0 && pendientes.length > 0 && (
            <p className="text-xs text-gray-400 text-center pt-1">— Ya enviados —</p>
          )}

          {listos.map((s) => (
            <div key={s.id} className="flex items-center gap-3 rounded-xl p-3 opacity-40">
              {s.disenoUrl && (
                <img src={s.disenoUrl} alt="" className="w-14 h-14 object-cover rounded-lg flex-shrink-0 border border-gray-200" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 line-through">
                  Local {s.local} — {s.locatarioNombre}
                </p>
              </div>
              <span className="text-green-600 text-sm">✓ Enviado</span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 flex items-center justify-between">
          <p className="text-xs text-gray-400">
            {enviados.size}/{solicitudes.length} enviadas
          </p>
          <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PublicadasPage() {
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandidas, setExpandidas] = useState<Set<string>>(new Set());
  const [modalAbierto, setModalAbierto] = useState(false);
  const [lightbox, setLightbox] = useState<{ url: string; nombre: string } | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, "solicitudes"),
      where("estado", "==", "publicado"),
      orderBy("creadoEn", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setSolicitudes(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Solicitud)));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const toggleExpandida = (id: string) => {
    setExpandidas((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const promosSemana = solicitudes.filter((s) => s.semana === semanaActual);

  return (
    <div className="p-4 md:p-8">
      {lightbox && (
        <Lightbox
          url={lightbox.url}
          onClose={() => setLightbox(null)}
          onDescargar={() => { descargarImagen(lightbox.url, lightbox.nombre); setLightbox(null); }}
        />
      )}
      {modalAbierto && (
        <ModalCola solicitudes={promosSemana} onClose={() => setModalAbierto(false)} />
      )}

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Publicadas</h1>
        <div className="flex items-center gap-3">
          <span className="bg-green-50 text-green-700 text-xs font-medium px-3 py-1 rounded-full">
            {solicitudes.length} publicadas
          </span>
          {promosSemana.length > 0 && (
            <button
              onClick={() => setModalAbierto(true)}
              className="flex items-center gap-2 bg-[#25D366] text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#1ebe5d] transition-colors shadow-sm"
            >
              <WaIcon /> Compartir semana ({promosSemana.length})
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : solicitudes.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-4xl mb-3">📭</p>
          <p className="font-medium">Aún no hay solicitudes publicadas</p>
        </div>
      ) : (
        <div className="space-y-4 max-w-3xl">
          {solicitudes.map((s) => {
            const expandida = expandidas.has(s.id);
            return (
              <div key={s.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-semibold text-gray-900">{s.locatarioNombre}</span>
                        <span className="text-xs bg-green-50 text-green-700 font-medium px-2 py-0.5 rounded-full">
                          Publicado ✓
                        </span>
                      </div>
                      <p className="text-xs text-gray-400">
                        Local {s.local} · Sem. {s.semana}
                        {s.celular && ` · ${s.celular}`}
                        {s.fechaInicio && ` · ${s.fechaInicio} → ${s.fechaFin}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {s.disenoUrl && (
                        <button
                          onClick={() => navigator.clipboard.writeText(s.disenoUrl!)}
                          title="Copiar URL del diseño"
                          className="text-gray-400 border border-gray-200 text-xs font-medium px-2.5 py-1.5 rounded-lg hover:bg-gray-50 hover:text-gray-600 transition-colors"
                        >
                          🔗
                        </button>
                      )}
                      <button
                        onClick={() => compartirConImagen(s)}
                        title="Compartir en WhatsApp"
                        className="flex items-center gap-1.5 text-[#25D366] border border-[#25D366] text-xs font-medium px-2.5 py-1.5 rounded-lg hover:bg-[#25D366] hover:text-white transition-colors"
                      >
                        <WaIcon />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {s.productos.map((p, i) => (
                      <span key={i} className="bg-gray-50 border border-gray-200 text-gray-600 text-xs px-2.5 py-1 rounded-md">
                        {p.nombre}{p.precio > 0 ? ` — S/${p.precio}` : ""}
                      </span>
                    ))}
                  </div>

                  {s.disenoUrl ? (
                    <button
                      onClick={() => toggleExpandida(s.id)}
                      className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                    >
                      {expandida ? "▲ Ocultar diseño" : "▼ Ver diseño"}
                    </button>
                  ) : (
                    <p className="text-xs text-gray-400 italic">Sin imagen de diseño adjunta</p>
                  )}
                </div>

                {s.disenoUrl && expandida && (
                  <div
                    className="relative border-t border-gray-100 cursor-pointer group"
                    onClick={() => setLightbox({ url: s.disenoUrl!, nombre: s.locatarioNombre })}
                  >
                    <img
                      src={s.disenoUrl}
                      alt="Diseño"
                      className="w-full max-h-80 object-contain bg-gray-50"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                      <span className="opacity-0 group-hover:opacity-100 bg-white/90 text-gray-700 text-xs font-medium px-3 py-1.5 rounded-lg shadow transition-opacity">
                        🔍 Ver completo
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
