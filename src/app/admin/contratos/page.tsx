"use client";

import { useEffect, useState, useMemo } from "react";

interface Contrato {
  puesto: string;
  rubro: string;
  locatario: string;
  tipoContrato: string;
  fechaInicio: string;
  duracionMeses: number;
  graciaMeses: number;
  inicioPago: string;
  finContrato: string;
}

interface Movimiento {
  fecha: string;
  idMovimiento: string;
  puesto: string;
  locatario: string;
  direccion: string;
  concepto: string;
  medio: string;
  monto: number;
  contraparte: string;
  observaciones: string;
}

type Estado = "vencido" | "hoy" | "proxima_semana" | "proximo_mes" | "al_dia" | "sin_fecha";

interface ContratoEnriquecido extends Contrato {
  diasDiferencia: number; // negativo = vencido
  estado: Estado;
  inicioPagoDate: Date | null;
}

function parseFechaPeruana(s: string): Date | null {
  if (!s) return null;
  const [d, m, y] = s.split("/").map(Number);
  if (!d || !m || !y) return null;
  return new Date(y, m - 1, d);
}

function diasDesdeFecha(fecha: Date): number {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return Math.round((fecha.getTime() - hoy.getTime()) / 86400000);
}

function clasificar(dias: number | null): Estado {
  if (dias === null) return "sin_fecha";
  if (dias < 0) return "vencido";
  if (dias === 0) return "hoy";
  if (dias <= 7) return "proxima_semana";
  if (dias <= 30) return "proximo_mes";
  return "al_dia";
}

const ESTADO_CONFIG: Record<Estado, { label: string; bg: string; text: string; dot: string }> = {
  vencido:        { label: "Vencido",       bg: "bg-red-100",    text: "text-red-700",    dot: "bg-red-500" },
  hoy:            { label: "Vence hoy",     bg: "bg-orange-100", text: "text-orange-700", dot: "bg-orange-500" },
  proxima_semana: { label: "Próx. 7 días",  bg: "bg-amber-100",  text: "text-amber-700",  dot: "bg-amber-400" },
  proximo_mes:    { label: "Próx. 30 días", bg: "bg-yellow-50",  text: "text-yellow-700", dot: "bg-yellow-400" },
  al_dia:         { label: "Al día",        bg: "bg-green-50",   text: "text-green-700",  dot: "bg-green-400" },
  sin_fecha:      { label: "Sin fecha",     bg: "bg-gray-100",   text: "text-gray-500",   dot: "bg-gray-300" },
};

function formatFechaCorta(s: string): string {
  const d = parseFechaPeruana(s);
  if (!d) return s || "—";
  return d.toLocaleDateString("es-PE", { day: "numeric", month: "short", year: "2-digit" });
}

function formatMonto(n: number): string {
  const abs = Math.abs(n);
  const str = abs.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (n < 0 ? "−" : "") + "S/ " + str;
}

