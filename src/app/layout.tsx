import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppLock } from "@/lib/app-lock";
import { GlobalTranslator } from "@/lib/i18n";
import { AppAnalytics } from "@/lib/app-analytics";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GarageBase",
  description: "Tvoja avto evidenca - vse na enem mestu",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "GarageBase",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="sl"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/android-chrome-192x192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="theme-color" content="#6c63ff" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        <AppAnalytics />
        <AppLock />
        <GlobalTranslator />
        <div id="offline-banner" className="hidden fixed top-0 left-0 right-0 bg-[#ef4444] text-white text-center text-xs py-2 z-[100]">
          Ni internetne povezave - vnosi niso mogoci
        </div>
        <script dangerouslySetInnerHTML={{__html: `
          // Offline detection
          window.addEventListener('online', () => document.getElementById('offline-banner').classList.add('hidden'));
          window.addEventListener('offline', () => document.getElementById('offline-banner').classList.remove('hidden'));
          
          // Theme and app font size
          const nastavitve = localStorage.getItem('garagebase_nastavitve');
          if (nastavitve) {
            const n = JSON.parse(nastavitve);
            if (n.tema === 'svetla') {
              document.documentElement.classList.add('light-mode');
            }
            if (n.pisava) {
              const legacy = { mala: 90, normalna: 100, velika: 120 };
              const raw = n.pisava;
              const parsedPercent = typeof raw === 'number' ? raw : (legacy[raw] || 100);
              const percent = Math.min(300, Math.max(85, parsedPercent));
              const rootPx = Math.min(48, Math.max(14, 16 * (percent / 100)));
              document.documentElement.style.fontSize = rootPx + 'px';
              document.documentElement.style.setProperty('--gb-app-font-scale', String(percent / 100));
            }
          }
        `}} />
      </body>
    </html>
  );
}
