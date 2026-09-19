"use client";

import { useEffect, useState, useMemo } from "react";
import {
  collection, doc, setDoc, updateDoc, onSnapshot,
  query, orderBy, deleteDoc, Timestamp, getDocs, arrayUnion, arrayRemove,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface Pago {
  pagoId: string;
  periodo: string;  // YYYY-MM
  monto: number;
  fechaPago: string;
  medio: "EFECTIVO" | "YAPE" | "TRANSFERENCIA" | "PLIN";
  notas: string;
}

interface Contrato {
  id: string;
  puesto: string;
  rubro: string;
  locatario: string;
  tipoContrato: string;
  fechaInicio: string;
  duracionMeses: number;
  graciaMeses: number;
  inicioPago: string;
  finContrato: string;
  montoMensual: number;
  garantia: number;
  adelanto: number;
  notas: string;
  estadoContrato: "activo" | "cancelado" | "suspendido";
  pagos: Pago[];
  actualizadoEn?: { seconds: number };
}

type FiltroEstado = "todos" | "vencido" | "proximo_7" | "proximo_30" | "al_dia";
type Vista = "lista" | "matriz";

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseFecha(s: string): Date | null {
  if (!s) return null;
  const parts = s.split("/");
  if (parts.length !== 3) return null;
  const [d, m, y] = parts.map(Number);
  if (!d || !m || !y) return null;
  return new Date(y, m - 1, d);
}

function hoyDate(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function diffDias(fecha: Date): number {
  return Math.round((fecha.getTime() - hoyDate().getTime()) / 86400000);
}

function periodoActual(): string {
  const h = hoyDate();
  return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, "0")}`;
}

function generarPeriodos(c: Contrato): string[] {
  const inicio = parseFecha(c.inicioPago);
  if (!inicio) return [];
  const fin = parseFecha(c.finContrato);
  const hoy = hoyDate();
  const limite = new Date(fin && fin < hoy ? fin : hoy);
  limite.setDate(1);
  limite.setMonth(limite.getMonth() + 1);
  const lista: string[] = [];
  const cur = new Date(inicio.getFullYear(), inicio.getMonth(), 1);
  while (cur <= limite) {
    lista.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`);
    cur.setMonth(cur.getMonth() + 1);
    if (lista.length > 36) break;
  }
  return lista;
}

function labelPeriodo(p: string): string {
  const [y, m] = p.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("es-PE", { month: "short", year: "2-digit" });
}

function labelPeriodoLargo(p: string): string {
  const [y, m] = p.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("es-PE", { month: "long", year: "numeric" });
}

function clasifContrato(c: Contrato): { dias: number; tipo: FiltroEstado } {
  const fecha = parseFecha(c.inicioPago);
  if (!fecha) return { dias: 0, tipo: "todos" };
  const dias = diffDias(fecha);
  if (dias < 0) return { dias, tipo: "vencido" };
  if (dias <= 7) return { dias, tipo: "proximo_7" };
  if (dias <= 30) return { dias, tipo: "proximo_30" };
  return { dias, tipo: "al_dia" };
}

function diasParaVencerContrato(c: Contrato): number | null {
  const fin = parseFecha(c.finContrato);
  if (!fin) return null;
  return diffDias(fin);
}

