"use client";

import { useAuth } from "@/lib/auth-context";
import Link from "next/link";

export default function LocatarioHome() {
  const { user } = useAuth();

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-semibold text-gray-900">
        Hola, {user?.displayName?.split(" ")[0]} 👋
      </h1>
      <p className="text-gray-500 mt-1 mb-8">¿Qué quieres hacer hoy?</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          href="/locatario/solicitar"
          className="bg-white border border-gray-200 rounded-xl p-6 hover:border-blue-300 hover:shadow-sm transition-all group"
        >
          <div className="text-3xl mb-3">📤</div>
          <h2 className="font-semibold text-gray-900 group-hover:text-blue-700">Solicitar promo</h2>
          <p className="text-sm text-gray-500 mt-1">Elige productos de tu catálogo para esta semana</p>
        </Link>

        <Link
          href="/locatario/catalogo"
          className="bg-white border border-gray-200 rounded-xl p-6 hover:border-blue-300 hover:shadow-sm transition-all group"
        >
          <div className="text-3xl mb-3">📦</div>
          <h2 className="font-semibold text-gray-900 group-hover:text-blue-700">Mi catálogo</h2>
          <p className="text-sm text-gray-500 mt-1">Agrega y edita tus productos o servicios</p>
        </Link>

        <Link
          href="/locatario/solicitudes"
          className="bg-white border border-gray-200 rounded-xl p-6 hover:border-blue-300 hover:shadow-sm transition-all group"
        >
          <div className="text-3xl mb-3">🕐</div>
          <h2 className="font-semibold text-gray-900 group-hover:text-blue-700">Mis solicitudes</h2>
          <p className="text-sm text-gray-500 mt-1">Revisa el estado de tus promos enviadas</p>
        </Link>
      </div>
    </div>
  );
}
