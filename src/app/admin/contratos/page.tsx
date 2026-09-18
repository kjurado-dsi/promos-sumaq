"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  collection, doc, setDoc, updateDoc, onSnapshot,
  query, where, orderBy, addDoc, deleteDoc, Timestamp, getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface Contrato {
  id: string; // = puesto
  puesto: string;
  rubro: string;
  locatario: string;
  tipoContrato: string;
  fechaInicio: string;     // DD/MM/YYYY
  duracionMeses: number;
  graciaMeses: number;
  inicioPago: string;      // DD/MM/YYYY
  finContrato: string;     // DD/MM/YYYY
  montoMensual: number;
  garantia: number;
  adelanto: number;
  notas: string;
  estadoContrato: "activo" | "cancelado" | "suspendido";
  actualizadoEn?: { seconds: number };
}

interface Pago {
  id: string;
  puesto: string;
  periodo: string;         // YYYY-MM
  monto: number;
  fechaPago: string;       // DD/MM/YYYY
  medio: "EFECTIVO" | "YAPE" | "TRANSFERENCIA" | "PLIN";
  notas: string;
  registradoPor: string;
  registradoEn?: { seconds: number };
}

type EstadoPago = "pagado" | "vencido" | "proximo" | "futuro" | "en_gracia";
type FiltroEstado = "todos" | "vencido" | "proximo_7" | "proximo_30" | "al_dia";

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseFecha(s: string): Date | null {
  if (!s) return null;
  const [d, m, y] = s.split("/").map(Number);
  if (!d || !m || !y) return null;
  return new Date(y, m - 1, d);
}

