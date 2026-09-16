"use client";

import { useEffect, useState } from "react";
import {
  collection, onSnapshot, query, orderBy,
  doc, updateDoc, getDoc, arrayUnion, Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

interface HistorialItem {
  accion: string;
  por: string;
  en: { seconds: number };
}

interface ComentarioLocatario {
  texto: string;
  por: "locatario" | "admin";
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
  comentarios?: ComentarioLocatario[];
  historial?: HistorialItem[];
  creadoEn: { seconds: number };
}

const TIPO_CONFIG: Record<string, { label: string; icon: string; bg: string; text: string }> = {
  incidente:     { label: "Incidente",     icon: "🚨", bg: "bg-red-50",    text: "text-red-700" },
  mantenimiento: { label: "Mantenimiento", icon: "🔧", bg: "bg-orange-50", text: "text-orange-700" },
  solicitud:     { label: "Solicitud",     icon: "📋", bg: "bg-blue-50",   text: "text-blue-700" },
  sugerencia:    { label: "Sugerencia",    icon: "💡", bg: "bg-yellow-50", text: "text-yellow-700" },
};

const ESTADO_CONFIG: Record<string, { label: string; dot: string; bg: string; text: string; next?: string }> = {
  recibido:   { label: "Recibido",    dot: "bg-gray-400",  bg: "bg-gray-100",  text: "text-gray-700",  next: "en_proceso" },
  en_proceso: { label: "En proceso",  dot: "bg-amber-400", bg: "bg-amber-50",  text: "text-amber-700", next: "resuelto" },
  resuelto:   { label: "Resuelto",    dot: "bg-green-500", bg: "bg-green-50",  text: "text-green-700" },
};

const DIAS_LABEL = (dias: number, estado: string) => {
  if (estado === "resuelto" || dias < 1) return null;
  if (dias >= 5) return { text: `${dias}d`, cls: "bg-red-100 text-red-700 font-bold" };
  if (dias >= 2) return { text: `${dias}d`, cls: "bg-amber-100 text-amber-700 font-semibold" };
  return { text: `${dias}d`, cls: "bg-gray-100 text-gray-500" };
};

const ESTADO_LABEL: Record<string, string> = {
  en_proceso: "En proceso", resuelto: "Resuelto", recibido: "Recibido",
};

export default function ReportesAdminPage() {
  const [reportes, setReportes] = useState<Reporte[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState<"todos" | "recibido" | "en_proceso" | "resuelto">("todos");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [busqueda, setBusqueda] = useState("");
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

  // Stats se calculan sobre el subset filtrado por tipo (no por estado, ya que el estado es lo que muestran)
  const porTipo = filtroTipo === "todos" ? reportes : reportes.filter((r) => r.tipo === filtroTipo);

  const stats = {
    todos:      porTipo.length,
    recibido:   porTipo.filter((r) => r.estado === "recibido").length,
    en_proceso: porTipo.filter((r) => r.estado === "en_proceso").length,
    resuelto:   porTipo.filter((r) => r.estado === "resuelto").length,
  };

  const urgentes = porTipo.filter((r) => r.urgente && r.estado !== "resuelto").length;

  const filtrados = reportes
    .filter((r) => {
      if (filtroEstado !== "todos" && r.estado !== filtroEstado) return false;
      if (filtroTipo !== "todos" && r.tipo !== filtroTipo) return false;
      if (busqueda) {
        const q = busqueda.toLowerCase();
        if (
          !r.locatarioNombre?.toLowerCase().includes(q) &&
          !r.local?.toLowerCase().includes(q) &&
          !r.descripcion?.toLowerCase().includes(q)
        ) return false;
      }
      return true;
    })
    .sort((a, b) => {
      // urgentes sin resolver primero, luego por días sin resolver desc
      const aUrg = a.urgente && a.estado !== "resuelto" ? 1 : 0;
      const bUrg = b.urgente && b.estado !== "resuelto" ? 1 : 0;
      if (aUrg !== bUrg) return bUrg - aUrg;
      return b.creadoEn.seconds - a.creadoEn.seconds;
    });

  const cambiarEstado = async (r: Reporte, estado: string) => {
    const entrada: HistorialItem = {
      accion: `Estado → ${ESTADO_LABEL[estado] ?? estado}`,
      por: "Operaciones",
      en: Timestamp.now() as unknown as { seconds: number },
    };
    await updateDoc(doc(db, "reportes", r.id), { estado, historial: arrayUnion(entrada) });
    if (detalle?.id === r.id) {
      setDetalle((d) => d ? { ...d, estado, historial: [...(d.historial ?? []), entrada] } : d);
    }
    try {
      const userSnap = await getDoc(doc(db, "users", r.uid));
      const fcmToken = userSnap.data()?.fcmToken;
      if (fcmToken) {
        await fetch("/api/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: fcmToken,
            title: "Actualización de tu reporte",
            body: `Tu reporte cambió a: ${ESTADO_LABEL[estado] ?? estado}`,
            data: { reporteId: r.id },
          }),
        });
      }
    } catch { /* opcional */ }
  };

  const guardarComentario = async () => {
    if (!detalle) return;
    setGuardando(true);
    const entrada: HistorialItem = {
      accion: "Respuesta enviada al locatario",
      por: "Operaciones",
      en: Timestamp.now() as unknown as { seconds: number },
    };
    await updateDoc(doc(db, "reportes", detalle.id), {
      comentarioAdmin: comentario,
      historial: arrayUnion(entrada),
    });
    setDetalle({ ...detalle, comentarioAdmin: comentario, historial: [...(detalle.historial ?? []), entrada] });
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
    } catch { /* opcional */ }
    setGuardando(false);
  };

  const abrirDetalle = (r: Reporte) => { setDetalle(r); setComentario(r.comentarioAdmin ?? ""); };

  const formatFecha = (s: number) =>
    new Date(s * 1000).toLocaleDateString("es-PE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  const diasDesde = (s: number) => Math.floor((Date.now() / 1000 - s) / 86400);

  return (
    <div className="p-4 md:p-6 max-w-5xl">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">Reportes operacionales</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {stats.recibido > 0
              ? `${stats.recibido} sin atender${urgentes > 0 ? ` · ${urgentes} urgente${urgentes > 1 ? "s" : ""}` : ""}`
              : "Todo atendido"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {urgentes > 0 && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-xs font-bold px-3 py-2 rounded-xl flex-shrink-0">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              {urgentes} urgente{urgentes > 1 ? "s" : ""}
            </div>
          )}
          <input
            type="search"
            placeholder="Buscar locatario, local..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-52 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d1f3c] bg-white"
          />
        </div>
      </div>

      {/* Stats rápidas + filtro estado en una sola barra */}
      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-xl overflow-x-auto">
        {([
          { key: "todos",      label: "Todos",       count: stats.todos,      color: "text-gray-700" },
          { key: "recibido",   label: "Sin atender", count: stats.recibido,   color: "text-red-600" },
          { key: "en_proceso", label: "En proceso",  count: stats.en_proceso, color: "text-amber-600" },
          { key: "resuelto",   label: "Resueltos",   count: stats.resuelto,   color: "text-green-600" },
        ] as const).map(({ key, label, count, color }) => (
          <button
            key={key}
            onClick={() => setFiltroEstado(key)}
            className={`flex-1 flex flex-col items-center py-2.5 px-3 rounded-lg text-center transition-all min-w-[80px] ${
              filtroEstado === key
                ? "bg-white shadow-sm"
                : "hover:bg-gray-50"
            }`}
          >
            <span className={`text-xl font-bold tabular-nums leading-none ${filtroEstado === key ? color : "text-gray-400"}`}>
              {count}
            </span>
            <span className={`text-[10px] font-semibold mt-0.5 uppercase tracking-wide ${filtroEstado === key ? "text-gray-700" : "text-gray-400"}`}>
              {label}
            </span>
          </button>
        ))}
      </div>

      {/* Filtro tipo */}
      <div className="flex gap-1.5 mb-5 overflow-x-auto pb-1">
        {(["todos", "incidente", "mantenimiento", "solicitud", "sugerencia"] as const).map((f) => {
          const cfg = f === "todos" ? null : TIPO_CONFIG[f];
          return (
            <button
              key={f}
              onClick={() => setFiltroTipo(f)}
              className={`flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
                filtroTipo === f
                  ? "bg-[#0d1f3c] text-white border-[#0d1f3c]"
                  : "border-gray-200 text-gray-500 bg-white hover:bg-gray-50"
              }`}
            >
              {f === "todos" ? "Todos los tipos" : `${cfg?.icon} ${cfg?.label}`}
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
          <p className="text-3xl mb-2">📭</p>
          <p className="text-gray-400 text-sm">Sin reportes para los filtros seleccionados</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtrados.map((r) => {
            const tipo = TIPO_CONFIG[r.tipo];
            const estado = ESTADO_CONFIG[r.estado];
            const dias = diasDesde(r.creadoEn.seconds);
            const diasInfo = DIAS_LABEL(dias, r.estado);
            const isUrgente = r.urgente && r.estado !== "resuelto";

            return (
              <div
                key={r.id}
                onClick={() => abrirDetalle(r)}
                className={`bg-white border rounded-2xl cursor-pointer hover:shadow-md transition-all active:scale-[0.995] ${
                  isUrgente ? "border-red-200" : "border-gray-200"
                }`}
              >
                <div className="p-4">
                  {/* Fila 1: identidad + estado */}
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {/* Avatar local */}
                      <div className={`w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center text-sm font-bold ${
                        isUrgente ? "bg-red-100 text-red-700" : "bg-[#0d1f3c]/5 text-[#0d1f3c]"
                      }`}>
                        {r.local ? r.local.replace(/[^0-9]/g, "").slice(-3) || r.local.slice(0, 3) : "?"}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-gray-900 truncate">{r.locatarioNombre}</p>
                          {isUrgente && (
                            <span className="text-[10px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded-full flex-shrink-0">
                              URGENTE
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400">Local {r.local} · {r.area}</p>
                      </div>
                    </div>
                    {/* Chips de días + estado a la derecha */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {r.comentarios && r.comentarios.length > 0 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#0d1f3c]/10 text-[#0d1f3c]">
                          💬 {r.comentarios.length}
                        </span>
                      )}
                      {diasInfo && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${diasInfo.cls}`}>
                          {diasInfo.text}
                        </span>
                      )}
                      <span className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full ${estado?.bg} ${estado?.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${estado?.dot}`} />
                        {estado?.label}
                      </span>
                    </div>
                  </div>

                  {/* Descripción */}
                  <p className="text-sm text-gray-700 line-clamp-2 mb-2.5 pl-[3.25rem]">{r.descripcion}</p>

                  {/* Fila inferior: tipo + fecha + acciones rápidas */}
                  <div className="flex items-center justify-between pl-[3.25rem]">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${tipo?.bg} ${tipo?.text}`}>
                        {tipo?.icon} {tipo?.label}
                      </span>
                      <span className="text-[10px] text-gray-300">·</span>
                      <span className="text-[10px] text-gray-400">{formatFecha(r.creadoEn.seconds)}</span>
                    </div>
                    {/* Botones de avance rápido de estado */}
                    {estado?.next && (
                      <button
                        onClick={(e) => { e.stopPropagation(); cambiarEstado(r, estado.next!); }}
                        className="text-[10px] font-semibold px-2.5 py-1 rounded-lg border border-gray-200 text-gray-500 hover:bg-[#0d1f3c] hover:text-white hover:border-[#0d1f3c] transition-colors"
                      >
                        → {ESTADO_LABEL[estado.next]}
                      </button>
                    )}
                  </div>
                </div>
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
            className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-lg max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header modal */}
            <div className={`p-5 border-b ${detalle.urgente && detalle.estado !== "resuelto" ? "bg-red-50 border-red-100" : "border-gray-100"}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-bold text-gray-900">{detalle.locatarioNombre}</p>
                    {detalle.urgente && detalle.estado !== "resuelto" && (
                      <span className="text-[10px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded-full">URGENTE</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    Local {detalle.local} · {detalle.area} · {formatFecha(detalle.creadoEn.seconds)}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`text-xs font-semibold px-2 py-1 rounded-lg ${TIPO_CONFIG[detalle.tipo]?.bg} ${TIPO_CONFIG[detalle.tipo]?.text}`}>
                      {TIPO_CONFIG[detalle.tipo]?.icon} {TIPO_CONFIG[detalle.tipo]?.label}
                    </span>
                    {(() => {
                      const d = diasDesde(detalle.creadoEn.seconds);
                      const info = DIAS_LABEL(d, detalle.estado);
                      return info ? (
                        <span className={`text-xs px-2 py-1 rounded-lg ${info.cls}`}>{info.text} sin resolver</span>
                      ) : null;
                    })()}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {/* Compartir por WhatsApp */}
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(
                      `*Reporte Operativo — Sumaq Mercados*\n\n` +
                      `📍 *Local:* ${detalle.local} — ${detalle.locatarioNombre}\n` +
                      `🏷 *Tipo:* ${TIPO_CONFIG[detalle.tipo]?.icon ?? ""} ${TIPO_CONFIG[detalle.tipo]?.label ?? detalle.tipo}\n` +
                      `📌 *Área:* ${detalle.area}\n` +
                      (detalle.urgente ? `⚠️ *URGENTE*\n` : "") +
                      `\n*Descripción:*\n${detalle.descripcion}\n\n` +
                      `*Estado:* ${ESTADO_LABEL[detalle.estado] ?? detalle.estado}\n` +
                      `📅 ${formatFecha(detalle.creadoEn.seconds)}`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition-colors"
                    title="Compartir por WhatsApp"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    Compartir
                  </a>
                  <button onClick={() => setDetalle(null)} className="text-gray-400 hover:text-gray-600 text-xl p-1">✕</button>
                </div>
              </div>
            </div>

            <div className="p-5 space-y-5">
              {/* Descripción */}
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Descripción</p>
                <p className="text-sm text-gray-800 leading-relaxed">{detalle.descripcion}</p>
              </div>

              {/* Foto */}
              {detalle.fotoUrl && (
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Foto adjunta</p>
                  <img src={detalle.fotoUrl} alt="Foto" className="w-full rounded-xl border border-gray-200 max-h-64 object-cover" />
                </div>
              )}

              {/* Comentarios del locatario */}
              {detalle.comentarios && detalle.comentarios.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">
                    Actualizaciones del locatario ({detalle.comentarios.length})
                  </p>
                  <div className="space-y-2 bg-gray-50 rounded-xl p-3">
                    {[...detalle.comentarios]
                      .sort((a, b) => a.en.seconds - b.en.seconds)
                      .map((c, i) => (
                        <div key={i} className="flex gap-2.5 items-start">
                          <div className="w-6 h-6 rounded-full bg-[#0d1f3c]/10 flex items-center justify-center text-[10px] font-bold text-[#0d1f3c] flex-shrink-0 mt-0.5">
                            L
                          </div>
                          <div className="flex-1">
                            <p className="text-sm text-gray-800">{c.texto}</p>
                            <p className="text-[10px] text-gray-400 mt-0.5">
                              {new Date(c.en.seconds * 1000).toLocaleString("es-PE", {
                                day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                              })}
                            </p>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Cambiar estado */}
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Estado del reporte</p>
                <div className="grid grid-cols-3 gap-2">
                  {(["recibido", "en_proceso", "resuelto"] as const).map((e) => {
                    const cfg = ESTADO_CONFIG[e];
                    const activo = detalle.estado === e;
                    return (
                      <button
                        key={e}
                        onClick={() => cambiarEstado(detalle, e)}
                        className={`py-2.5 rounded-xl text-xs font-semibold border-2 transition-all flex flex-col items-center gap-1 ${
                          activo
                            ? `${cfg.bg} ${cfg.text} border-current`
                            : "border-gray-200 text-gray-400 hover:border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${activo ? cfg.dot : "bg-gray-200"}`} />
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Respuesta */}
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Respuesta al locatario</p>
                <textarea
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value)}
                  rows={3}
                  placeholder="Escribe una respuesta o nota interna..."
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

              {/* Historial */}
              {detalle.historial && detalle.historial.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Historial</p>
                  <div className="relative pl-4 border-l-2 border-gray-100 space-y-3">
                    {[...detalle.historial].reverse().map((h, i) => (
                      <div key={i} className="relative">
                        <div className="absolute -left-[1.3rem] top-1 w-2.5 h-2.5 rounded-full bg-white border-2 border-gray-300" />
                        <p className="text-xs font-semibold text-gray-700">{h.accion}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          {new Date(h.en.seconds * 1000).toLocaleDateString("es-PE", {
                            day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                          })}
                        </p>
                      </div>
                    ))}
                    <div className="relative">
                      <div className="absolute -left-[1.3rem] top-1 w-2.5 h-2.5 rounded-full bg-white border-2 border-gray-200" />
                      <p className="text-xs text-gray-400">Reporte creado</p>
                      <p className="text-[10px] text-gray-300 mt-0.5">
                        {new Date(detalle.creadoEn.seconds * 1000).toLocaleDateString("es-PE", {
                          day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                        })}
                      </p>
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
