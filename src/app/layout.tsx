import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import BottomNav from "@/components/BottomNav";
import NotificationBell from "@/components/NotificationBell";
import { ToastProvider } from "@/components/ToastProvider";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AutoPulse — Контроль обслуживания автомобиля",
  description: "Цифровой бортовой журнал вашего автомобиля",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "AutoPulse",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ru"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-[#0a0a0c] text-neutral-100 flex flex-col md:flex-row">
        <ToastProvider>
          <ServiceWorkerRegister />
          <Sidebar />
          <div className="flex-1 flex flex-col md:pl-64 min-h-screen pb-16 md:pb-0">
            <header className="h-16 border-b border-neutral-900 bg-[#0c0c0e]/60 backdrop-blur-md sticky top-0 z-10 flex items-center justify-between px-4 md:px-8">
              <span className="text-sm font-bold tracking-tight text-neutral-400">
                Бортовой компьютер
              </span>
              <div className="flex items-center gap-4">
                <NotificationBell />
              </div>
            </header>
            <main className="flex-grow p-4 md:p-8 max-w-7xl w-full mx-auto">
              {children}
            </main>
          </div>
          <BottomNav />
        </ToastProvider>
      </body>
    </html>
  );
}
