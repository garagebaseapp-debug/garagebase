import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppLock } from "@/lib/app-lock";
import { GlobalTranslator } from "@/lib/i18n";
import { AppAnalytics } from "@/lib/app-analytics";

export const metadata: Metadata = {
  title: "GarageBase",
  description: "Tvoja avto evidenca - vse na enem mestu. Your vehicle records - all in one place.",
  metadataBase: new URL("https://getgaragebase.com"),
  manifest: "/manifest.json",
  openGraph: {
    title: "GarageBase",
    description: "Tvoja avto evidenca - vse na enem mestu. Your vehicle records - all in one place.",
    url: "https://getgaragebase.com",
    siteName: "GarageBase",
    images: [
      {
        url: "/android-chrome-512x512.png",
        width: 512,
        height: 512,
        alt: "GarageBase",
      },
    ],
    locale: "sl_SI",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "GarageBase",
    description: "Tvoja avto evidenca - vse na enem mestu. Your vehicle records - all in one place.",
    images: ["/android-chrome-512x512.png"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "GarageBase",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#6c63ff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="sl"
      id="gb-html-root"
      className="h-full antialiased"
    >
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/android-chrome-192x192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
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
          
          try {
            // Theme, language and app font size
            const n = JSON.parse(localStorage.getItem('garagebase_nastavitve') || '{}');
            if (n.jezik === 'en' || n.language === 'en') {
              document.getElementById('gb-html-root')?.setAttribute('lang', 'en');
            }
            const publicFontPaths = new Set(['/', '/login', '/registracija']);
            const shouldUseAppFont = !publicFontPaths.has(window.location.pathname);
            if (n.tema === 'svetla') {
              document.documentElement.classList.add('light-mode');
            }
            if (shouldUseAppFont) {
              const legacy = { mala: 100, normalna: 140, srednja: 140, velika: 230 };
              const raw = n.pisava ?? 'srednja';
              const parsedPercent = typeof raw === 'number' ? raw : (legacy[raw] || 140);
              const percent = parsedPercent <= 105 ? 100 : parsedPercent <= 190 ? 140 : 230;
              document.documentElement.style.fontSize = '';
              document.documentElement.style.setProperty('--gb-app-font-scale', '1');
              document.documentElement.style.setProperty('--gb-text-font-scale', String(percent / 100));
            } else if (!shouldUseAppFont) {
              document.documentElement.style.fontSize = '';
              document.documentElement.style.setProperty('--gb-app-font-scale', '1');
              document.documentElement.style.setProperty('--gb-text-font-scale', '1');
            }
          } catch {
            // Ignore broken localStorage settings and load the app with defaults.
          }
        `}} />
      </body>
    </html>
  );
}