export default function ContratosPage() {
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Estado | "todos">("todos");
  const [busqueda, setBusqueda] = useState("");
  const [actualizado, setActualizado] = useState<Date | null>(null);

  const cargar = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/contratos");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setContratos(data.contratos ?? []);
      setMovimientos(data.movimientos ?? []);
      setActualizado(new Date());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(); }, []);

  const enriquecidos = useMemo<ContratoEnriquecido[]>(() =>
    contratos.map((c) => {
      const d = parseFechaPeruana(c.inicioPago);
      const dias = d ? diasDesdeFecha(d) : null;
      return {
        ...c,
        inicioPagoDate: d,
        diasDiferencia: dias ?? 999,
        estado: clasificar(dias),
      };
    }).sort((a, b) => a.diasDiferencia - b.diasDiferencia),
  [contratos]);

  const filtrados = useMemo(() =>
    enriquecidos.filter((c) => {
      const matchEstado = filtro === "todos" || c.estado === filtro;
      const q = busqueda.toLowerCase();
      const matchBusqueda = !q || c.locatario.toLowerCase().includes(q) || c.puesto.toLowerCase().includes(q) || c.rubro.toLowerCase().includes(q);
      return matchEstado && matchBusqueda;
    }),
  [enriquecidos, filtro, busqueda]);

  const stats = useMemo(() => ({
    vencido: enriquecidos.filter((c) => c.estado === "vencido").length,
    hoy: enriquecidos.filter((c) => c.estado === "hoy").length,
    proxima_semana: enriquecidos.filter((c) => c.estado === "proxima_semana").length,
    proximo_mes: enriquecidos.filter((c) => c.estado === "proximo_mes").length,
    al_dia: enriquecidos.filter((c) => c.estado === "al_dia").length,
    total: enriquecidos.length,
  }), [enriquecidos]);

  const detalle = seleccionado ? enriquecidos.find((c) => c.puesto === seleccionado) ?? null : null;
  const movsDetalle = detalle
    ? movimientos.filter((m) => m.puesto === detalle.puesto)
    : [];

  const saldoPuesto = movsDetalle.reduce((acc, m) => acc + m.monto, 0);

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Control de Contratos</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {actualizado
              ? `Actualizado ${actualizado.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}`
              : "Cargando datos de Google Sheets…"}
          </p>
        </div>
        <button
          onClick={cargar}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          <span className={loading ? "animate-spin" : ""}>🔄</span>
          {loading ? "Actualizando…" : "Actualizar"}
        </button>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          Error al cargar la hoja: {error}
        </div>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        {([
          { key: "vencido", label: "Vencidos", icon: "🔴" },
          { key: "hoy", label: "Vence hoy", icon: "🟠" },
          { key: "proxima_semana", label: "Próx. 7 días", icon: "🟡" },
          { key: "proximo_mes", label: "Próx. 30 días", icon: "🟢" },
          { key: "al_dia", label: "Al día", icon: "✅" },
        ] as const).map(({ key, label, icon }) => {
          const cfg = ESTADO_CONFIG[key];
          const val = stats[key];
          const activo = filtro === key;
          return (
            <button
              key={key}
              onClick={() => setFiltro(activo ? "todos" : key)}
              className={`rounded-xl p-3 text-left border transition-all ${
                activo
                  ? `${cfg.bg} border-transparent ring-2 ring-offset-1 ${cfg.text.replace("text-", "ring-")}`
                  : "bg-white border-gray-200 hover:border-gray-300"
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-xs">{icon}</span>
                <p className="text-[11px] text-gray-500 font-medium">{label}</p>
              </div>
              <p className={`text-2xl font-bold tabular-nums ${val > 0 && (key === "vencido" || key === "hoy") ? "text-red-600" : key === "proxima_semana" ? "text-amber-600" : "text-gray-900"}`}>
                {loading ? "—" : val}
              </p>
            </button>
          );
        })}
      </div>

      {/* Buscador */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Buscar por locatario, puesto o rubro…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="w-full max-w-sm border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d1f3c]"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0d1f3c]" />
        </div>
      ) : filtrados.length === 0 ? (
        <p className="text-center py-16 text-gray-400 text-sm">Sin contratos para el filtro seleccionado</p>
      ) : (
        <div className="space-y-2">
          {filtrados.map((c) => {
            const cfg = ESTADO_CONFIG[c.estado];
            const dias = c.diasDiferencia;
            const vencido = c.estado === "vencido";
            const abierto = seleccionado === c.puesto;
            const movsLocal = movimientos.filter((m) => m.puesto === c.puesto);
            const saldo = movsLocal.reduce((acc, m) => acc + m.monto, 0);

            return (
              <div
                key={c.puesto}
                className={`bg-white rounded-2xl border overflow-hidden transition-all ${
                  abierto ? "border-[#0d1f3c]/30 shadow-sm" : "border-gray-200 hover:border-gray-300"
                }`}
              >
                {/* Barra lateral de urgencia */}
                <div className="flex">
                  <div className={`w-1 flex-shrink-0 ${vencido || c.estado === "hoy" ? "bg-red-500" : c.estado === "proxima_semana" ? "bg-amber-400" : "bg-transparent"}`} />
                  <div className="flex-1">
                    {/* Cabecera */}
                    <button
                      className="w-full text-left px-4 py-3"
                      onClick={() => setSeleccionado(abierto ? null : c.puesto)}
                    >
                      <div className="flex items-center gap-3">
                        {/* Avatar puesto */}
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0 ${vencido ? "bg-red-100 text-red-700" : "bg-[#0d1f3c]/8 text-[#0d1f3c]"}`}>
                          {c.puesto.split("-")[0]}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-gray-900 text-sm">{c.locatario}</p>
                            <span className="text-xs text-gray-400 font-mono">{c.puesto}</span>
                            <span className="text-xs text-gray-400">· {c.rubro}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-xs text-gray-500">
                              Inicio de pago: <span className="font-medium">{formatFechaCorta(c.inicioPago)}</span>
                            </span>
                            <span className="text-gray-200">·</span>
                            <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${c.tipoContrato === "VARIABLE" ? "bg-purple-50 text-purple-600" : "bg-blue-50 text-blue-600"}`}>
                              {c.tipoContrato}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                          {/* Badge estado */}
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.text}`}>
                            {cfg.label}
                          </span>
                          {/* Días */}
                          <span className={`text-xs tabular-nums font-bold ${vencido ? "text-red-600" : c.estado === "proxima_semana" ? "text-amber-600" : "text-gray-400"}`}>
                            {c.estado === "sin_fecha" ? "" : vencido
                              ? `${Math.abs(dias)}d vencido`
                              : dias === 0
                              ? "hoy"
                              : `en ${dias}d`}
                          </span>
                        </div>
                      </div>
                    </button>

                    {/* Panel expandido */}
                    {abierto && (
                      <div className="border-t border-gray-100 bg-gray-50 px-4 py-4">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                          {[
                            { label: "Inicio contrato", val: formatFechaCorta(c.fechaInicio) },
                            { label: "Inicio de pago", val: formatFechaCorta(c.inicioPago) },
                            { label: "Fin de contrato", val: formatFechaCorta(c.finContrato) },
                            { label: "Duración", val: c.duracionMeses ? `${c.duracionMeses} meses` : "—" },
                            { label: "Período de gracia", val: c.graciaMeses ? `${c.graciaMeses} meses` : "—" },
                            { label: "Tipo contrato", val: c.tipoContrato },
                          ].map(({ label, val }) => (
                            <div key={label} className="bg-white rounded-xl px-3 py-2.5 border border-gray-100">
                              <p className="text-[11px] text-gray-400 uppercase tracking-wide">{label}</p>
                              <p className="text-sm font-semibold text-gray-800 mt-0.5">{val || "—"}</p>
                            </div>
                          ))}
                        </div>

                        {/* Movimientos de caja */}
                        {movsLocal.length > 0 && (
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Movimientos de caja</p>
                              <span className={`text-sm font-bold ${saldo >= 0 ? "text-green-600" : "text-red-600"}`}>
                                Saldo: {formatMonto(saldo)}
                              </span>
                            </div>
                            <div className="space-y-1.5">
                              {movsLocal.map((m) => (
                                <div key={m.idMovimiento} className="flex items-center gap-3 bg-white rounded-xl px-3 py-2.5 border border-gray-100">
                                  <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${m.direccion === "INGRESO" ? "bg-green-400" : "bg-red-400"}`} />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-gray-700">{m.concepto}</p>
                                    <p className="text-[11px] text-gray-400">{m.fecha}{m.observaciones ? ` · ${m.observaciones}` : ""}</p>
                                  </div>
                                  <p className={`text-sm font-bold tabular-nums flex-shrink-0 ${m.monto >= 0 ? "text-green-600" : "text-red-500"}`}>
                                    {formatMonto(m.monto)}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* WhatsApp */}
                        <a
                          href={`https://wa.me/?text=${encodeURIComponent(
                            `*Control de Contrato — Sumaq Mercados*\n\n` +
                            `📍 *Local:* ${c.puesto} — ${c.locatario}\n` +
                            `🏷 *Rubro:* ${c.rubro}\n` +
                            `📅 *Inicio de pago:* ${c.inicioPago}\n` +
                            (c.estado === "vencido" ? `⚠️ *VENCIDO* hace ${Math.abs(dias)} días\n` : `✅ Inicio de pago en ${dias} días\n`) +
                            `\n💰 *Saldo adelantos/garantías:* ${formatMonto(saldo)}`
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-3 flex items-center gap-2 justify-center w-full py-2.5 bg-[#25D366] text-white text-sm font-semibold rounded-xl hover:bg-[#1ebe5d] transition-colors"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.12 1.535 5.847L.057 23.571a.75.75 0 00.906.892l5.938-1.56A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75a9.74 9.74 0 01-4.988-1.367l-.358-.212-3.714.976.993-3.628-.233-.374A9.73 9.73 0 012.25 12c0-5.376 4.374-9.75 9.75-9.75s9.75 4.374 9.75 9.75-4.374 9.75-9.75 9.75z"/></svg>
                          Compartir por WhatsApp
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