function formatS(n: number): string {
  return `S/ ${Math.abs(n).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatFecha(s: string): string {
  const d = parseFecha(s);
  if (!d) return s || "—";
  return d.toLocaleDateString("es-PE", { day: "numeric", month: "short", year: "numeric" });
}

function uid6(): string {
  return Math.random().toString(36).slice(2, 8);
}

function waRecibo(c: Contrato, p: Pago): string {
  const text = `✅ *RECIBO DE PAGO*\n*Sumaq Mercados*\n\nLocal: ${c.puesto}\nLocatario: ${c.locatario}\nPeríodo: ${labelPeriodoLargo(p.periodo)}\nMonto: ${formatS(p.monto)}\nMedio: ${p.medio}\nFecha: ${p.fechaPago}\n\nGracias por su pago 🙏`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

function waRecordatorio(c: Contrato, pendientes: number): string {
  const total = pendientes * c.montoMensual;
  const text = `Estimado(a) *${c.locatario}*,\n\nLe recordamos que tiene *${pendientes} mes${pendientes > 1 ? "es" : ""} pendiente${pendientes > 1 ? "s" : ""}* de alquiler en Sumaq Mercados (Local ${c.puesto}).\n\n💰 Monto mensual: ${formatS(c.montoMensual)}\n📋 Total adeudado: ${formatS(total)}\n\nPor favor acérquese a cancelar a la brevedad.\n\nGracias 🙏\n*Sumaq Mercados*`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

// genera los últimos N meses hasta hoy (para la matriz)
function periodosMeses(n: number): string[] {
  const res: string[] = [];
  const hoy = hoyDate();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    res.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return res;
}

const ESTADO_BADGE: Record<string, string> = {
  vencido:    "bg-red-100 text-red-700",
  proximo_7:  "bg-amber-100 text-amber-700",
  proximo_30: "bg-yellow-50 text-yellow-700",
  al_dia:     "bg-green-50 text-green-700",
};
const LABEL_FILTRO: Record<string, string> = {
  vencido: "Vencido", proximo_7: "Próx. 7d", proximo_30: "Próx. 30d", al_dia: "Al día",
};
const CONTRATO_VACIO: Omit<Contrato, "id"> = {
  puesto: "", rubro: "", locatario: "", tipoContrato: "CONSTANTE",
  fechaInicio: "", duracionMeses: 12, graciaMeses: 4,
  inicioPago: "", finContrato: "", montoMensual: 0,
  garantia: 0, adelanto: 0, notas: "", estadoContrato: "activo", pagos: [],
};

// ── Componente principal ───────────────────────────────────────────────────────

export default function ContratosGestion() {
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [loading, setLoading] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<FiltroEstado>("todos");
  const [busqueda, setBusqueda] = useState("");
  const [modalContrato, setModalContrato] = useState<Partial<Contrato> | null>(null);
  const [esNuevo, setEsNuevo] = useState(false);
  const [modalPago, setModalPago] = useState<{ puesto: string; periodo: string; pago?: Pago; contrato?: Contrato } | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [vista, setVista] = useState<Vista>("lista");
  const [ultimoPago, setUltimoPago] = useState<{ contrato: Contrato; pago: Pago } | null>(null);

  // ── Firestore live ────────────────────────────────────────────────────────

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "contratos"), orderBy("inicioPago")),
      (snap) => {
        setContratos(
          snap.docs
            .map((d) => ({ pagos: [], ...d.data(), id: d.id } as unknown as Contrato))
            .filter((c) => c.puesto)
        );
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, []);

  // ── Sync desde Google Sheets ──────────────────────────────────────────────

  const sincronizar = async () => {
    setSincronizando(true);
    try {
      const res = await fetch("/api/contratos");
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const movsPorPuesto: Record<string, { garantia: number; adelanto: number }> = {};
      for (const m of (data.movimientos ?? [])) {
        const p = m.puesto as string;
        if (!movsPorPuesto[p]) movsPorPuesto[p] = { garantia: 0, adelanto: 0 };
        const monto = Math.abs(m.monto ?? 0);
        if ((m.concepto ?? "").includes("GARANTIA")) movsPorPuesto[p].garantia += monto;
        if ((m.concepto ?? "").includes("ADELANTO")) movsPorPuesto[p].adelanto += monto;
      }

      const existSnap = await getDocs(collection(db, "contratos"));
      const existentes = new Set(existSnap.docs.map((d) => d.id));

      for (const c of (data.contratos ?? [])) {
        const id: string = c.puesto;
        if (existentes.has(id)) {
          await updateDoc(doc(db, "contratos", id), {
            puesto: c.puesto, rubro: c.rubro, locatario: c.locatario,
            tipoContrato: c.tipoContrato, fechaInicio: c.fechaInicio,
            duracionMeses: c.duracionMeses, graciaMeses: c.graciaMeses,
            inicioPago: c.inicioPago, finContrato: c.finContrato,
            _syncedAt: Timestamp.now(),
          });
        } else {
          const movs = movsPorPuesto[id] ?? { garantia: 0, adelanto: 0 };
          await setDoc(doc(db, "contratos", id), {
            ...c, garantia: movs.garantia, adelanto: movs.adelanto,
            montoMensual: 0, notas: "", estadoContrato: "activo",
            pagos: [], _syncedAt: Timestamp.now(),
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
    const id = (modalContrato.puesto ?? "").trim();
    if (!id) { alert("Ingresa el puesto/local"); return; }
    setGuardando(true);
    try {
      await setDoc(doc(db, "contratos", id), {
        pagos: [], ...modalContrato, _updatedAt: Timestamp.now(),
      }, { merge: true });
      setModalContrato(null);
    } finally { setGuardando(false); }
  };

  const eliminarContrato = async (puesto: string) => {
    if (!confirm(`¿Eliminar contrato de ${puesto}? Se perderán todos los datos.`)) return;
    await deleteDoc(doc(db, "contratos", puesto));
  };

  // ── CRUD pagos ────────────────────────────────────────────────────────────

  const guardarPago = async (puesto: string, datos: Omit<Pago, "pagoId" | "puesto">, pagoAnterior?: Pago) => {
    setGuardando(true);
    try {
      const ref = doc(db, "contratos", puesto);
      if (pagoAnterior) {
        await updateDoc(ref, { pagos: arrayRemove(pagoAnterior) });
      }
      const nuevoPago: Pago = { ...datos, pagoId: pagoAnterior?.pagoId ?? uid6() };
      await updateDoc(ref, { pagos: arrayUnion(nuevoPago) });
      // guardar para recibo WA
      const c = contratos.find(x => x.puesto === puesto);
      if (c) setUltimoPago({ contrato: c, pago: nuevoPago });
      setModalPago(null);
    } finally { setGuardando(false); }
  };

  const eliminarPago = async (puesto: string, pago: Pago) => {
    if (!confirm("¿Eliminar este pago?")) return;
    await updateDoc(doc(db, "contratos", puesto), { pagos: arrayRemove(pago) });
    setModalPago(null);
  };

  // ── Computed ──────────────────────────────────────────────────────────────

  const enriquecidos = useMemo(() =>
    contratos.map((c) => {
      const { dias, tipo } = clasifContrato(c);
      return { ...c, dias, tipo };
    }).sort((a, b) => a.dias - b.dias),
  [contratos]);

  const filtrados = useMemo(() => {
    const q = busqueda.toLowerCase();
    return enriquecidos.filter((c) => {
      const matchF = filtro === "todos" || c.tipo === filtro ||
        (filtro === "vencido" && c.estadoContrato === "cancelado");
      const matchQ = !q ||
        c.locatario.toLowerCase().includes(q) ||
        c.puesto.toLowerCase().includes(q) ||
        c.rubro.toLowerCase().includes(q);
      return matchF && matchQ;
    });
  }, [enriquecidos, filtro, busqueda]);

  const stats = useMemo(() => {
    const act = enriquecidos.filter((c) => c.estadoContrato === "activo");
    return {
      vencido:    act.filter((c) => c.tipo === "vencido").length,
      proximo_7:  act.filter((c) => c.tipo === "proximo_7").length,
      proximo_30: act.filter((c) => c.tipo === "proximo_30").length,
      al_dia:     act.filter((c) => c.tipo === "al_dia").length,
    };
  }, [enriquecidos]);

  const statsFinancieros = useMemo(() => {
    const mes = periodoActual();
    const activos = enriquecidos.filter(c => c.estadoContrato === "activo");
    const esperado = activos
      .filter(c => generarPeriodos(c).includes(mes))
      .reduce((s, c) => s + (c.montoMensual || 0), 0);
    const cobrado = enriquecidos.reduce((s, c) =>
      s + (c.pagos || []).filter(p => p.periodo === mes).reduce((ss, p) => ss + p.monto, 0), 0);
    const pendiente = Math.max(0, esperado - cobrado);
    const conMora = activos.filter(c => {
      const ps = generarPeriodos(c);
      const pagados = new Set((c.pagos || []).map(p => p.periodo));
      return ps.some(p => p < mes && !pagados.has(p));
    }).length;
    return { esperado, cobrado, pendiente, conMora };
  }, [enriquecidos]);

  const contratosVencer = useMemo(() =>
    enriquecidos.filter(c => {
      if (c.estadoContrato !== "activo") return false;
      const d = diasParaVencerContrato(c);
      return d !== null && d >= 0 && d <= 60;
    }).sort((a, b) => (diasParaVencerContrato(a) ?? 999) - (diasParaVencerContrato(b) ?? 999)),
  [enriquecidos]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-4 md:p-8 max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[#0d1f3c]">Control de Contratos</h1>
            <p className="text-sm text-gray-400 mt-0.5">{contratos.length} locatarios · Sumaq Mercados</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => { setEsNuevo(true); setModalContrato({ ...CONTRATO_VACIO }); }}
              className="px-4 py-2 bg-[#0d1f3c] text-white text-sm font-semibold rounded-xl hover:bg-[#1a3358] transition-colors"
            >
              + Nuevo
            </button>
            <button
              onClick={sincronizar}
              disabled={sincronizando}
              className="px-4 py-2 bg-white border border-gray-200 text-sm font-medium text-gray-600 rounded-xl hover:bg-gray-50 disabled:opacity-50 transition-colors flex items-center gap-1.5"
            >
              <span className={sincronizando ? "animate-spin inline-block" : ""}>🔄</span>
              {sincronizando ? "Sincronizando…" : "Sync Google Sheets"}
            </button>
          </div>
        </div>

        {/* Resumen financiero del mes */}
        <div className="bg-[#0d1f3c] rounded-2xl p-4 mb-4 text-white">
          <p className="text-xs font-bold uppercase tracking-wider text-white/50 mb-3">
            Resumen {labelPeriodoLargo(periodoActual())}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Esperado", val: statsFinancieros.esperado, color: "text-white", sub: "este mes" },
              { label: "Cobrado",  val: statsFinancieros.cobrado,  color: "text-green-300", sub: "registrado" },
              { label: "Pendiente",val: statsFinancieros.pendiente,color: statsFinancieros.pendiente > 0 ? "text-amber-300" : "text-green-300", sub: "por cobrar" },
              { label: "Con mora", val: null, count: statsFinancieros.conMora, color: statsFinancieros.conMora > 0 ? "text-red-300" : "text-green-300", sub: "locatarios" },
            ].map(({ label, val, count, color, sub }) => (
              <div key={label}>
                <p className="text-[11px] text-white/50 mb-0.5">{label}</p>
                <p className={`text-xl font-bold tabular-nums ${color}`}>
                  {loading ? "—" : val !== null && val !== undefined ? formatS(val) : count}
                </p>
                <p className="text-[10px] text-white/30">{sub}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Alerta contratos por vencer */}
        {contratosVencer.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4">
            <p className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-2">
              ⚠️ {contratosVencer.length} contrato{contratosVencer.length > 1 ? "s" : ""} por vencer en los próximos 60 días
            </p>
            <div className="flex flex-wrap gap-2">
              {contratosVencer.map(c => {
                const d = diasParaVencerContrato(c);
                return (
                  <div key={c.puesto} className="bg-white border border-amber-200 rounded-xl px-3 py-2 text-xs">
                    <span className="font-bold text-gray-800">{c.puesto}</span>
                    <span className="text-gray-500 mx-1">·</span>
                    <span className="text-gray-600">{c.locatario}</span>
                    <span className={`ml-2 font-semibold ${d !== null && d <= 7 ? "text-red-600" : "text-amber-600"}`}>
                      {d === 0 ? "¡hoy!" : d !== null ? `${d}d` : ""}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Stats semáforo */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {([
            { key: "vencido",    icon: "🔴", label: "Vencidos",     color: "text-red-600" },
            { key: "proximo_7",  icon: "🟠", label: "Próx. 7 días", color: "text-amber-600" },
            { key: "proximo_30", icon: "🟡", label: "Próx. 30 días",color: "text-yellow-600" },
            { key: "al_dia",     icon: "✅", label: "Al día",        color: "text-green-700" },
          ] as const).map(({ key, icon, label, color }) => (
            <button key={key} onClick={() => setFiltro(filtro === key ? "todos" : key)}
              className={`rounded-2xl p-4 text-left border transition-all ${filtro === key ? "bg-white border-[#0d1f3c] ring-1 ring-[#0d1f3c]/20 shadow-sm" : "bg-white border-gray-200 hover:border-gray-300"}`}
            >
              <div className="flex items-center gap-1.5 mb-1.5">
                <span>{icon}</span>
                <p className="text-[11px] text-gray-400 font-medium">{label}</p>
              </div>
              <p className={`text-3xl font-bold tabular-nums ${color}`}>{loading ? "—" : stats[key]}</p>
            </button>
          ))}
        </div>

        {/* Buscador + vista toggle */}
        <div className="flex gap-2 mb-4 flex-wrap">
          <input type="text" placeholder="Buscar locatario, puesto o rubro…"
            value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
            className="flex-1 min-w-[200px] bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d1f3c]/20"
          />
          <div className="flex bg-white border border-gray-200 rounded-xl overflow-hidden">
            {(["lista", "matriz"] as Vista[]).map((v) => (
              <button key={v} onClick={() => setVista(v)}
                className={`px-4 py-2.5 text-sm font-medium transition-colors ${vista === v ? "bg-[#0d1f3c] text-white" : "text-gray-500 hover:bg-gray-50"}`}>
                {v === "lista" ? "☰ Lista" : "⊞ Matriz"}
              </button>
            ))}
          </div>
          {(filtro !== "todos" || busqueda) && (
            <button onClick={() => { setFiltro("todos"); setBusqueda(""); }}
              className="px-3 py-2 text-xs text-gray-500 bg-white border border-gray-200 rounded-xl hover:bg-gray-50">
              Limpiar
            </button>
          )}
        </div>

        {/* Toast recibo WA */}
        {ultimoPago && (
          <div className="mb-4 bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-sm font-semibold text-green-800">
                ✅ Pago registrado — {ultimoPago.contrato.locatario} · {formatS(ultimoPago.pago.monto)}
              </p>
              <p className="text-xs text-green-600 mt-0.5">¿Compartir recibo?</p>
            </div>
            <div className="flex gap-2">
              <a href={waRecibo(ultimoPago.contrato, ultimoPago.pago)} target="_blank" rel="noreferrer"
                className="px-4 py-2 bg-[#25d366] text-white text-xs font-bold rounded-xl hover:opacity-90 transition-opacity flex items-center gap-1.5">
                📲 Recibo por WhatsApp
              </a>
              <button onClick={() => setUltimoPago(null)}
                className="px-3 py-2 text-xs text-gray-500 bg-white border border-gray-200 rounded-xl hover:bg-gray-50">
                Cerrar
              </button>
            </div>
          </div>
        )}

        {/* Contenido principal */}
        {loading ? (
          <div className="flex flex-col items-center py-24 gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0d1f3c]" />
            <p className="text-sm text-gray-400">Cargando…</p>
          </div>
        ) : vista === "matriz" ? (
          <MatrizMensual
            contratos={filtrados}
            onCeldaClick={(puesto, periodo, pago, c) =>
              setModalPago({ puesto, periodo, pago, contrato: c })
            }
          />
        ) : filtrados.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-gray-200">
            <p className="text-4xl mb-3">📄</p>
            <p className="font-semibold text-gray-600">Sin contratos</p>
            {contratos.length === 0 && (
              <p className="text-sm text-gray-400 mt-2 max-w-xs mx-auto">
                Presiona <strong>Sync Google Sheets</strong> para importar los datos
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtrados.map((c) => {
              const abierto = expandido === c.puesto;
              const ps = generarPeriodos(c);
              const pagosPorPeriodo: Record<string, Pago> = {};
              for (const p of (c.pagos ?? [])) pagosPorPeriodo[p.periodo] = p;
              const hoyP = periodoActual();
              const pendientes = ps.filter((p) => !pagosPorPeriodo[p] && p <= hoyP).length;
              const vencidoC = c.tipo === "vencido";

              return (
                <div key={c.puesto}
                  className={`bg-white rounded-2xl border overflow-hidden transition-shadow ${abierto ? "shadow-md border-gray-300" : "border-gray-200 hover:border-gray-300"}`}
                >
                  <div className="flex">
                    <div className={`w-1 flex-shrink-0 ${vencidoC ? "bg-red-500" : c.tipo === "proximo_7" ? "bg-amber-400" : c.tipo === "proximo_30" ? "bg-yellow-300" : "bg-green-400"}`} />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 px-4 py-3.5">
                        {/* Avatar */}
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${vencidoC ? "bg-red-100" : "bg-[#0d1f3c]/8"}`}>
                          <div className="text-center">
                            <p className={`text-[10px] font-bold leading-tight ${vencidoC ? "text-red-700" : "text-[#0d1f3c]"}`}>{c.puesto.split("-")[0]}</p>
                            <p className={`text-[9px] font-mono ${vencidoC ? "text-red-500" : "text-[#0d1f3c]/60"}`}>{c.puesto.split("-")[1]}</p>
                          </div>
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setExpandido(abierto ? null : c.puesto)}>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-gray-900 text-sm">{c.locatario}</p>
                            <span className="text-[11px] text-gray-400 font-mono bg-gray-100 px-1.5 py-0.5 rounded">{c.puesto}</span>
                            <span className="text-[11px] text-gray-400">{c.rubro}</span>
                            {c.estadoContrato !== "activo" && (
                              <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${c.estadoContrato === "suspendido" ? "bg-orange-100 text-orange-700" : "bg-gray-200 text-gray-500"}`}>
                                {c.estadoContrato}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-xs text-gray-400">
                              Inicio pago: <strong className="text-gray-700">{formatFecha(c.inicioPago)}</strong>
                            </span>
                            {c.montoMensual > 0 && (
                              <span className="text-xs text-gray-400">· <strong className="text-gray-700">{formatS(c.montoMensual)}/mes</strong></span>
                            )}
                            {pendientes > 0 && ps.length > 0 && (
                              <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                                {pendientes} mes{pendientes > 1 ? "es" : ""} sin registrar
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Acciones rápidas */}
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {pendientes > 0 && c.montoMensual > 0 && (
                            <a href={waRecordatorio(c, pendientes)} target="_blank" rel="noreferrer"
                              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-green-50 text-lg transition-colors" title="Recordatorio WhatsApp">
                              📲
                            </a>
                          )}
                          <div className="text-right mr-1">
                            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full block ${ESTADO_BADGE[c.tipo] ?? "bg-gray-100 text-gray-500"}`}>
                              {LABEL_FILTRO[c.tipo] ?? "Al día"}
                            </span>
                            <span className={`text-[11px] font-bold mt-0.5 block ${vencidoC ? "text-red-500" : c.tipo === "proximo_7" ? "text-amber-600" : "text-gray-400"}`}>
                              {vencidoC ? `${Math.abs(c.dias)}d vencido` : c.dias === 0 ? "¡hoy!" : `en ${c.dias}d`}
                            </span>
                          </div>
                          <button onClick={() => { setEsNuevo(false); setModalContrato({ ...c }); }}
                            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-lg transition-colors" title="Editar">✏️</button>
                          <button onClick={() => setExpandido(abierto ? null : c.puesto)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 transition-colors text-sm">
                            {abierto ? "▲" : "▼"}
                          </button>
                        </div>
                      </div>

                      {/* Panel expandido */}
                      {abierto && (
                        <div className="border-t border-gray-100 bg-gray-50 p-4 space-y-5">

                          {/* Datos */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {[
                              { l: "Inicio contrato", v: formatFecha(c.fechaInicio) },
                              { l: "Fin contrato",    v: formatFecha(c.finContrato) },
                              { l: "Duración",        v: c.duracionMeses ? `${c.duracionMeses} meses` : "—" },
                              { l: "Gracia",          v: c.graciaMeses ? `${c.graciaMeses} meses` : "—" },
                              { l: "Monto mensual",   v: c.montoMensual ? formatS(c.montoMensual) : "Sin definir" },
                              { l: "Garantía",        v: c.garantia ? formatS(c.garantia) : "—" },
                              { l: "Adelanto",        v: c.adelanto ? formatS(c.adelanto) : "—" },
                              { l: "Tipo",            v: c.tipoContrato },
                            ].map(({ l, v }) => (
                              <div key={l} className="bg-white rounded-xl px-3 py-2 border border-gray-100">
                                <p className="text-[10px] text-gray-400 uppercase tracking-wide">{l}</p>
                                <p className="text-sm font-semibold text-gray-800 mt-0.5">{v}</p>
                              </div>
                            ))}
                          </div>

                          {/* Seguimiento mensual */}
                          {ps.length > 0 && (
                            <div>
                              <div className="flex items-center justify-between mb-2.5">
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Pagos mensuales</p>
                                <button
                                  onClick={() => setModalPago({ puesto: c.puesto, periodo: hoyP, contrato: c })}
                                  className="text-xs px-3 py-1.5 bg-[#0d1f3c] text-white rounded-lg font-medium hover:bg-[#1a3358] transition-colors"
                                >+ Registrar pago</button>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {ps.map((per) => {
                                  const p = pagosPorPeriodo[per];
                                  const esHoy = per === hoyP;
                                  const esVencido = per < hoyP && !p;
                                  return (
                                    <button key={per}
                                      onClick={() => setModalPago({ puesto: c.puesto, periodo: per, pago: p, contrato: c })}
                                      className={`flex flex-col items-center px-3 py-2 rounded-xl border text-center min-w-[62px] transition-all ${
                                        p        ? "bg-green-50 border-green-200 hover:border-green-400" :
                                        esVencido ? "bg-red-50 border-red-200 hover:border-red-300" :
                                        esHoy    ? "bg-amber-50 border-amber-300" :
                                                   "bg-white border-gray-200 hover:border-gray-300"
                                      }`}
                                    >
                                      <span className="text-[11px] font-semibold text-gray-700">{labelPeriodo(per)}</span>
                                      {p ? (
                                        <>
                                          <span className="text-[10px] text-green-600 font-bold">✓</span>
                                          <span className="text-[10px] text-green-600">{formatS(p.monto)}</span>
                                          {/* Botón recibo WA inline */}
                                          <span className="text-[9px] text-green-500 mt-0.5">📲</span>
                                        </>
                                      ) : esVencido ? (
                                        <span className="text-[10px] text-red-500 font-semibold">Pendiente</span>
                                      ) : esHoy ? (
                                        <span className="text-[10px] text-amber-600">← hoy</span>
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
                              onGuardar={(v) => updateDoc(doc(db, "contratos", c.puesto), { notas: v })}
                            />
                          </div>

                          <div className="flex justify-end">
                            <button onClick={() => eliminarContrato(c.puesto)}
                              className="text-xs text-gray-400 hover:text-red-500 transition-colors">
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

      {/* Modal editar/crear contrato */}
      {modalContrato && (
        <ModalContrato
          datos={modalContrato}
          esNuevo={esNuevo}
          guardando={guardando}
          onChange={(k, v) => setModalContrato((p) => p ? { ...p, [k]: v } : p)}
          onGuardar={guardarContrato}
          onCerrar={() => setModalContrato(null)}
        />
      )}

      {/* Modal registrar/editar pago */}
      {modalPago && (
        <ModalPago
          puesto={modalPago.puesto}
          periodo={modalPago.periodo}
          pagoExistente={modalPago.pago}
          contrato={modalPago.contrato}
          guardando={guardando}
          onGuardar={(datos) => guardarPago(modalPago.puesto, datos, modalPago.pago)}
          onEliminar={modalPago.pago ? () => eliminarPago(modalPago.puesto, modalPago.pago!) : undefined}
          onCerrar={() => setModalPago(null)}
        />
      )}
    </div>
  );
}

// ── Matriz mensual ────────────────────────────────────────────────────────────

function MatrizMensual({ contratos, onCeldaClick }: {
  contratos: (Contrato & { dias: number; tipo: FiltroEstado })[];
  onCeldaClick: (puesto: string, periodo: string, pago: Pago | undefined, c: Contrato) => void;
}) {
  const meses = periodosMeses(6); // últimos 6 meses incluyendo el actual
  const hoyP = periodoActual();

  if (contratos.length === 0) {
    return (
      <div className="text-center py-20 bg-white rounded-2xl border border-gray-200">
        <p className="text-4xl mb-3">📋</p>
        <p className="font-semibold text-gray-600">Sin contratos para mostrar</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 font-semibold text-gray-500 min-w-[160px] sticky left-0 bg-gray-50 z-10">
                Local / Locatario
              </th>
              {meses.map((m) => (
                <th key={m} className={`px-2 py-3 font-semibold text-center min-w-[80px] ${m === hoyP ? "text-[#0d1f3c]" : "text-gray-400"}`}>
                  <span className={`px-2 py-1 rounded-lg ${m === hoyP ? "bg-[#0d1f3c]/10 text-[#0d1f3c]" : ""}`}>
                    {labelPeriodo(m)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {contratos.map((c, idx) => {
              const pagosPorPeriodo: Record<string, Pago> = {};
              for (const p of (c.pagos ?? [])) pagosPorPeriodo[p.periodo] = p;
              const ps = new Set(generarPeriodos(c));

              return (
                <tr key={c.puesto} className={`border-b border-gray-100 ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/40"}`}>
                  <td className={`px-4 py-2.5 sticky left-0 z-10 ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/40"}`}>
                    <div className="flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.tipo === "vencido" ? "bg-red-500" : c.tipo === "proximo_7" ? "bg-amber-400" : c.tipo === "proximo_30" ? "bg-yellow-300" : "bg-green-400"}`} />
                      <div>
                        <p className="font-semibold text-gray-800">{c.locatario}</p>
                        <p className="text-[10px] text-gray-400 font-mono">{c.puesto}</p>
                      </div>
                    </div>
                  </td>
                  {meses.map((m) => {
                    const pago = pagosPorPeriodo[m];
                    const aplica = ps.has(m);
                    const esVencido = m < hoyP && !pago && aplica;
                    const esActual = m === hoyP && aplica;

                    return (
                      <td key={m} className="px-1 py-2 text-center">
                        {!aplica ? (
                          <span className="text-gray-200 text-base">—</span>
                        ) : (
                          <button
                            onClick={() => onCeldaClick(c.puesto, m, pago, c)}
                            className={`w-full py-1.5 rounded-lg font-semibold transition-all hover:ring-2 hover:ring-offset-1 ${
                              pago ? "bg-green-100 text-green-700 hover:ring-green-300" :
                              esVencido ? "bg-red-100 text-red-600 hover:ring-red-300" :
                              esActual ? "bg-amber-100 text-amber-700 hover:ring-amber-300" :
                              "bg-gray-100 text-gray-400 hover:ring-gray-300"
                            }`}
                          >
                            {pago ? `✓ ${formatS(pago.monto).replace("S/ ", "")}` :
                             esVencido ? "Pend." :
                             esActual ? "Hoy" : "—"}
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex gap-4 flex-wrap">
        {[
          { cls: "bg-green-100 text-green-700", label: "Pagado" },
          { cls: "bg-red-100 text-red-600", label: "Pendiente" },
          { cls: "bg-amber-100 text-amber-700", label: "Mes actual" },
          { cls: "bg-gray-100 text-gray-400", label: "No aplica" },
        ].map(({ cls, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${cls}`}>{label[0]}</span>
            <span className="text-[11px] text-gray-500">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Notas inline ──────────────────────────────────────────────────────────────

function NotasInline({ valor, onGuardar }: { valor: string; onGuardar: (v: string) => void }) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(valor);
  useEffect(() => { setTexto(valor); }, [valor]);
  return editando ? (
    <div className="flex gap-2">
      <textarea value={texto} onChange={(e) => setTexto(e.target.value)} autoFocus rows={2}
        className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d1f3c]/20 resize-none"
      />
      <div className="flex flex-col gap-1">
        <button onClick={() => { onGuardar(texto); setEditando(false); }}
          className="px-3 py-1.5 bg-[#0d1f3c] text-white text-xs rounded-lg">Guardar</button>
        <button onClick={() => { setTexto(valor); setEditando(false); }}
          className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs rounded-lg">Cancelar</button>
      </div>
    </div>
  ) : (
    <div onClick={() => setEditando(true)}
      className="w-full min-h-[36px] bg-white border border-dashed border-gray-200 rounded-xl px-3 py-2 text-sm cursor-text hover:border-gray-400 transition-colors">
      {valor || <span className="text-gray-300 italic">Clic para agregar notas…</span>}
    </div>
  );
}

// ── Modal contrato ────────────────────────────────────────────────────────────

function ModalContrato({ datos, esNuevo, guardando, onChange, onGuardar, onCerrar }: {
  datos: Partial<Contrato>; esNuevo: boolean; guardando: boolean;
  onChange: (k: string, v: string | number) => void;
  onGuardar: () => void; onCerrar: () => void;
}) {
  const inp = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d1f3c]/20 bg-white";
  const lbl = "text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block";
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/40" onClick={onCerrar} />
      <div className="relative ml-auto w-full max-w-lg bg-white h-full overflow-y-auto shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="font-bold text-gray-900 text-lg">{esNuevo ? "Nuevo contrato" : `Editar — ${datos.puesto}`}</h2>
          <button onClick={onCerrar} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 text-lg">✕</button>
        </div>
        <div className="flex-1 px-6 py-5 space-y-6">

          <Sec title="Identificación">
            <div className="grid grid-cols-2 gap-3">
              <div><label className={lbl}>Puesto / Local</label>
                <input value={datos.puesto ?? ""} onChange={(e) => onChange("puesto", e.target.value)} className={inp} placeholder="RF-102" disabled={!esNuevo} /></div>
              <div><label className={lbl}>Rubro</label>
                <input value={datos.rubro ?? ""} onChange={(e) => onChange("rubro", e.target.value)} className={inp} placeholder="EMBUTIDOS" /></div>
            </div>
            <div><label className={lbl}>Locatario / Razón Social</label>
              <input value={datos.locatario ?? ""} onChange={(e) => onChange("locatario", e.target.value)} className={inp} placeholder="Nombre completo" /></div>
          </Sec>

          <Sec title="Contrato">
            <div className="grid grid-cols-2 gap-3">
              <div><label className={lbl}>Tipo</label>
                <select value={datos.tipoContrato ?? "CONSTANTE"} onChange={(e) => onChange("tipoContrato", e.target.value)} className={inp}>
                  <option>CONSTANTE</option><option>VARIABLE</option>
                </select></div>
              <div><label className={lbl}>Estado</label>
                <select value={datos.estadoContrato ?? "activo"} onChange={(e) => onChange("estadoContrato", e.target.value)} className={inp}>
                  <option value="activo">Activo</option>
                  <option value="suspendido">Suspendido</option>
                  <option value="cancelado">Cancelado</option>
                </select></div>
              <div><label className={lbl}>Fecha inicio</label>
                <input value={datos.fechaInicio ?? ""} onChange={(e) => onChange("fechaInicio", e.target.value)} className={inp} placeholder="DD/MM/YYYY" /></div>
              <div><label className={lbl}>Fin de contrato</label>
                <input value={datos.finContrato ?? ""} onChange={(e) => onChange("finContrato", e.target.value)} className={inp} placeholder="DD/MM/YYYY" /></div>
              <div><label className={lbl}>Duración (meses)</label>
                <input type="number" value={datos.duracionMeses ?? ""} onChange={(e) => onChange("duracionMeses", Number(e.target.value))} className={inp} /></div>
              <div><label className={lbl}>Gracia (meses)</label>
                <input type="number" value={datos.graciaMeses ?? ""} onChange={(e) => onChange("graciaMeses", Number(e.target.value))} className={inp} /></div>
              <div className="col-span-2"><label className={lbl}>Inicio de pago</label>
                <input value={datos.inicioPago ?? ""} onChange={(e) => onChange("inicioPago", e.target.value)} className={inp} placeholder="DD/MM/YYYY" /></div>
            </div>
          </Sec>

          <Sec title="Económico">
            <div className="grid grid-cols-2 gap-3">
              <div><label className={lbl}>Monto mensual (S/.)</label>
                <input type="number" value={datos.montoMensual ?? ""} onChange={(e) => onChange("montoMensual", Number(e.target.value))} className={inp} placeholder="0.00" /></div>
              <div />
              <div><label className={lbl}>Garantía (S/.)</label>
                <input type="number" value={datos.garantia ?? ""} onChange={(e) => onChange("garantia", Number(e.target.value))} className={inp} placeholder="0.00" /></div>
              <div><label className={lbl}>Adelanto (S/.)</label>
                <input type="number" value={datos.adelanto ?? ""} onChange={(e) => onChange("adelanto", Number(e.target.value))} className={inp} placeholder="0.00" /></div>
            </div>
          </Sec>

          <Sec title="Notas">
            <textarea value={datos.notas ?? ""} onChange={(e) => onChange("notas", e.target.value)}
              className={`${inp} resize-none`} rows={3} placeholder="Observaciones internas…" />
          </Sec>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 sticky bottom-0 bg-white">
          <button onClick={onCerrar} className="flex-1 py-3 bg-gray-100 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-200 transition-colors">Cancelar</button>
          <button onClick={onGuardar} disabled={guardando}
            className="flex-1 py-3 bg-[#0d1f3c] text-white text-sm font-semibold rounded-xl hover:bg-[#1a3358] disabled:opacity-50 transition-colors">
            {guardando ? "Guardando…" : esNuevo ? "Crear contrato" : "Guardar cambios"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Sec({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-bold text-[#0d1f3c] uppercase tracking-wider mb-3 pb-2 border-b border-gray-100">{title}</p>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

// ── Modal pago ────────────────────────────────────────────────────────────────

function ModalPago({ puesto, periodo, pagoExistente, contrato, guardando, onGuardar, onEliminar, onCerrar }: {
  puesto: string; periodo: string; pagoExistente?: Pago; contrato?: Contrato; guardando: boolean;
  onGuardar: (d: Omit<Pago, "pagoId" | "puesto">) => void;
  onEliminar?: () => void; onCerrar: () => void;
}) {
  const [monto, setMonto] = useState(
    pagoExistente?.monto ? String(pagoExistente.monto) : (contrato?.montoMensual ? String(contrato.montoMensual) : "")
  );
  const [fechaPago, setFechaPago] = useState(
    pagoExistente?.fechaPago ?? new Date().toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" })
  );
  const [medio, setMedio] = useState<Pago["medio"]>(pagoExistente?.medio ?? "EFECTIVO");
  const [notas, setNotas] = useState(pagoExistente?.notas ?? "");
  const [periodoEdit, setPeriodoEdit] = useState(periodo);

  const inp = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d1f3c]/20 bg-white";
  const lbl = "text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block";

  const [y, m] = periodoEdit.split("-");
  const labelP = y && m ? new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("es-PE", { month: "long", year: "numeric" }) : periodoEdit;

  // Recibo WA para pago existente
  const reciboWAUrl = pagoExistente && contrato ? waRecibo(contrato, pagoExistente) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onCerrar} />
      <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-gray-900">{pagoExistente ? "Editar pago" : "Registrar pago"}</h3>
            <p className="text-xs text-gray-400 mt-0.5 capitalize">{puesto} · {labelP}</p>
          </div>
          <button onClick={onCerrar} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 text-lg">✕</button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div>
            <label className={lbl}>Período</label>
            <input type="month" value={periodoEdit} onChange={(e) => setPeriodoEdit(e.target.value)} className={inp} />
          </div>
          <div>
            <label className={lbl}>Monto (S/.)</label>
            <input type="number" value={monto} onChange={(e) => setMonto(e.target.value)}
              className={`${inp} text-xl font-bold`} placeholder="0.00" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Fecha de pago</label>
              <input value={fechaPago} onChange={(e) => setFechaPago(e.target.value)} className={inp} placeholder="DD/MM/YYYY" />
            </div>
            <div>
              <label className={lbl}>Medio de pago</label>
              <select value={medio} onChange={(e) => setMedio(e.target.value as Pago["medio"])} className={inp}>
                <option>EFECTIVO</option><option>YAPE</option><option>TRANSFERENCIA</option><option>PLIN</option>
              </select>
            </div>
          </div>
          <div>
            <label className={lbl}>Notas</label>
            <input value={notas} onChange={(e) => setNotas(e.target.value)} className={inp} placeholder="Observaciones…" />
          </div>
        </div>
        <div className="px-5 pb-5 space-y-2">
          <button
            onClick={() => onGuardar({ periodo: periodoEdit, monto: parseFloat(monto) || 0, fechaPago, medio, notas })}
            disabled={guardando || !monto}
            className="w-full py-3 bg-[#0d1f3c] text-white text-sm font-bold rounded-xl hover:bg-[#1a3358] disabled:opacity-50 transition-colors"
          >
            {guardando ? "Guardando…" : pagoExistente ? "Actualizar pago" : "Confirmar pago ✓"}
          </button>
          {/* Recibo WA para pago ya registrado */}
          {reciboWAUrl && (
            <a href={reciboWAUrl} target="_blank" rel="noreferrer"
              className="w-full py-2.5 text-sm font-semibold text-[#25d366] border border-[#25d366]/30 rounded-xl flex items-center justify-center gap-2 hover:bg-green-50 transition-colors">
              📲 Compartir recibo por WhatsApp
            </a>
          )}
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
