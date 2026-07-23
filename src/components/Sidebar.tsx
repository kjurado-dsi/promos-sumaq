"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

interface NavItem {
  label: string;
  href: string;
  icon: string;
}

const navByRole: Record<string, NavItem[]> = {
  locatario: [
    { label: "Inicio", href: "/locatario", icon: "🏠" },
    { label: "Mi catálogo", href: "/locatario/catalogo", icon: "📦" },
    { label: "Solicitar promo", href: "/locatario/solicitar", icon: "📤" },
    { label: "Mis solicitudes", href: "/locatario/solicitudes", icon: "🕐" },
    { label: "Mi perfil", href: "/locatario/perfil", icon: "👤" },
  ],
  marketing: [
    { label: "Panel", href: "/marketing/panel", icon: "📊" },
    { label: "Cola de trabajo", href: "/marketing", icon: "📋" },
    { label: "Publicadas", href: "/marketing/publicadas", icon: "✅" },
    { label: "Catálogos", href: "/marketing/catalogos", icon: "📦" },
  ],
  admin: [
    { label: "Dashboard", href: "/admin", icon: "📊" },
    { label: "Locatarios", href: "/admin/locatarios", icon: "👥" },
    { label: "Solicitudes", href: "/admin/solicitudes", icon: "📋" },
  ],
};

export default function Sidebar() {
  const { user, role, logOut, switchRole } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const items = navByRole[role ?? "locatario"] ?? [];

  // Recuerda el rol original de la sesión (antes de cualquier cambio de vista rápida)
  const originalRole = useRef<string | null>(null);
  useEffect(() => {
    if (role && originalRole.current === null) {
      originalRole.current = role;
    }
  }, [role]);

  const canSwitch = originalRole.current === "admin";

  const handleSwitchRole = async (newRole: "admin" | "marketing" | "locatario") => {
    await switchRole(newRole);
    const dest = newRole === "admin" ? "/admin" : newRole === "marketing" ? "/marketing" : "/locatario";
    router.push(dest);
  };

  return (
    <aside className="w-52 min-h-screen bg-white border-r border-gray-200 flex flex-col">
      <div className="px-4 py-5 border-b border-gray-100">
        <p className="text-base font-bold text-gray-900">Sumaq Mercados</p>
        <p className="text-xs text-gray-400 mt-0.5">DS Inmobiliario · Promos</p>
      </div>

      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {items.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                active
                  ? "bg-blue-50 text-blue-700 font-medium"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-gray-100">
        <div className="flex items-center gap-2.5 px-2 py-1.5 mb-2">
          {user?.photoURL ? (
            <img src={user.photoURL} alt="" className="w-7 h-7 rounded-full" />
          ) : (
            <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-xs font-medium text-blue-700">
              {user?.displayName?.[0] ?? "U"}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-xs font-medium text-gray-900 truncate">{user?.displayName}</p>
            <p className="text-xs text-gray-400 capitalize">{role}</p>
          </div>
        </div>

        {canSwitch && (
          <div className="mb-2">
            <p className="text-xs text-gray-400 px-2 mb-1">Vista rápida</p>
            <div className="flex gap-1">
              {(["admin", "marketing", "locatario"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => handleSwitchRole(r)}
                  className={`flex-1 text-xs py-1 rounded-md border transition-colors ${
                    role === r
                      ? "bg-blue-600 text-white border-blue-600"
                      : "border-gray-200 text-gray-500 hover:bg-gray-50"
                  }`}
                >
                  {r === "admin" ? "Adm" : r === "marketing" ? "Mkt" : "Loc"}
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={logOut}
          className="w-full text-left px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
        >
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
