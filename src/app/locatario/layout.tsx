"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Sidebar from "@/components/Sidebar";

export default function LocatarioLayout({ children }: { children: React.ReactNode }) {
  const { user, role, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [perfilChecked, setPerfilChecked] = useState(false);

  useEffect(() => {
    if (!loading && (!user || (role && role !== "locatario"))) {
      router.push("/");
    }
  }, [user, role, loading, router]);

  useEffect(() => {
    if (loading || !user || pathname === "/locatario/perfil") {
      setPerfilChecked(true);
      return;
    }
    getDoc(doc(db, "users", user.uid)).then((snap) => {
      const d = snap.data();
      if (!d?.local || !d?.celular || !d?.nombreCompleto) {
        router.replace("/locatario/perfil");
      }
      setPerfilChecked(true);
    });
  }, [user, loading, pathname, router]);

  if (loading || !perfilChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  const BG = "https://lh3.googleusercontent.com/d/1RMvsoCts0Q6aamBZL6ft57x7S-o2CSLp";
  const bgStyle = {
    backgroundImage: `linear-gradient(rgba(255,255,255,0.93),rgba(255,255,255,0.93)),url(${BG})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundAttachment: "fixed",
  };

  return (
    <div className="flex min-h-screen bg-white">
      <Sidebar />
      <main className="flex-1 overflow-auto pt-14 md:pt-0" style={bgStyle}>{children}</main>
    </div>
  );
}
