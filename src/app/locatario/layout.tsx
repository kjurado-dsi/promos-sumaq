"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Sidebar from "@/components/Sidebar";

export default function LocatarioLayout({ children }: { children: React.ReactNode }) {
  const { user, role, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && (!user || (role && role !== "locatario"))) {
      router.push("/");
    }
  }, [user, role, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  const BG = "https://lh3.googleusercontent.com/d/1RMvsoCts0Q6aamBZL6ft57x7S-o2CSLp";

  return (
    <div
      className="flex min-h-screen"
      style={{ backgroundImage: `url(${BG})`, backgroundSize: "cover", backgroundPosition: "center", backgroundAttachment: "fixed" }}
    >
      <div className="absolute inset-0 bg-white/85 pointer-events-none" style={{ position: "fixed" }} />
      <Sidebar />
      <main className="flex-1 overflow-auto pt-14 md:pt-0 relative">{children}</main>
    </div>
  );
}
