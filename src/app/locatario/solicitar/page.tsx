"use client";

import { useEffect, useState } from "react";
import { collection, query, where, getDocs, addDoc, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Producto {
  id: string;
  nombre: string;
  tipo: string;
  descripcion?: string;
  fotoUrl?: string;
}

interface Perfil {
  nombreCompleto: string;
  celular: string;
  local: string;
  logoUrl?: string;
}

const DRAFT_KEY = "solicitar_draft";
const TOPE_SEMANAL = 10;

// Solo lunes (1) y jueves (4)
function esDiaHabil(): boolean {
  const dia = new Date().getDay();
  return dia === 1 || dia === 4;
}

function nombreDiaSiguiente(): string {
  const dia = new Date().getDay();
  if (dia < 1) return "el lunes";
  if (dia < 4) return "el jueves";
  return "el próximo lunes";
}

export default function SolicitarPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const hoy = new Date().toISOString().split("T")[0];
  const en6dias = new Date(Date.now() + 6 * 86400000).toISOString().split("T")[0];
  const [seleccionados, setSeleccionados] = useState<string[]>([]);
  const [precios, setPrecios] = useState<Record<string, { original: string; oferta: string }>>({});
  const [fechaInicio, setFechaInicio] = useState(hoy);
  const [fechaFin, setFechaFin] = useState(en6dias);
  const [nota, setNota] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [loadingProductos, setLoadingProductos] = useState(true);
  const [topeAlcanzado, setTopeAlcanzado] = useState(false);
  const [totalSemana, setTotalSemana] = useState(0);

  const diaHabil = true; // Primera etapa: habilitado todos los días

  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const d = JSON.parse(saved);
        if (d.seleccionados) setSeleccionados(d.seleccionados);
        if (d.precios) setPrecios(d.precios);
        if (d.nota) setNota(d.nota);
        if (d.fechaInicio) setFechaInicio(d.fechaInicio);
        if (d.fechaFin) setFechaFin(d.fechaFin);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ seleccionados, precios, nota, fechaInicio, fechaFin }));
    } catch { /* ignore */ }
  }, [seleccionados, precios, nota, fechaInicio, fechaFin]);

  const semanaActual = (() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    return Math.ceil(((now.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7);
  })();

  useEffect(() => {
    if (!user) return;
    getDocs(query(collection(db, "productos"), where("uid", "==", user.uid))).then((snap) => {
      setProductos(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Producto)));
      setLoadingProductos(false);
    });
    getDoc(doc(db, "users", user.uid)).then((snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setPerfil({
          nombreCompleto: d.nombreCompleto ?? user.displayName ?? "",
          celular: d.celular ?? "",
          local: d.local ?? "",
          logoUrl: d.logoUrl,
        });
      }
    });
    // Verificar tope semanal
    getDocs(query(collection(db, "solicitudes"), where("semana", "==", semanaActual))).then((snap) => {
      const total = snap.size;
      setTotalSemana(total);
      setTopeAlcanzado(total >= TOPE_SEMANAL);
    });
  }, [user]);

  const toggleProducto = (id: string) => {
    setSeleccionados((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 5 ? [...prev, id] : prev
    );
  };

  const setPrecio = (id: string, campo: "original" | "oferta", valor: string) => {
    setPrecios((prev) => ({
      ...prev,
      [id]: { ...prev[id], [campo]: valor },
    }));
  };

  const enviar = async () => {
    if (!user || seleccionados.length === 0 || !perfil?.local || !perfil?.celular) return;
    setEnviando(true);
    const prods = productos
      .filter((p) => seleccionados.includes(p.id))
      .map((p) => ({
        nombre: p.nombre,
        precio: parseFloat(precios[p.id]?.oferta ?? "0") || 0,
        precioOriginal: parseFloat(precios[p.id]?.original ?? "0") || 0,
        precioOferta: parseFloat(precios[p.id]?.oferta ?? "0") || 0,
        tipo: p.tipo,
        descripcion: p.descripcion ?? "",
        fotoUrl: p.fotoUrl ?? "",
      }));
    localStorage.removeItem(DRAFT_KEY);
    await addDoc(collection(db, "solicitudes"), {
      uid: user.uid,
      locatarioNombre: perfil.nombreCompleto,
      locatarioEmail: user.email,
      celular: perfil.celular,
      local: perfil.local,
      logoUrl: perfil.logoUrl ?? "",
      productos: prods,
      semana: semanaActual,
      fechaInicio,
      fechaFin,
      nota,
      estado: "pendiente",
      creadoEn: new Date(),
    });
    router.push("/locatario/solicitudes");
  };

  const perfilIncompleto = !perfil?.local || !perfil?.celular || !perfil?.nombreCompleto;
  const canSubmit = !enviando && seleccionados.length > 0 && !perfilIncompleto && !topeAlcanzado && diaHabil;

  // Bloqueo: día no hábil
  if (!diaHabil) {
    return (
      <div className="p-4 md:p-8 max-w-2xl">
        <h1 className="text-2xl font-semibold text-gray-900 mb-1">Solicitar promo</h1>
        <div className="mt-6 bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center space-y-3">
          <p className="text-4xl">📅</p>
          <p className="text-lg font-semibold text-amber-800">Hoy no es día de envío</p>
          <p className="text-sm text-amber-700">
            Las solicitudes se reciben <strong>los lunes y los jueves</strong>.<br />
            Vuelve {nombreDiaSiguiente()} para enviar tu promo.
          </p>
          <p className="text-xs text-amber-500 mt-2">
            Este horario nos ayuda a organizar mejor el trabajo de diseño para todos los locatarios.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <h1 className="text-2xl font-semibold text-gray-900 mb-1">Solicitar promo</h1>
      <p className="text-sm text-gray-500 mb-4">Semana {semanaActual} · Envíos: lunes y jueves · Máximo 5 productos</p>

      {/* Tope semanal alcanzado */}
      {topeAlcanzado && (
        <div className="mb-5 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          <p className="font-semibold">Cupo semanal completo</p>
          <p className="text-xs mt-0.5">Ya se recibieron {totalSemana} solicitudes esta semana (máximo {TOPE_SEMANAL}). Podrás enviar la próxima semana.</p>
        </div>
      )}

      {/* Aviso de promo relevante */}
      <div className="mb-5 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-xs text-blue-700">
        💡 <strong>Tip:</strong> Incluye productos con una <strong>promoción real y llamativa</strong> — descuentos, combos o precios especiales de la semana. Las promos relevantes generan más visitas a tu local.
      </div>

      {/* Resumen del perfil */}
      {perfil && (
        <div className={`rounded-xl border p-4 mb-5 flex items-center justify-between ${perfilIncompleto ? "bg-yellow-50 border-yellow-200" : "bg-gray-50 border-gray-200"}`}>
          <div className="flex items-center gap-3">
            {perfil.logoUrl && (
              <img src={perfil.logoUrl} alt="Logo" className="w-10 h-10 object-contain rounded-lg border border-gray-200 bg-white p-0.5" />
            )}
            <div>
              {perfilIncompleto ? (
                <p className="text-sm text-yellow-800 font-medium">Completa tu perfil antes de solicitar</p>
              ) : (
                <>
                  <p className="text-sm font-medium text-gray-800">{perfil.nombreCompleto} · Local {perfil.local}</p>
                  <p className="text-xs text-gray-500">{perfil.celular}</p>
                </>
              )}
            </div>
          </div>
          <Link href="/locatario/perfil" className="text-xs text-blue-600 hover:underline shrink-0">
            {perfilIncompleto ? "Completar perfil →" : "Editar"}
          </Link>
        </div>
      )}

      {/* Selección de productos con precio */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-700">Productos para esta semana *</label>
          <span className="text-xs text-gray-400">{seleccionados.length}/5 seleccionados</span>
        </div>

        {loadingProductos ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
          </div>
        ) : productos.length === 0 ? (
          <div className="text-center py-10 text-gray-400 bg-white border border-gray-200 rounded-xl">
            <p>No tienes productos en tu catálogo.</p>
            <Link href="/locatario/catalogo" className="text-blue-600 text-sm underline mt-1 inline-block">
              Agregar al catálogo
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {productos.map((p) => {
              const sel = seleccionados.includes(p.id);
              return (
                <div key={p.id} className={`rounded-xl border transition-all ${sel ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-white"}`}>
                  <button
                    onClick={() => toggleProducto(p.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left"
                  >
                    <div className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${sel ? "border-blue-500 bg-blue-500" : "border-gray-300"}`}>
                      {sel && <span className="text-white text-xs">✓</span>}
                    </div>
                    {p.fotoUrl && (
                      <img src={p.fotoUrl} alt={p.nombre} className="w-10 h-10 object-cover rounded-lg flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900">{p.nombre}</span>
                        <span className="text-xs text-gray-400 capitalize">{p.tipo}</span>
                      </div>
                      {p.descripcion && <p className="text-xs text-gray-400 truncate mt-0.5">{p.descripcion}</p>}
                    </div>
                  </button>

                  {sel && (
                    <div className="px-4 pb-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 w-28 shrink-0">Precio normal</span>
                        <div className="flex items-center gap-1 flex-1 border border-gray-300 rounded-lg px-3 py-2 bg-white">
                          <span className="text-xs text-gray-400">S/</span>
                          <input
                            type="number"
                            inputMode="decimal"
                            placeholder="0.00"
                            value={precios[p.id]?.original ?? ""}
                            onChange={(e) => setPrecio(p.id, "original", e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            className="flex-1 min-w-0 text-sm focus:outline-none bg-transparent"
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-red-500 font-semibold w-28 shrink-0">Precio oferta</span>
                        <div className="flex items-center gap-1 flex-1 border border-red-200 rounded-lg px-3 py-2 bg-red-50">
                          <span className="text-xs text-gray-400">S/</span>
                          <input
                            type="number"
                            inputMode="decimal"
                            placeholder="0.00"
                            value={precios[p.id]?.oferta ?? ""}
                            onChange={(e) => setPrecio(p.id, "oferta", e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            className="flex-1 min-w-0 text-sm focus:outline-none bg-transparent"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Fechas de la promoción */}
      <div className="mb-5">
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Duración de la promoción *</label>
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <label className="block text-xs text-gray-400 mb-1">Desde</label>
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <span className="text-gray-400 mt-4">→</span>
          <div className="flex-1">
            <label className="block text-xs text-gray-400 mb-1">Hasta</label>
            <input
              type="date"
              value={fechaFin}
              min={fechaInicio}
              onChange={(e) => setFechaFin(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Nota */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Beneficios o detalles especiales (opcional)
        </label>
        <textarea
          placeholder="Ej: Combo incluye bebida, válido solo fines de semana, producto fresco del día..."
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          rows={3}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>

      <button
        onClick={enviar}
        disabled={!canSubmit}
        className="w-full sm:w-auto bg-blue-600 text-white font-medium px-6 py-3 rounded-xl hover:bg-blue-700 disabled:opacity-40 transition-colors text-base"
      >
        {enviando ? "Enviando..." : "Enviar solicitud"}
      </button>

      {perfilIncompleto && (
        <p className="text-xs text-yellow-700 mt-2">Completa tu perfil para poder enviar solicitudes</p>
      )}
    </div>
  );
}
