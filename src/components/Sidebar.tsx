"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
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
  const [open, setOpen] = useState(false);
  const items = navByRole[role ?? "locatario"] ?? [];

  const originalRole = useRef<string | null>(null);
  useEffect(() => {
    if (role && originalRole.current === null) {
      originalRole.current = role;
    }
  }, [role]);

  // Close drawer on route change
  useEffect(() => { setOpen(false); }, [pathname]);

  const canSwitch = originalRole.current === "admin";

  const handleSwitchRole = async (newRole: "admin" | "marketing" | "locatario") => {
    await switchRole(newRole);
    const dest = newRole === "admin" ? "/admin" : newRole === "marketing" ? "/marketing" : "/locatario";
    router.push(dest);
  };

  const currentItem = items.find((i) => i.href === pathname);

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="px-4 py-5 border-b border-gray-100">
        <p className="text-base font-bold text-gray-900">Sumaq Mercados</p>
        <p className="text-xs text-gray-400 mt-0.5">DS Inmobiliario · Promos</p>
      </div>

      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {items.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors ${
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
                  className={`flex-1 text-xs py-1.5 rounded-md border transition-colors ${
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
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-52 min-h-screen bg-white border-r border-gray-200 flex-col flex-shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b border-gray-200 flex items-center justify-between px-4 h-14">
        <div>
          <p className="text-sm font-bold text-gray-900 leading-tight">Sumaq Mercados</p>
          <p className="text-xs text-gray-400 leading-tight">{currentItem?.label ?? "DS Inmobiliario"}</p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
          aria-label="Abrir menú"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <rect x="2" y="5" width="16" height="1.5" rx="0.75" fill="#374151" />
            <rect x="2" y="9.25" width="16" height="1.5" rx="0.75" fill="#374151" />
            <rect x="2" y="13.5" width="16" height="1.5" rx="0.75" fill="#374151" />
          </svg>
        </button>
      </div>

      {/* Mobile drawer overlay */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />
          <div className="relative w-64 max-w-[80vw] bg-white h-full shadow-xl flex flex-col">
            <div className="flex items-center justify-between px-4 h-14 border-b border-gray-100 flex-shrink-0">
              <p className="text-sm font-bold text-gray-900">Menú</p>
              <button
                onClick={() => setOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <SidebarContent />
            </div>
          </div>
        </div>
      )}

      {/* Mobile spacer so content doesn't hide under top bar */}
      <div className="md:hidden h-14 flex-shrink-0" />
    </>
  );
}
