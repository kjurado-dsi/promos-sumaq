"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, query, orderBy, doc, updateDoc, getDoc, arrayUnion, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface HistorialItem {
  accion: string;
  por: string;
  en: { seconds: number };
}

interface Reporte {
  id: string;
  uid: string;
  locatarioNombre: string;
  local: string;
  tipo: string;
  descripcion: string;
  area: string;
  urgente: boolean;
  estado: string;
  fotoUrl?: string;
  comentarioAdmin?: string;
  historial?: HistorialItem[];
  creadoEn: { seconds: number };
}

const TIPO_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  incidente:    { label: "🚨 Incidente",    bg: "bg-red-50",    text: "text-red-700" },
  mantenimiento:{ label: "🔧 Mantenimiento",bg: "bg-orange-50", text: "text-orange-700" },
  solicitud:    { label: "📋 Solicitud",    bg: "bg-blue-50",   text: "text-blue-700" },
  sugerencia:   { label: "💡 Sugerencia",   bg: "bg-yellow-50", text: "text-yellow-700" },
};

const ESTADO_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  recibido:   { label: "Recibido",    bg: "bg-gray-100",   text: "text-gray-600" },
  en_proceso: { label: "En proceso",  bg: "bg-amber-50",   text: "text-amber-700" },
  resuelto:   { label: "Resuelto ✓", bg: "bg-green-50",   text: "text-green-700" },
};

const FILTROS_TIPO = ["todos", "incidente", "mantenimiento", "solicitud", "sugerencia"];
const FILTROS_ESTADO = ["todos", "recibido", "en_proceso", "resuelto"];

