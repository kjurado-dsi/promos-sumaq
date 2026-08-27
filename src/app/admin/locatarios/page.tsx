"use client";

import { useEffect, useState } from "react";
import {
  collection, onSnapshot, query, orderBy, doc, updateDoc,
  setDoc, deleteDoc, getDoc
} from "firebase/firestore";
import { db } from "@/lib/firebase";

interface Usuario {
  id: string;
  name: string;
  email: string;
  role: string;
  local?: string;
  photo?: string;
  createdAt?: { seconds: number };
}

interface EmailAutorizado {
  id: string; // email como ID
  role: string;
}

const ROLES = ["locatario", "marketing", "admin"];
const ROLE_COLORS: Record<string, string> = {
  admin: "bg-purple-100 text-purple-700 border-purple-200",
  marketing: "bg-blue-100 text-blue-700 border-blue-200",
  locatario: "bg-gray-100 text-gray-600 border-gray-200",
};

export default function LocatariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [emailsAutorizados, setEmailsAutorizados] = useState<EmailAutorizado[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [loading, setLoading] = useState(true);
  // Form nuevo email autorizado
  const [nuevoEmail, setNuevoEmail] = useState("");
  const [nuevoRol, setNuevoRol] = useState("marketing");
  const [agregando, setAgregando] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "users"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setUsuarios(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Usuario)));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "allowed_roles"), (snap) => {
      setEmailsAutorizados(snap.docs.map((d) => ({ id: d.id, role: d.data().role } as EmailAutorizado)));
    });
    return () => unsub();
  }, []);

  const cambiarRol = async (id: string, role: string) => {
    await updateDoc(doc(db, "users", id), { role });
  };

  const agregarEmail = async () => {
    if (!nuevoEmail.trim()) return;
    setAgregando(true);
    await setDoc(doc(db, "allowed_roles", nuevoEmail.trim().toLowerCase()), { role: nuevoRol });
    setNuevoEmail("");
    setAgregando(false);
  };

  const eliminarEmail = async (email: string) => {
    await deleteDoc(doc(db, "allowed_roles", email));
  };

  const usuariosFiltrados = usuarios.filter((u) =>
    !busqueda || u.name?.toLowerCase().includes(busqueda.toLowerCase()) || u.email?.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Gestión de usuarios</h1>

      {/* Emails autorizados */}
      <div className="bg-white border border-gray-200 rounded-xl mb-6">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-800">Emails pre-autorizados</h2>
          <p className="text-xs text-gray-400 mt-0.5">Cuando estas personas ingresen por primera vez, recibirán el rol asignado automáticamente</p>
        </div>
        <div className="p-5">
          {/* Formulario agregar */}
          <div className="flex flex-col sm:flex-row gap-2 mb-4">
            <input
              type="email"
              placeholder="correo@empresa.com"
              value={nuevoEmail}
              onChange={(e) => setNuevoEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && agregarEmail()}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex gap-2">
              <select
                value={nuevoRol}
                onChange={(e) => setNuevoRol(e.target.value)}
                className="flex-1 sm:flex-none border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none bg-white"
              >
                <option value="marketing">Marketing</option>
                <option value="admin">Admin</option>
                <option value="locatario">Locatario</option>
              </select>
              <button
                onClick={agregarEmail}
                disabled={agregando || !nuevoEmail.trim()}
                className="bg-blue-600 text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors whitespace-nowrap"
              >
                + Agregar
              </button>
            </div>
          </div>

          {emailsAutorizados.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-3">No hay emails pre-autorizados</p>
          ) : (
            <div className="space-y-1.5">
              {emailsAutorizados.map((e) => (
                <div key={e.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border capitalize ${ROLE_COLORS[e.role] ?? ROLE_COLORS.locatario}`}>
                      {e.role}
                    </span>
                    <span className="text-sm text-gray-700">{e.id}</span>
                  </div>
                  <button
                    onClick={() => eliminarEmail(e.id)}
                    className="text-gray-300 hover:text-red-500 transition-colors text-lg leading-none"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Usuarios registrados */}
      <div className="bg-white border border-gray-200 rounded-xl">
        <div className="px-4 py-3 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center gap-2">
          <h2 className="text-sm font-semibold text-gray-800 flex-1">Usuarios registrados</h2>
          <input
            placeholder="Buscar..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full sm:w-56 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : usuariosFiltrados.length === 0 ? (
          <p className="text-center py-10 text-gray-400 text-sm">Sin resultados</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {usuariosFiltrados.map((u) => {
              const fecha = u.createdAt
                ? new Date(u.createdAt.seconds * 1000).toLocaleDateString("es-PE", { day: "numeric", month: "short", year: "numeric" })
                : "—";
              return (
                <div key={u.id} className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50">
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-medium text-gray-600 flex-shrink-0 overflow-hidden">
                    {u.photo
                      ? <img src={u.photo} alt={u.name} className="w-full h-full object-cover" />
                      : (u.name?.[0] ?? "?")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900">{u.name ?? "Sin nombre"}</p>
                      {u.local && (
                        <span className="text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
                          Local {u.local}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400">{u.email} · Ingresó {fecha}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {ROLES.map((r) => (
                      <button
                        key={r}
                        onClick={() => cambiarRol(u.id, r)}
                        className={`text-xs px-2.5 py-1 rounded-lg border transition-colors capitalize ${
                          u.role === r
                            ? ROLE_COLORS[r]
                            : "border-gray-200 text-gray-400 hover:bg-gray-50"
                        }`}
                      >
                        {r === "locatario" ? "Loc" : r === "marketing" ? "Mkt" : "Adm"}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
