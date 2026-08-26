"use client";

import { useEffect, useState } from "react";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";

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

function estadoBadge(estado: string) {
  if (estado === "EN GRACIA") return "bg-amber-50 text-amber-700 border-amber-200";
  if (estado === "ACTIVO") return "bg-green-50 text-green-700 border-green-200";
  return "bg-gray-50 text-gray-500 border-gray-200";
}

function formatFecha(str: string) {
  if (!str) return "—";
  const [d, m, y] = str.split("/");
  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return `${parseInt(d)} ${meses[parseInt(m) - 1]} ${y}`;
}

export default function MiContratoPage() {
  const { user } = useAuth();
  const [contrato, setContrato] = useState<Contrato | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const userSnap = await getDoc(doc(db, "users", user.uid));
      const local = userSnap.data()?.local ?? "";
      if (!local) { setLoading(false); return; }
      const snap = await getDocs(query(collection(db, "contratos"), where("puesto", "==", local)));
      if (!snap.empty) setContrato({ id: snap.docs[0].id, ...snap.docs[0].data() } as Contrato);
      setLoading(false);
    })();
  }, [user]);

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  );

  if (!contrato) return (
    <div className="p-4 md:p-8 max-w-xl">
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Mi contrato</h1>
      <div className="text-center py-16 text-gray-400">
        <p className="text-4xl mb-3">📄</p>
        <p className="font-medium text-gray-500">No tienes un contrato registrado aún</p>
        <p className="text-sm text-gray-400 mt-1">Contacta a administración para más información.</p>
      </div>
    </div>
  );

  const hoy = new Date();
  const [di, mi, yi] = contrato.inicioPago.split("/").map(Number);
  const inicioPagoDate = new Date(yi, mi - 1, di);
  const enGracia = hoy < inicioPagoDate;
  const diasRestantes = Math.max(0, Math.ceil((inicioPagoDate.getTime() - hoy.getTime()) / 86400000));

  return (
    <div className="p-4 md:p-8 max-w-xl">
      <h1 className="text-2xl font-semibold text-gray-900 mb-1">Mi contrato</h1>
      <p className="text-sm text-gray-500 mb-6">Local {contrato.puesto} · {contrato.rubro}</p>

      {/* Estado */}
      <div className={`rounded-2xl border p-5 mb-5 ${estadoBadge(contrato.estado)}`}>
        <div className="flex items-center justify-between mb-3">
          <span className={`text-xs font-bold uppercase tracking-wide px-2 py-1 rounded-full border ${estadoBadge(contrato.estado)}`}>
            {contrato.estado}
          </span>
          <span className="text-xs text-gray-400">{contrato.tipoContrato}</span>
        </div>
        {enGracia && (
          <div>
            <p className="text-sm font-semibold mb-0.5">Período de gracia activo</p>
            <p className="text-xs opacity-80">Tu primer pago de alquiler inicia el <strong>{formatFecha(contrato.inicioPago)}</strong> — quedan {diasRestantes} días.</p>
          </div>
        )}
        {!enGracia && contrato.estado === "ACTIVO" && (
          <div>
            <p className="text-sm font-semibold mb-0.5">Contrato activo</p>
            <p className="text-xs opacity-80">Alquiler mensual vigente: <strong>S/ {contrato.rentaMensual.toFixed(2)}</strong></p>
          </div>
        )}
      </div>

      {/* Detalles del contrato */}
      <div className="bg-white border border-gray-200 rounded-2xl divide-y divide-gray-100 mb-5">
        <div className="flex justify-between items-center px-4 py-3">
          <span className="text-sm text-gray-500">Inicio de contrato</span>
          <span className="text-sm font-medium text-gray-900">{formatFecha(contrato.fechaInicio)}</span>
        </div>
        <div className="flex justify-between items-center px-4 py-3">
          <span className="text-sm text-gray-500">Duración</span>
          <span className="text-sm font-medium text-gray-900">{contrato.duracionMeses} meses</span>
        </div>
        <div className="flex justify-between items-center px-4 py-3">
          <span className="text-sm text-gray-500">Inicio de pagos</span>
          <span className="text-sm font-medium text-gray-900">{formatFecha(contrato.inicioPago)}</span>
        </div>
        <div className="flex justify-between items-center px-4 py-3">
          <span className="text-sm text-gray-500">Vencimiento</span>
          <span className="text-sm font-medium text-gray-900">{formatFecha(contrato.finContrato)}</span>
        </div>
        <div className="flex justify-between items-center px-4 py-3">
          <span className="text-sm text-gray-500">Renta mensual</span>
          <span className="text-sm font-semibold text-gray-900">S/ {contrato.rentaMensual.toFixed(2)}</span>
        </div>
        {contrato.tipoContrato === "VARIABLE" && contrato.rentaIncrementada && (
          <div className="flex justify-between items-center px-4 py-3 bg-amber-50">
            <span className="text-sm text-amber-700">Renta tras incremento</span>
            <span className="text-sm font-semibold text-amber-800">S/ {contrato.rentaIncrementada.toFixed(2)}</span>
          </div>
        )}
      </div>

      {/* Garantía */}
      <div className="bg-blue-50 border border-blue-100 rounded-2xl px-4 py-4 mb-5">
        <p className="text-xs text-blue-600 font-semibold uppercase tracking-wide mb-1">Garantía / adelanto registrado</p>
        <p className="text-2xl font-bold text-blue-800">S/ {contrato.saldoGarantia.toFixed(2)}</p>
        <p className="text-xs text-blue-500 mt-1">Este monto queda retenido hasta el término del contrato.</p>
      </div>

      {contrato.condicionIncremento && (
        <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-xs text-amber-700">
          📌 {contrato.condicionIncremento}
        </div>
      )}
    </div>
  );
}
