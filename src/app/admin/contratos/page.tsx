"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, addDoc, updateDoc, doc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface Contrato {
  id: string;
  puesto: string;
  rubro: string;
  locatarioNombre: string;
  tipoContrato: "CONSTANTE" | "VARIABLE";
  fechaInicio: string;
  duracionMeses: number;
  graciaMeses: number;
  inicioPago: string;
  finContrato: string;
  rentaMensual: number;
  rentaIncrementada?: number;
  estado: "EN GRACIA" | "ACTIVO" | "TRANSFERIDO";
  saldoGarantia: number;
  observaciones?: string;
  condicionIncremento?: string;
}

const ESTADOS = ["EN GRACIA", "ACTIVO", "TRANSFERIDO"] as const;

const CONTRATOS_INICIALES: Omit<Contrato, "id">[] = [
  { puesto: "CF-101", rubro: "HIGIENE", locatarioNombre: "Lisset Giovanna Fernández Ticona", tipoContrato: "CONSTANTE", fechaInicio: "26/05/2026", duracionMeses: 8, graciaMeses: 4, inicioPago: "26/09/2026", finContrato: "26/01/2027", rentaMensual: 200, estado: "EN GRACIA", saldoGarantia: 400 },
  { puesto: "FR-114", rubro: "VERDURA", locatarioNombre: "Yessenia Quichca Ticlla", tipoContrato: "VARIABLE", fechaInicio: "16/05/2026", duracionMeses: 12, graciaMeses: 4, inicioPago: "16/09/2026", finContrato: "16/05/2027", rentaMensual: 200, rentaIncrementada: 650, estado: "EN GRACIA", saldoGarantia: 400, condicionIncremento: "A PARTIR DEL 9.º MES" },
  { puesto: "CR-101", rubro: "CARNE", locatarioNombre: "Servicios Múltiples 3G Guadalupe García E.I.R.L.", tipoContrato: "VARIABLE", fechaInicio: "25/04/2026", duracionMeses: 12, graciaMeses: 4, inicioPago: "25/08/2026", finContrato: "25/04/2027", rentaMensual: 550, rentaIncrementada: 750, estado: "ACTIVO", saldoGarantia: 1100 },
  { puesto: "PO-111", rubro: "POLLO", locatarioNombre: "Luis Alberto Hichcas Huayhuarina", tipoContrato: "CONSTANTE", fechaInicio: "06/05/2026", duracionMeses: 12, graciaMeses: 4, inicioPago: "06/09/2026", finContrato: "06/05/2027", rentaMensual: 400, estado: "TRANSFERIDO", saldoGarantia: 50 },
  { puesto: "PO-112", rubro: "ABARROTES", locatarioNombre: "Roxana Claudet Valera Guerra", tipoContrato: "CONSTANTE", fechaInicio: "15/06/2026", duracionMeses: 6, graciaMeses: 4, inicioPago: "15/10/2026", finContrato: "15/12/2026", rentaMensual: 250, estado: "EN GRACIA", saldoGarantia: 500 },
  { puesto: "PM-209", rubro: "ROPA", locatarioNombre: "Leidy Lorena Blanco Soto", tipoContrato: "CONSTANTE", fechaInicio: "13/07/2026", duracionMeses: 8, graciaMeses: 4, inicioPago: "13/11/2026", finContrato: "13/03/2027", rentaMensual: 350, estado: "EN GRACIA", saldoGarantia: 700 },
  { puesto: "RF-109", rubro: "PESCADO", locatarioNombre: "Rosa", tipoContrato: "CONSTANTE", fechaInicio: "13/07/2026", duracionMeses: 4, graciaMeses: 4, inicioPago: "13/11/2026", finContrato: "13/11/2026", rentaMensual: 0, estado: "EN GRACIA", saldoGarantia: 0 },
  { puesto: "RF-108", rubro: "JUGUERIA", locatarioNombre: "Alisson Chino", tipoContrato: "CONSTANTE", fechaInicio: "14/08/2026", duracionMeses: 8, graciaMeses: 4, inicioPago: "04/08/2026", finContrato: "14/04/2027", rentaMensual: 350, estado: "ACTIVO", saldoGarantia: 700 },
  { puesto: "PL-101", rubro: "PLASTICOS", locatarioNombre: "Juan Gabriel", tipoContrato: "CONSTANTE", fechaInicio: "15/08/2026", duracionMeses: 8, graciaMeses: 4, inicioPago: "07/08/2026", finContrato: "15/04/2027", rentaMensual: 350, estado: "ACTIVO", saldoGarantia: 700 },
];