function hoy(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function diffDias(fecha: Date): number {
  return Math.round((fecha.getTime() - hoy().getTime()) / 86400000);
}

function periodoActual(): string {
  const h = hoy();
  return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, "0")}`;
}

function periodos(contrato: Contrato): string[] {
  const inicio = parseFecha(contrato.inicioPago);
  if (!inicio) return [];
  const fin = parseFecha(contrato.finContrato);
  const limite = fin && fin < hoy() ? fin : new Date(hoy().getFullYear(), hoy().getMonth() + 1, 1);
  const lista: string[] = [];
  const c = new Date(inicio.getFullYear(), inicio.getMonth(), 1);
  while (c <= limite) {
    lista.push(`${c.getFullYear()}-${String(c.getMonth() + 1).padStart(2, "0")}`);
    c.setMonth(c.getMonth() + 1);
  }
  return lista;
}

function labelPeriodo(p: string): string {
  const [y, m] = p.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("es-PE", { month: "short", year: "2-digit" });
}

function estadoContrato(c: Contrato): { dias: number; tipo: FiltroEstado } {
  const fecha = parseFecha(c.inicioPago);
  if (!fecha) return { dias: 0, tipo: "todos" };
  const dias = diffDias(fecha);
  if (dias < 0) return { dias, tipo: "vencido" };
  if (dias <= 7) return { dias, tipo: "proximo_7" };
  if (dias <= 30) return { dias, tipo: "proximo_30" };
  return { dias, tipo: "al_dia" };
}

function formatS(n: number): string {
  return `S/ ${Math.abs(n).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatFecha(s: string): string {
  const d = parseFecha(s);
  if (!d) return s || "—";
  return d.toLocaleDateString("es-PE", { day: "numeric", month: "short", year: "numeric" });
}

const ESTADO_BADGE: Record<string, string> = {
  vencido:     "bg-red-100 text-red-700",
  proximo_7:   "bg-amber-100 text-amber-700",
  proximo_30:  "bg-yellow-50 text-yellow-700",
  al_dia:      "bg-green-50 text-green-700",
  todos:       "bg-gray-100 text-gray-600",
};

const LABEL_FILTRO: Record<string, string> = {
  vencido:    "Vencido",
  proximo_7:  "Próx. 7 días",
  proximo_30: "Próx. 30 días",
  al_dia:     "Al día",
};

// ── Defaults ──────────────────────────────────────────────────────────────────

const CONTRATO_VACIO: Omit<Contrato, "id"> = {
  puesto: "", rubro: "", locatario: "", tipoContrato: "CONSTANTE",
  fechaInicio: "", duracionMeses: 12, graciaMeses: 4,
  inicioPago: "", finContrato: "", montoMensual: 0,
  garantia: 0, adelanto: 0, notas: "", estadoContrato: "activo",
};

// ── Componente principal ───────────────────────────────────────────────────────

export default function ContratosGestion() {
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [loading, setLoading] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<FiltroEstado>("todos");
  const [busqueda, setBusqueda] = useState("");

  // Modales
  const [modalContrato, setModalContrato] = useState<Partial<Contrato> | null>(null);
  const [esNuevo, setEsNuevo] = useState(false);
  const [modalPago, setModalPago] = useState<{ puesto: string; periodo: string; pago?: Pago } | null>(null);
  const [guardando, setGuardando] = useState(false);

  // ── Firestore live ────────────────────────────────────────────────────────

  useEffect(() => {
    const unsub1 = onSnapshot(
      query(collection(db, "contratos_gestion"), orderBy("inicioPago")),
      (snap) => {
        setContratos(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Contrato)));
        setLoading(false);
      }
    );
    const unsub2 = onSnapshot(
      collection(db, "pagos_contratos"),
      (snap) => setPagos(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Pago)))
    );
    return () => { unsub1(); unsub2(); };
  }, []);

  // ── Sync desde Google Sheets ───────────────────────────────────────────────

  const sincronizar = async () => {
    setSincronizando(true);
    try {
      const res = await fetch("/api/contratos");
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // Leer movimientos para calcular garantía y adelanto por puesto
      const movsPorPuesto: Record<string, { garantia: number; adelanto: number }> = {};
      for (const m of (data.movimientos ?? [])) {
        const p = m.puesto as string;
        if (!movsPorPuesto[p]) movsPorPuesto[p] = { garantia: 0, adelanto: 0 };
        if (m.concepto?.includes("GARANTIA")) movsPorPuesto[p].garantia += m.monto ?? 0;
        if (m.concepto?.includes("ADELANTO")) movsPorPuesto[p].adelanto += m.monto ?? 0;
      }

      // Obtener contratos existentes para no sobreescribir campos operacionales
      const existSnap = await getDocs(collection(db, "contratos_gestion"));
      const existentes = new Set(existSnap.docs.map((d) => d.id));

      for (const c of (data.contratos ?? [])) {
        const id: string = c.puesto;
        const movs = movsPorPuesto[id] ?? { garantia: 0, adelanto: 0 };
        if (existentes.has(id)) {
          // Solo actualiza campos del sheet, no los operacionales
          await updateDoc(doc(db, "contratos_gestion", id), {
            puesto: c.puesto,
            rubro: c.rubro,
            locatario: c.locatario,
            tipoContrato: c.tipoContrato,
            fechaInicio: c.fechaInicio,
            duracionMeses: c.duracionMeses,
            graciaMeses: c.graciaMeses,
            inicioPago: c.inicioPago,
            finContrato: c.finContrato,
            actualizadoEn: Timestamp.now(),
          });
        } else {
          // Crear con datos completos + garantía/adelanto calculados
          await setDoc(doc(db, "contratos_gestion", id), {
            ...c,
            garantia: Math.abs(movs.garantia),
            adelanto: Math.abs(movs.adelanto),
            montoMensual: 0,
            notas: "",
            estadoContrato: "activo",
            actualizadoEn: Timestamp.now(),
          });
        }
      }
    } catch (e) {
      alert("Error al sincronizar: " + String(e));
    } finally {
      setSincronizando(false);
    }
  };

  // ── CRUD contratos ────────────────────────────────────────────────────────

  const guardarContrato = async () => {
    if (!modalContrato) return;
    setGuardando(true);
    try {
      const id = modalContrato.puesto?.trim();
      if (!id) { alert("Ingresa el puesto/local"); return; }
      const data = { ...modalContrato, actualizadoEn: Timestamp.now() };
      await setDoc(doc(db, "contratos_gestion", id), data, { merge: true });
      setModalContrato(null);
    } finally {
      setGuardando(false);
    }
  };

  const eliminarContrato = async (puesto: string) => {
    if (!confirm(`¿Eliminar contrato de ${puesto}?`)) return;
    await deleteDoc(doc(db, "contratos_gestion", puesto));
    const pagosSnap = await getDocs(query(collection(db, "pagos_contratos"), where("puesto", "==", puesto)));
    await Promise.all(pagosSnap.docs.map((d) => deleteDoc(d.ref)));
  };

  // ── CRUD pagos ────────────────────────────────────────────────────────────

  const guardarPago = async (datos: Omit<Pago, "id">) => {
    setGuardando(true);
    try {
      if (modalPago?.pago?.id) {
        await updateDoc(doc(db, "pagos_contratos", modalPago.pago.id), {
          ...datos, registradoEn: Timestamp.now(),
        });
      } else {
        await addDoc(collection(db, "pagos_contratos"), {
          ...datos, registradoEn: Timestamp.now(),
        });
      }
      setModalPago(null);
    } finally {
      setGuardando(false);
    }
  };

  const eliminarPago = async (id: string) => {
    if (!confirm("¿Eliminar este pago?")) return;
    await deleteDoc(doc(db, "pagos_contratos", id));
  };

  // ── Computed ──────────────────────────────────────────────────────────────

  const enriquecidos = useMemo(() =>
    contratos
      .filter((c) => c.estadoContrato !== "cancelado" || filtro === "todos")
      .map((c) => {
        const { dias, tipo } = estadoContrato(c);
        return { ...c, dias, tipo };
      })
      .sort((a, b) => a.dias - b.dias),
  [contratos, filtro]);

  const filtrados = useMemo(() => {
    const q = busqueda.toLowerCase();
    return enriquecidos.filter((c) => {
      const matchFiltro = filtro === "todos" || c.tipo === filtro;
      const matchQ = !q || c.locatario.toLowerCase().includes(q) || c.puesto.toLowerCase().includes(q) || c.rubro.toLowerCase().includes(q);
      return matchFiltro && matchQ;
    });
  }, [enriquecidos, filtro, busqueda]);

  const stats = useMemo(() => {
    const activos = enriquecidos.filter((c) => c.estadoContrato === "activo");
    return {
      vencido:    activos.filter((c) => c.tipo === "vencido").length,
      proximo_7:  activos.filter((c) => c.tipo === "proximo_7").length,
      proximo_30: activos.filter((c) => c.tipo === "proximo_30").length,
      al_dia:     activos.filter((c) => c.tipo === "al_dia").length,
      total:      activos.length,
    };
  }, [enriquecidos]);

  const pagosPorPuesto = useMemo(() => {
    const m: Record<string, Pago[]> = {};
    for (const p of pagos) {
      if (!m[p.puesto]) m[p.puesto] = [];
      m[p.puesto].push(p);
    }
    return m;
  }, [pagos]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-4 md:p-8 max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[#0d1f3c]">Control de Contratos</h1>
            <p className="text-sm text-gray-400 mt-0.5">{contratos.length} locatarios registrados</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { setModalContrato({ ...CONTRATO_VACIO }); setEsNuevo(true); }}
              className="px-4 py-2 bg-[#0d1f3c] text-white text-sm font-semibold rounded-xl hover:bg-[#1a3358] transition-colors"
            >
              + Nuevo contrato
            </button>
            <button
              onClick={sincronizar}
              disabled={sincronizando}
              className="px-4 py-2 bg-white border border-gray-200 text-sm font-medium text-gray-600 rounded-xl hover:bg-gray-50 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              <span className={sincronizando ? "animate-spin inline-block" : ""}>🔄</span>
              {sincronizando ? "Sincronizando…" : "Sync Google Sheets"}
            </button>
          </div>
        </div>

        {/* Stats semáforo */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {([
            { key: "vencido",    icon: "🔴", label: "Vencidos",      color: "text-red-600" },
            { key: "proximo_7",  icon: "🟠", label: "Próx. 7 días",  color: "text-amber-600" },
            { key: "proximo_30", icon: "🟡", label: "Próx. 30 días", color: "text-yellow-600" },
            { key: "al_dia",     icon: "✅", label: "Al día",         color: "text-green-600" },
          ] as const).map(({ key, icon, label, color }) => (
            <button
              key={key}
              onClick={() => setFiltro(filtro === key ? "todos" : key)}
              className={`rounded-2xl p-4 text-left border transition-all ${
                filtro === key
                  ? "bg-white border-[#0d1f3c] shadow-sm ring-1 ring-[#0d1f3c]/20"
                  : "bg-white border-gray-200 hover:border-gray-300"
              }`}
            >
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-sm">{icon}</span>
                <p className="text-xs text-gray-400 font-medium">{label}</p>
              </div>
              <p className={`text-3xl font-bold tabular-nums ${color}`}>
                {loading ? "—" : stats[key]}
              </p>
            </button>
          ))}
        </div>

        {/* Buscador */}
        <div className="mb-4 flex gap-2">
          <input
            type="text"
            placeholder="Buscar locatario, puesto, rubro…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="flex-1 max-w-sm border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0d1f3c]/20"
          />
          {filtro !== "todos" && (
            <button
              onClick={() => setFiltro("todos")}
              className="px-3 py-2 text-xs text-gray-500 bg-white border border-gray-200 rounded-xl hover:bg-gray-50"
            >
              Limpiar filtro
            </button>
          )}
        </div>

        {/* Lista */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0d1f3c]" />
            <p className="text-sm text-gray-400">Cargando contratos…</p>
          </div>
        ) : filtrados.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-gray-200">
            <p className="text-3xl mb-3">📄</p>
            <p className="text-gray-500 font-medium">Sin contratos</p>
            {contratos.length === 0 && (
              <p className="text-sm text-gray-400 mt-1">
                Presiona <strong>Sync Google Sheets</strong> para importar los datos
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtrados.map((c) => {
              const abierto = expandido === c.puesto;
              const pagosC = pagosPorPuesto[c.puesto] ?? [];
              const ps = periodos(c);
              const pagosPorPeriodo: Record<string, Pago> = {};
              for (const p of pagosC) pagosPorPeriodo[p.periodo] = p;
              const hoyPeriodo = periodoActual();
              const pendientes = ps.filter((p) => !pagosPorPeriodo[p] && p <= hoyPeriodo).length;
              const vencidoC = c.tipo === "vencido";

              return (
                <div
                  key={c.puesto}
                  className={`bg-white rounded-2xl border overflow-hidden transition-shadow ${
                    abierto ? "shadow-md border-gray-300" : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {/* Barra de urgencia */}
                  <div className="flex">
                    <div className={`w-1 flex-shrink-0 rounded-l-2xl ${
                      vencidoC ? "bg-red-500" :
                      c.tipo === "proximo_7" ? "bg-amber-400" :
                      c.tipo === "proximo_30" ? "bg-yellow-300" : "bg-green-400"
                    }`} />

                    <div className="flex-1 min-w-0">
                      {/* Cabecera */}
                      <div className="flex items-center gap-3 px-4 py-3.5">
                        {/* Avatar */}
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                          vencidoC ? "bg-red-100 text-red-700" : "bg-[#0d1f3c]/8 text-[#0d1f3c]"
                        }`}>
                          <div className="text-center leading-tight">
                            <div>{c.puesto.split("-")[0]}</div>
                            <div className="text-[9px] font-mono opacity-70">{c.puesto.split("-")[1]}</div>
                          </div>
                        </div>

                        {/* Info principal */}
                        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setExpandido(abierto ? null : c.puesto)}>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-gray-900 text-sm">{c.locatario}</p>
                            <span className="text-[11px] text-gray-400 font-mono bg-gray-100 px-1.5 py-0.5 rounded">{c.puesto}</span>
                            <span className="text-[11px] text-gray-400">{c.rubro}</span>
                            {c.estadoContrato !== "activo" && (
                              <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                                c.estadoContrato === "suspendido" ? "bg-orange-100 text-orange-700" : "bg-gray-200 text-gray-500"
                              }`}>{c.estadoContrato}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                            <span className="text-xs text-gray-400">
                              Inicio de pago: <strong className="text-gray-700">{formatFecha(c.inicioPago)}</strong>
                            </span>
                            {c.montoMensual > 0 && (
                              <span className="text-xs text-gray-400">
                                · Mensual: <strong className="text-gray-700">{formatS(c.montoMensual)}</strong>
                              </span>
                            )}
                            {pendientes > 0 && (
                              <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                                {pendientes} mes{pendientes > 1 ? "es" : ""} sin pago
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Días + acciones */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <div className="text-right">
                            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full block ${ESTADO_BADGE[c.tipo]}`}>
                              {LABEL_FILTRO[c.tipo] ?? "Al día"}
                            </span>
                            <span className={`text-[11px] font-bold mt-1 block ${
                              vencidoC ? "text-red-500" : c.tipo === "proximo_7" ? "text-amber-600" : "text-gray-400"
                            }`}>
                              {vencidoC ? `${Math.abs(c.dias)}d vencido` : c.dias === 0 ? "¡hoy!" : `en ${c.dias}d`}
                            </span>
                          </div>
                          <button
                            onClick={() => { setModalContrato({ ...c }); setEsNuevo(false); }}
                            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                            title="Editar contrato"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => setExpandido(abierto ? null : c.puesto)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                          >
                            {abierto ? "▲" : "▼"}
                          </button>
                        </div>
                      </div>

                      {/* Panel expandido */}
                      {abierto && (
                        <div className="border-t border-gray-100 bg-gray-50 p-4 space-y-4">

                          {/* Datos del contrato */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {[
                              { l: "Inicio contrato", v: formatFecha(c.fechaInicio) },
                              { l: "Fin contrato",    v: formatFecha(c.finContrato) },
                              { l: "Duración",        v: c.duracionMeses ? `${c.duracionMeses} meses` : "—" },
                              { l: "Tipo",            v: c.tipoContrato },
                              { l: "Garantía cobrada", v: c.garantia ? formatS(c.garantia) : "—" },
                              { l: "Adelanto cobrado",  v: c.adelanto ? formatS(c.adelanto) : "—" },
                              { l: "Monto mensual",  v: c.montoMensual ? formatS(c.montoMensual) : "Sin definir" },
                              { l: "Gracia",          v: c.graciaMeses ? `${c.graciaMeses} meses` : "—" },
                            ].map(({ l, v }) => (
                              <div key={l} className="bg-white rounded-xl px-3 py-2 border border-gray-100">
                                <p className="text-[10px] text-gray-400 uppercase tracking-wide">{l}</p>
                                <p className="text-sm font-semibold text-gray-800 mt-0.5 truncate">{v}</p>
                              </div>
                            ))}
                          </div>

                          {/* Grid de pagos por mes */}
                          {ps.length > 0 && (
                            <div>
                              <div className="flex items-center justify-between mb-2.5">
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Seguimiento mensual</p>
                                <button
                                  onClick={() => setModalPago({ puesto: c.puesto, periodo: hoyPeriodo })}
                                  className="text-xs px-3 py-1.5 bg-[#0d1f3c] text-white rounded-lg font-medium hover:bg-[#1a3358] transition-colors"
                                >
                                  + Registrar pago
                                </button>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {ps.map((periodo) => {
                                  const p = pagosPorPeriodo[periodo];
                                  const esHoy = periodo === hoyPeriodo;
                                  const esVencido = periodo < hoyPeriodo && !p;
                                  return (
                                    <button
                                      key={periodo}
                                      onClick={() => setModalPago({ puesto: c.puesto, periodo, pago: p })}
                                      className={`flex flex-col items-center px-3 py-2 rounded-xl border text-center transition-all min-w-[64px] ${
                                        p
                                          ? "bg-green-50 border-green-200 hover:border-green-400"
                                          : esVencido
                                          ? "bg-red-50 border-red-200 hover:border-red-400"
                                          : esHoy
                                          ? "bg-amber-50 border-amber-300 hover:border-amber-400"
                                          : "bg-white border-gray-200 hover:border-gray-400"
                                      }`}
                                      title={p ? `Pagado: ${formatS(p.monto)} el ${p.fechaPago}` : esVencido ? "Sin pago registrado" : ""}
                                    >
                                      <span className="text-[11px] font-semibold text-gray-700">{labelPeriodo(periodo)}</span>
                                      {p ? (
                                        <>
                                          <span className="text-[10px] text-green-600 font-bold">✓ Pagado</span>
                                          <span className="text-[10px] text-green-600">{formatS(p.monto)}</span>
                                        </>
                                      ) : esVencido ? (
                                        <span className="text-[10px] text-red-500 font-semibold">⚠ Pendiente</span>
                                      ) : esHoy ? (
                                        <span className="text-[10px] text-amber-600 font-semibold">← Este mes</span>
                                      ) : (
                                        <span className="text-[10px] text-gray-300">—</span>
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Notas */}
                          <div>
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Notas internas</p>
                            <NotasInline
                              valor={c.notas}
                              onGuardar={(v) => updateDoc(doc(db, "contratos_gestion", c.puesto), { notas: v })}
                            />
                          </div>

                          {/* Acciones peligrosas */}
                          <div className="flex justify-end">
                            <button
                              onClick={() => eliminarContrato(c.puesto)}
                              className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                            >
                              Eliminar contrato
                            </button>
                          </div>
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

      {/* Modal — Editar/Crear contrato */}
      {modalContrato && (
        <ModalContrato
          datos={modalContrato}
          esNuevo={esNuevo}
          guardando={guardando}
          onChange={(k, v) => setModalContrato((prev) => prev ? { ...prev, [k]: v } : prev)}
          onGuardar={guardarContrato}
          onCerrar={() => setModalContrato(null)}
        />
      )}

      {/* Modal — Registrar pago */}
      {modalPago && (
        <ModalPago
          puesto={modalPago.puesto}
          periodo={modalPago.periodo}
          pagoExistente={modalPago.pago}
          guardando={guardando}
          onGuardar={guardarPago}
          onEliminar={modalPago.pago ? () => { eliminarPago(modalPago.pago!.id); setModalPago(null); } : undefined}
          onCerrar={() => setModalPago(null)}
        />
      )}
    </div>
  );
}

// ── Notas inline ──────────────────────────────────────────────────────────────

function NotasInline({ valor, onGuardar }: { valor: string; onGuardar: (v: string) => void }) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(valor);
  return editando ? (
    <div className="flex gap-2">
      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d1f3c]/20 resize-none"
        rows={2}
        autoFocus
      />
      <div className="flex flex-col gap-1">
        <button onClick={() => { onGuardar(texto); setEditando(false); }} className="px-3 py-1.5 bg-[#0d1f3c] text-white text-xs rounded-lg">Guardar</button>
        <button onClick={() => { setTexto(valor); setEditando(false); }} className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs rounded-lg">Cancelar</button>
      </div>
    </div>
  ) : (
    <div
      onClick={() => setEditando(true)}
      className="w-full min-h-[36px] bg-white border border-dashed border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-500 cursor-text hover:border-gray-400 transition-colors"
    >
      {valor || <span className="text-gray-300 italic">Clic para agregar notas…</span>}
    </div>
  );
}

// ── Modal contrato ────────────────────────────────────────────────────────────

function ModalContrato({
  datos, esNuevo, guardando, onChange, onGuardar, onCerrar,
}: {
  datos: Partial<Contrato>;
  esNuevo: boolean;
  guardando: boolean;
  onChange: (k: string, v: string | number) => void;
  onGuardar: () => void;
  onCerrar: () => void;
}) {
  const inp = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d1f3c]/20";
  const lbl = "text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block";

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/40" onClick={onCerrar} />
      <div className="relative ml-auto w-full max-w-lg bg-white h-full overflow-y-auto shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="font-bold text-gray-900">{esNuevo ? "Nuevo contrato" : `Editar — ${datos.puesto}`}</h2>
          <button onClick={onCerrar} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400">✕</button>
        </div>
        <div className="flex-1 px-6 py-5 space-y-5">

          <Section title="Identificación">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Puesto / Local</label>
                <input value={datos.puesto ?? ""} onChange={(e) => onChange("puesto", e.target.value)} className={inp} placeholder="RF-102" disabled={!esNuevo} />
              </div>
              <div>
                <label className={lbl}>Rubro</label>
                <input value={datos.rubro ?? ""} onChange={(e) => onChange("rubro", e.target.value)} className={inp} placeholder="EMBUTIDOS" />
              </div>
            </div>
            <div>
              <label className={lbl}>Locatario / Razón Social</label>
              <input value={datos.locatario ?? ""} onChange={(e) => onChange("locatario", e.target.value)} className={inp} placeholder="Nombre completo" />
            </div>
          </Section>

          <Section title="Contrato">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Tipo de contrato</label>
                <select value={datos.tipoContrato ?? "CONSTANTE"} onChange={(e) => onChange("tipoContrato", e.target.value)} className={inp}>
                  <option>CONSTANTE</option>
                  <option>VARIABLE</option>
                </select>
              </div>
              <div>
                <label className={lbl}>Estado</label>
                <select value={datos.estadoContrato ?? "activo"} onChange={(e) => onChange("estadoContrato", e.target.value)} className={inp}>
                  <option value="activo">Activo</option>
                  <option value="suspendido">Suspendido</option>
                  <option value="cancelado">Cancelado</option>
                </select>
              </div>
              <div>
                <label className={lbl}>Fecha de inicio</label>
                <input type="text" value={datos.fechaInicio ?? ""} onChange={(e) => onChange("fechaInicio", e.target.value)} className={inp} placeholder="DD/MM/YYYY" />
              </div>
              <div>
                <label className={lbl}>Fin de contrato</label>
                <input type="text" value={datos.finContrato ?? ""} onChange={(e) => onChange("finContrato", e.target.value)} className={inp} placeholder="DD/MM/YYYY" />
              </div>
              <div>
                <label className={lbl}>Duración (meses)</label>
                <input type="number" value={datos.duracionMeses ?? ""} onChange={(e) => onChange("duracionMeses", Number(e.target.value))} className={inp} />
              </div>
              <div>
                <label className={lbl}>Gracia (meses)</label>
                <input type="number" value={datos.graciaMeses ?? ""} onChange={(e) => onChange("graciaMeses", Number(e.target.value))} className={inp} />
              </div>
              <div>
                <label className={lbl}>Inicio de pago</label>
                <input type="text" value={datos.inicioPago ?? ""} onChange={(e) => onChange("inicioPago", e.target.value)} className={inp} placeholder="DD/MM/YYYY" />
              </div>
            </div>
          </Section>

          <Section title="Económico">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Monto mensual (S/.)</label>
                <input type="number" value={datos.montoMensual ?? ""} onChange={(e) => onChange("montoMensual", Number(e.target.value))} className={inp} placeholder="0.00" />
              </div>
              <div />
              <div>
                <label className={lbl}>Garantía cobrada (S/.)</label>
                <input type="number" value={datos.garantia ?? ""} onChange={(e) => onChange("garantia", Number(e.target.value))} className={inp} placeholder="0.00" />
              </div>
              <div>
                <label className={lbl}>Adelanto cobrado (S/.)</label>
                <input type="number" value={datos.adelanto ?? ""} onChange={(e) => onChange("adelanto", Number(e.target.value))} className={inp} placeholder="0.00" />
              </div>
            </div>
          </Section>

          <Section title="Notas">
            <textarea
              value={datos.notas ?? ""}
              onChange={(e) => onChange("notas", e.target.value)}
              className={`${inp} resize-none`}
              rows={3}
              placeholder="Observaciones internas…"
            />
          </Section>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 sticky bottom-0 bg-white">
          <button onClick={onCerrar} className="flex-1 py-3 bg-gray-100 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-200 transition-colors">
            Cancelar
          </button>
          <button onClick={onGuardar} disabled={guardando} className="flex-1 py-3 bg-[#0d1f3c] text-white text-sm font-semibold rounded-xl hover:bg-[#1a3358] disabled:opacity-50 transition-colors">
            {guardando ? "Guardando…" : esNuevo ? "Crear contrato" : "Guardar cambios"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-bold text-[#0d1f3c] uppercase tracking-wider mb-3">{title}</p>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

// ── Modal pago ────────────────────────────────────────────────────────────────

function ModalPago({
  puesto, periodo, pagoExistente, guardando, onGuardar, onEliminar, onCerrar,
}: {
  puesto: string;
  periodo: string;
  pagoExistente?: Pago;
  guardando: boolean;
  onGuardar: (d: Omit<Pago, "id">) => void;
  onEliminar?: () => void;
  onCerrar: () => void;
}) {
  const [monto, setMonto] = useState(String(pagoExistente?.monto ?? ""));
  const [fechaPago, setFechaPago] = useState(pagoExistente?.fechaPago ?? new Date().toLocaleDateString("es-PE").replace(/\//g, "/"));
  const [medio, setMedio] = useState<Pago["medio"]>(pagoExistente?.medio ?? "EFECTIVO");
  const [notas, setNotas] = useState(pagoExistente?.notas ?? "");
  const [periodoEdit, setPeriodoEdit] = useState(periodo);

  const inp = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d1f3c]/20";

  const handleGuardar = () => {
    onGuardar({
      puesto,
      periodo: periodoEdit,
      monto: parseFloat(monto) || 0,
      fechaPago,
      medio,
      notas,
      registradoPor: "admin",
    });
  };

  const [y, m] = periodoEdit.split("-");
  const labelP = y && m
    ? new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("es-PE", { month: "long", year: "numeric" })
    : periodoEdit;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onCerrar} />
      <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-gray-900">{pagoExistente ? "Editar pago" : "Registrar pago"}</h3>
            <p className="text-xs text-gray-400 mt-0.5">{puesto} · {labelP}</p>
          </div>
          <button onClick={onCerrar} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400">✕</button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Período</label>
            <input
              type="month"
              value={periodoEdit}
              onChange={(e) => setPeriodoEdit(e.target.value)}
              className={inp}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Monto (S/.)</label>
            <input
              type="number"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              className={inp}
              placeholder="0.00"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Fecha de pago</label>
              <input type="text" value={fechaPago} onChange={(e) => setFechaPago(e.target.value)} className={inp} placeholder="DD/MM/YYYY" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Medio</label>
              <select value={medio} onChange={(e) => setMedio(e.target.value as Pago["medio"])} className={inp}>
                <option>EFECTIVO</option>
                <option>YAPE</option>
                <option>TRANSFERENCIA</option>
                <option>PLIN</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Notas</label>
            <input type="text" value={notas} onChange={(e) => setNotas(e.target.value)} className={inp} placeholder="Observaciones…" />
          </div>
        </div>

        <div className="px-5 pb-5 space-y-2">
          <button
            onClick={handleGuardar}
            disabled={guardando || !monto}
            className="w-full py-3 bg-[#0d1f3c] text-white text-sm font-bold rounded-xl hover:bg-[#1a3358] disabled:opacity-50 transition-colors"
          >
            {guardando ? "Guardando…" : pagoExistente ? "Actualizar pago" : "Confirmar pago ✓"}
          </button>
          {onEliminar && (
            <button onClick={onEliminar} className="w-full py-2.5 text-sm text-red-500 hover:text-red-700 transition-colors">
              Eliminar pago
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
