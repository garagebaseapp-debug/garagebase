import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

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
  description: "Tvoja avto evidenca — vse na enem mestu",
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
        <div id="offline-banner" className="hidden fixed top-0 left-0 right-0 bg-[#ef4444] text-white text-center text-xs py-2 z-[100]">
          ⚠️ Ni internetne povezave — vnosi niso mogoči
        </div>
        <script dangerouslySetInnerHTML={{__html: `
          // Offline detekcija
          window.addEventListener('online', () => document.getElementById('offline-banner').classList.add('hidden'));
          window.addEventListener('offline', () => document.getElementById('offline-banner').classList.remove('hidden'));
          
          // Dark/Light mode + Velikost pisave
          const nastavitve = localStorage.getItem('garagebase_nastavitve');
          if (nastavitve) {
            const n = JSON.parse(nastavitve);
            if (n.tema === 'svetla') {
              document.documentElement.classList.add('light-mode');
            }
            const velikosti = { mala: '16px', normalna: '19px', velika: '22px' };
            if (n.pisava && velikosti[n.pisava]) {
              document.documentElement.style.fontSize = velikosti[n.pisava];
            }
          }
        `}} />
      </body>
    </html>
  );
}