import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import IosInstallBanner from "@/components/IosInstallBanner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Control Operativo - Locales Sumaq",
  description: "Plataforma de gestión operativa para locatarios de Sumaq Mercados",
  manifest: "/manifest.json",
  themeColor: "#0d1f3c",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Sumaq Operativo",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${geistSans.variable} h-full antialiased`}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0d1f3c" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Sumaq Operativo" />
        <link rel="icon" href="https://lh3.googleusercontent.com/d/1W27Jd23pjCvkMfP7JA3Od0PcQ_1XzqPc" />
        <link rel="apple-touch-icon" href="https://lh3.googleusercontent.com/d/1W27Jd23pjCvkMfP7JA3Od0PcQ_1XzqPc" />
      </head>
      <body className="min-h-full flex flex-col">
        <AuthProvider>{children}</AuthProvider>
        <IosInstallBanner />
        <script
          dangerouslySetInnerHTML={{
            __html: `if('serviceWorker' in navigator){window.addEventListener('load',()=>{navigator.serviceWorker.register('/sw.js')})}`,
          }}
        />
      </body>
    </html>
  );
}
