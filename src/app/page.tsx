"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

const BG = "https://lh3.googleusercontent.com/d/1RMvsoCts0Q6aamBZL6ft57x7S-o2CSLp";
const LOGO = "https://lh3.googleusercontent.com/d/1805yoxKxdQRbWqmeCQ8abT7Efl7F-rgP";
const PATTERN = "https://lh3.googleusercontent.com/d/1Aq8I1TmiNoVZjLjIEoQ8nnuewMbLvA1B";

export default function Home() {
  const { user, role, loading, signIn } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user && role) {
      if (role === "admin") router.push("/admin");
      else if (role === "marketing") router.push("/marketing");
      else router.push("/locatario");
    }
  }, [user, role, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0d1f3c]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden"
      style={{
        backgroundImage: `url(${BG})`,
        backgroundSize: "cover",
        backgroundPosition: "center top",
      }}
    >
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-[#0d1f3c]/55" />

      {/* Pattern strip top */}
      <div
        className="absolute top-0 left-0 right-0 h-24 md:h-32"
        style={{ backgroundImage: `url(${PATTERN})`, backgroundSize: "auto 100%", backgroundRepeat: "repeat-x" }}
      />

      {/* Pattern strip bottom */}
      <div
        className="absolute bottom-0 left-0 right-0 h-24 md:h-32"
        style={{ backgroundImage: `url(${PATTERN})`, backgroundSize: "auto 100%", backgroundRepeat: "repeat-x" }}
      />

      {/* Card */}
      <div className="relative z-10 w-full max-w-sm mx-4">
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl overflow-hidden">
          <div className="p-8 flex flex-col items-center gap-6">
            {/* Logo */}
            <img
              src={LOGO}
              alt="Sumaq Mercados"
              className="w-28 h-28 object-contain rounded-xl"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />

            <div className="text-center">
              <h1 className="text-xl font-bold text-[#0d1f3c]">Sumaq Mercados</h1>
              <p className="text-xs text-[#c85c2d] font-semibold uppercase tracking-widest mt-0.5">
                El mercado más moderno del Perú
              </p>
              <p className="text-sm text-gray-500 mt-2">Plataforma de promociones</p>
            </div>

            <button
              onClick={signIn}
              className="w-full flex items-center justify-center gap-3 border border-gray-300 rounded-xl px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 18 18">
                <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
                <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"/>
                <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
                <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
              </svg>
              Ingresar con Google
            </button>

            <p className="text-xs text-gray-400 text-center">
              Solo para locatarios y equipo de Sumaq Mercados
            </p>
          </div>

        </div>

        {/* Footer */}
        <p className="text-center text-white/50 text-xs mt-4">
          Desarrollado y diseñado por Operaciones-Sumaq
        </p>
      </div>
    </div>
  );
}