function estadoColor(estado: string) {
  if (estado === "EN GRACIA") return "bg-amber-50 text-amber-700";
  if (estado === "ACTIVO") return "bg-green-50 text-green-700";
  return "bg-gray-100 text-gray-500";
}

const EMPTY: Omit<Contrato, "id"> = {
  puesto: "", rubro: "", locatarioNombre: "", tipoContrato: "CONSTANTE",
  fechaInicio: "", duracionMeses: 12, graciaMeses: 4, inicioPago: "",
  finContrato: "", rentaMensual: 0, estado: "EN GRACIA", saldoGarantia: 0,
};

export default function ContratosPage() {
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<Partial<Contrato> | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [importDone, setImportDone] = useState(false);

  const cargar = async () => {
    const snap = await getDocs(collection(db, "contratos"));
    setContratos(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Contrato)));
    setLoading(false);
  };

  useEffect(() => { cargar(); }, []);

  const importarDatos = async () => {
    setImportando(true);
    for (const c of CONTRATOS_INICIALES) {
      await addDoc(collection(db, "contratos"), c);
    }
    setImportDone(true);
    setImportando(false);
    cargar();
  };

  const guardar = async () => {
    if (!modal) return;
    setGuardando(true);
    const { id, ...data } = modal as Contrato;
    if (id) {
      await updateDoc(doc(db, "contratos", id), data);
    } else {
      await addDoc(collection(db, "contratos"), data);
    }
    setModal(null);
    setGuardando(false);
    cargar();
  };

  const eliminar = async (id: string) => {
    if (!confirm("¿Eliminar este contrato?")) return;
    await deleteDoc(doc(db, "contratos", id));
    cargar();
  };

  const totalGarantias = contratos.filter(c => c.estado !== "TRANSFERIDO").reduce((s, c) => s + c.saldoGarantia, 0);
  const activos = contratos.filter(c => c.estado === "ACTIVO").length;
  const enGracia = contratos.filter(c => c.estado === "EN GRACIA").length;

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Contratos de alquiler</h1>
          <p className="text-sm text-gray-500 mt-0.5">{contratos.length} contratos registrados</p>
        </div>
        <div className="flex gap-2">
          {contratos.length === 0 && !importDone && (
            <button onClick={importarDatos} disabled={importando}
              className="text-sm px-4 py-2 border border-amber-300 text-amber-700 bg-amber-50 rounded-xl hover:bg-amber-100 disabled:opacity-50 transition-colors font-medium">
              {importando ? "Importando..." : "📥 Importar del Sheet"}
            </button>
          )}
          <button onClick={() => setModal({ ...EMPTY })}
            className="text-sm px-4 py-2 bg-[#0d1f3c] text-white rounded-xl hover:bg-[#1a3358] transition-colors font-medium">
            + Nuevo contrato
          </button>
        </div>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-green-50 border border-green-100 rounded-xl px-4 py-3">
          <p className="text-xs text-green-600 font-semibold uppercase tracking-wide">Activos</p>
          <p className="text-2xl font-bold text-green-800">{activos}</p>
        </div>
        <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
          <p className="text-xs text-amber-600 font-semibold uppercase tracking-wide">En gracia</p>
          <p className="text-2xl font-bold text-amber-800">{enGracia}</p>
        </div>
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
          <p className="text-xs text-blue-600 font-semibold uppercase tracking-wide">Total garantías</p>
          <p className="text-xl font-bold text-blue-800">S/ {totalGarantias.toLocaleString()}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : contratos.length === 0 ? (
        <div className="text-center py-16 text-gray-400 bg-white border border-gray-200 rounded-2xl">
          <p className="text-4xl mb-3">📄</p>
          <p className="font-medium text-gray-500">No hay contratos registrados</p>
          <p className="text-sm mt-1">Importa los datos del Sheet o crea uno manualmente.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {contratos.map((c) => (
            <div key={c.id} className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-4 flex-wrap">
              <div className="min-w-[70px]">
                <p className="text-sm font-bold text-[#0d1f3c]">{c.puesto}</p>
                <p className="text-xs text-gray-400">{c.rubro}</p>
              </div>
              <div className="flex-1 min-w-[160px]">
                <p className="text-sm font-medium text-gray-800 truncate">{c.locatarioNombre}</p>
                <p className="text-xs text-gray-400">{c.tipoContrato} · {c.duracionMeses} meses</p>
              </div>
              <div className="text-right min-w-[90px]">
                <p className="text-sm font-semibold text-gray-900">S/ {c.rentaMensual.toFixed(0)}/mes</p>
                <p className="text-xs text-gray-400">Garantía: S/ {c.saldoGarantia.toFixed(0)}</p>
              </div>
              <div>
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${estadoColor(c.estado)}`}>
                  {c.estado}
                </span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setModal(c)} className="text-xs text-blue-600 hover:underline">Editar</button>
                <button onClick={() => eliminar(c.id)} className="text-xs text-red-400 hover:underline">Eliminar</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal edición / nuevo */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">{(modal as Contrato).id ? "Editar contrato" : "Nuevo contrato"}</h2>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Puesto *</label>
                  <input value={modal.puesto ?? ""} onChange={e => setModal({ ...modal, puesto: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="CF-101" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Rubro</label>
                  <input value={modal.rubro ?? ""} onChange={e => setModal({ ...modal, rubro: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="VERDURA" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Locatario / Razón social *</label>
                <input value={modal.locatarioNombre ?? ""} onChange={e => setModal({ ...modal, locatarioNombre: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Tipo contrato</label>
                  <select value={modal.tipoContrato ?? "CONSTANTE"} onChange={e => setModal({ ...modal, tipoContrato: e.target.value as "CONSTANTE" | "VARIABLE" })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option>CONSTANTE</option>
                    <option>VARIABLE</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Estado</label>
                  <select value={modal.estado ?? "EN GRACIA"} onChange={e => setModal({ ...modal, estado: e.target.value as Contrato["estado"] })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {ESTADOS.map(e => <option key={e}>{e}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Duración (meses)</label>
                  <input type="number" value={modal.duracionMeses ?? 12} onChange={e => setModal({ ...modal, duracionMeses: +e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Gracia (meses)</label>
                  <input type="number" value={modal.graciaMeses ?? 4} onChange={e => setModal({ ...modal, graciaMeses: +e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Renta S/</label>
                  <input type="number" value={modal.rentaMensual ?? 0} onChange={e => setModal({ ...modal, rentaMensual: +e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              {modal.tipoContrato === "VARIABLE" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Renta tras incremento S/</label>
                    <input type="number" value={modal.rentaIncrementada ?? ""} onChange={e => setModal({ ...modal, rentaIncrementada: +e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Condición incremento</label>
                    <input value={modal.condicionIncremento ?? ""} onChange={e => setModal({ ...modal, condicionIncremento: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
              )}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Fecha inicio</label>
                  <input value={modal.fechaInicio ?? ""} onChange={e => setModal({ ...modal, fechaInicio: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="DD/MM/YYYY" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Inicio de pagos</label>
                  <input value={modal.inicioPago ?? ""} onChange={e => setModal({ ...modal, inicioPago: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="DD/MM/YYYY" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Fin contrato</label>
                  <input value={modal.finContrato ?? ""} onChange={e => setModal({ ...modal, finContrato: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="DD/MM/YYYY" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Garantía / Adelanto S/</label>
                <input type="number" value={modal.saldoGarantia ?? 0} onChange={e => setModal({ ...modal, saldoGarantia: +e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Observaciones</label>
                <textarea value={modal.observaciones ?? ""} onChange={e => setModal({ ...modal, observaciones: e.target.value })} rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={guardar} disabled={guardando}
                  className="flex-1 bg-[#0d1f3c] text-white font-semibold py-3 rounded-xl hover:bg-[#1a3358] disabled:opacity-50 transition-colors">
                  {guardando ? "Guardando..." : "Guardar"}
                </button>
                <button onClick={() => setModal(null)}
                  className="px-5 border border-gray-300 text-gray-600 rounded-xl hover:bg-gray-50 transition-colors">
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