export default function ReportesAdminPage() {
  const [reportes, setReportes] = useState<Reporte[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [detalle, setDetalle] = useState<Reporte | null>(null);
  const [comentario, setComentario] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "reportes"), orderBy("creadoEn", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setReportes(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Reporte)));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const filtrados = reportes.filter((r) => {
    if (filtroTipo !== "todos" && r.tipo !== filtroTipo) return false;
    if (filtroEstado !== "todos" && r.estado !== filtroEstado) return false;
    return true;
  });

  const stats = {
    total: reportes.length,
    recibido: reportes.filter((r) => r.estado === "recibido").length,
    en_proceso: reportes.filter((r) => r.estado === "en_proceso").length,
    resuelto: reportes.filter((r) => r.estado === "resuelto").length,
  };

  const ESTADO_LABEL: Record<string, string> = {
    en_proceso: "En proceso",
    resuelto: "Resuelto ✓",
    recibido: "Recibido",
  };

  const cambiarEstado = async (id: string, estado: string) => {
    const entrada: HistorialItem = { accion: `Estado → ${ESTADO_LABEL[estado] ?? estado}`, por: "Operaciones", en: Timestamp.now() as unknown as { seconds: number } };
    await updateDoc(doc(db, "reportes", id), { estado, historial: arrayUnion(entrada) });
    setDetalle((d) => d && d.id === id ? { ...d, estado, historial: [...(d.historial ?? []), entrada] } : d);

    // Enviar push notification al locatario
    if (!detalle) return;
    try {
      const userSnap = await getDoc(doc(db, "users", detalle.uid));
      const fcmToken = userSnap.data()?.fcmToken;
      if (fcmToken) {
        await fetch("/api/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: fcmToken,
            title: "Actualización de tu reporte",
            body: `Tu reporte "${detalle.descripcion.slice(0, 50)}..." cambió a: ${ESTADO_LABEL[estado] ?? estado}`,
            data: { reporteId: id },
          }),
        });
      }
    } catch { /* notificación opcional, no bloquea */ }
  };

  const guardarComentario = async () => {
    if (!detalle) return;
    setGuardando(true);
    const entrada: HistorialItem = { accion: "Respuesta enviada al locatario", por: "Operaciones", en: Timestamp.now() as unknown as { seconds: number } };
    await updateDoc(doc(db, "reportes", detalle.id), { comentarioAdmin: comentario, historial: arrayUnion(entrada) });
    setDetalle({ ...detalle, comentarioAdmin: comentario, historial: [...(detalle.historial ?? []), entrada] });

    // Notificar al locatario que hay una respuesta nueva
    try {
      const userSnap = await getDoc(doc(db, "users", detalle.uid));
      const fcmToken = userSnap.data()?.fcmToken;
      if (fcmToken) {
        await fetch("/api/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: fcmToken,
            title: "Nueva respuesta a tu reporte",
            body: `Operaciones respondió: "${comentario.slice(0, 60)}..."`,
            data: { reporteId: detalle.id },
          }),
        });
      }
    } catch { /* notificación opcional */ }

    setGuardando(false);
  };

  const abrirDetalle = (r: Reporte) => {
    setDetalle(r);
    setComentario(r.comentarioAdmin ?? "");
  };

  const formatFecha = (seconds: number) =>
    new Date(seconds * 1000).toLocaleDateString("es-PE", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-2xl font-semibold text-gray-900 mb-1">Reportes</h1>
      <p className="text-sm text-gray-500 mb-6">Gestión de comunicaciones de locatarios</p>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Total", value: stats.total, color: "text-gray-900" },
          { label: "Sin atender", value: stats.recibido, color: "text-red-600" },
          { label: "En proceso", value: stats.en_proceso, color: "text-amber-600" },
          { label: "Resueltos", value: stats.resuelto, color: "text-green-600" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white border border-gray-200 rounded-xl p-4">
            <p className={`text-3xl font-bold ${color} font-variant-numeric tabular-nums`}>{value}</p>
            <p className="text-xs text-gray-400 uppercase tracking-wide mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Filtros tipo */}
      <div className="flex flex-wrap gap-2 mb-3">
        {FILTROS_TIPO.map((f) => {
          const cfg = f === "todos" ? null : TIPO_CONFIG[f];
          return (
            <button
              key={f}
              onClick={() => setFiltroTipo(f)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
                filtroTipo === f
                  ? "bg-[#0d1f3c] text-white border-[#0d1f3c]"
                  : "border-gray-200 text-gray-500 bg-white hover:bg-gray-50"
              }`}
            >
              {f === "todos" ? "Todos los tipos" : cfg?.label}
            </button>
          );
        })}
      </div>

      {/* Filtros estado */}
      <div className="flex flex-wrap gap-2 mb-5">
        {FILTROS_ESTADO.map((f) => {
          const cfg = f === "todos" ? null : ESTADO_CONFIG[f];
          return (
            <button
              key={f}
              onClick={() => setFiltroEstado(f)}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                filtroEstado === f
                  ? "bg-gray-800 text-white border-gray-800"
                  : "border-gray-200 text-gray-500 bg-white hover:bg-gray-50"
              }`}
            >
              {f === "todos" ? "Todos los estados" : cfg?.label}
            </button>
          );
        })}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0d1f3c]" />
        </div>
      ) : filtrados.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-gray-200">
          <p className="text-gray-400 text-sm">Sin reportes para los filtros seleccionados</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          {filtrados.map((r, i) => {
            const tipo = TIPO_CONFIG[r.tipo] ?? { label: r.tipo, bg: "bg-gray-50", text: "text-gray-600" };
            const estado = ESTADO_CONFIG[r.estado] ?? { label: r.estado, bg: "bg-gray-50", text: "text-gray-600" };
            const fecha = formatFecha(r.creadoEn.seconds);
            return (
              <div
                key={r.id}
                onClick={() => abrirDetalle(r)}
                className={`flex items-center gap-3 px-4 py-3.5 cursor-pointer hover:bg-gray-50 transition-colors ${i > 0 ? "border-t border-gray-100" : ""}`}
              >
                {r.urgente && <div className="w-1.5 h-10 bg-red-500 rounded-full flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className="text-sm font-semibold text-gray-900 truncate">{r.locatarioNombre}</span>
                    <span className="text-xs text-gray-400">L.{r.local}</span>
                    {r.urgente && <span className="text-xs font-bold text-red-500">URGENTE</span>}
                  </div>
                  <p className="text-xs text-gray-500 truncate">{r.descripcion}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${tipo.bg} ${tipo.text}`}>{tipo.label}</span>
                    <span className="text-xs text-gray-300">·</span>
                    <span className="text-xs text-gray-400">{r.area}</span>
                    <span className="text-xs text-gray-300">·</span>
                    <span className="text-xs text-gray-400">{fecha}</span>
                    {r.estado !== "resuelto" && (() => {
                      const dias = Math.floor((Date.now() / 1000 - r.creadoEn.seconds) / 86400);
                      if (dias < 1) return null;
                      return (
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${dias >= 3 ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-600"}`}>
                          {dias}d sin resolver
                        </span>
                      );
                    })()}
                  </div>
                </div>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${estado.bg} ${estado.text}`}>
                  {estado.label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal detalle */}
      {detalle && (
        <div
          className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 sm:p-4"
          onClick={() => setDetalle(null)}
        >
          <div
            className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header modal */}
            <div className="p-5 border-b border-gray-100">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-gray-400 mb-1">
                    {formatFecha(detalle.creadoEn.seconds)}
                  </p>
                  <p className="font-semibold text-gray-900">{detalle.locatarioNombre}</p>
                  <p className="text-sm text-gray-500">Local {detalle.local} · {detalle.area}</p>
                </div>
                <button onClick={() => setDetalle(null)} className="text-gray-400 hover:text-gray-600 text-xl p-1">✕</button>
              </div>
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <span className={`text-xs font-semibold px-2 py-1 rounded-lg ${TIPO_CONFIG[detalle.tipo]?.bg} ${TIPO_CONFIG[detalle.tipo]?.text}`}>
                  {TIPO_CONFIG[detalle.tipo]?.label}
                </span>
                {detalle.urgente && (
                  <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-lg">URGENTE</span>
                )}
              </div>
            </div>

            <div className="p-5 space-y-4">
              {/* Descripción */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Descripción</p>
                <p className="text-sm text-gray-800">{detalle.descripcion}</p>
              </div>

              {/* Foto */}
              {detalle.fotoUrl && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Foto</p>
                  <img src={detalle.fotoUrl} alt="Foto reporte" className="w-full rounded-xl border border-gray-200 max-h-64 object-cover" />
                </div>
              )}

              {/* Cambiar estado */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Estado</p>
                <div className="flex gap-2">
                  {(["recibido", "en_proceso", "resuelto"] as const).map((e) => {
                    const cfg = ESTADO_CONFIG[e];
                    const activo = detalle.estado === e;
                    return (
                      <button
                        key={e}
                        onClick={() => cambiarEstado(detalle.id, e)}
                        className={`flex-1 text-xs font-semibold py-2.5 rounded-xl border-2 transition-all ${
                          activo
                            ? `${cfg.bg} ${cfg.text} border-current`
                            : "border-gray-200 text-gray-400 hover:border-gray-300"
                        }`}
                      >
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Comentario interno */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                  Respuesta / comentario interno
                </p>
                <textarea
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value)}
                  rows={3}
                  placeholder="Escribe una respuesta para el locatario o una nota interna..."
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#0d1f3c] resize-none"
                />
                <button
                  onClick={guardarComentario}
                  disabled={guardando || comentario === (detalle.comentarioAdmin ?? "")}
                  className="mt-2 w-full bg-[#0d1f3c] text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-[#1a3358] disabled:opacity-40 transition-colors"
                >
                  {guardando ? "Guardando..." : "Guardar respuesta"}
                </button>
              </div>

              {/* Historial de trazabilidad */}
              {detalle.historial && detalle.historial.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Historial</p>
                  <div className="space-y-1.5">
                    {[...detalle.historial].reverse().map((h, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-gray-500">
                        <span className="mt-0.5 text-gray-300">•</span>
                        <span className="flex-1">{h.accion}</span>
                        <span className="text-gray-300 flex-shrink-0">
                          {new Date(h.en.seconds * 1000).toLocaleDateString("es-PE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    ))}
                    <div className="flex items-start gap-2 text-xs text-gray-400">
                      <span className="mt-0.5 text-gray-200">•</span>
                      <span className="flex-1">Reporte creado</span>
                      <span className="text-gray-300 flex-shrink-0">
                        {new Date(detalle.creadoEn.seconds * 1000).toLocaleDateString("es-PE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
