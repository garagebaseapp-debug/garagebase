import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppLock } from "@/lib/app-lock";
import { GlobalTranslator } from "@/lib/i18n";
import { AppAnalytics } from "@/lib/app-analytics";
import { UserAdminControlsGate } from "@/lib/user-admin-controls";
import { BackupReminder } from "@/lib/backup-reminder";

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
        <UserAdminControlsGate />
        <BackupReminder />
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
            // Theme and language
            const n = JSON.parse(localStorage.getItem('garagebase_nastavitve') || '{}');
            if (n.jezik === 'en' || n.language === 'en') {
              document.getElementById('gb-html-root')?.setAttribute('lang', 'en');
            }
            if (n.tema === 'svetla') {
              document.documentElement.classList.add('light-mode');
            }
            // Keep the default app size stable, then allow one small and one large text step.
            const normalizeFont = (value, version) => {
              const explicitNewScale = Number(version) >= 2;
              if (value === 100) return explicitNewScale ? 100 : 140;
              if (value === 120 || value === 140 || value === 160 || value === 220 || value === 300) return value;
              if (value === 180) return 220;
              if (typeof value === 'number' && value <= 105) return 140;
              if (typeof value === 'number' && value < 130) return 120;
              if (typeof value === 'number' && value < 155) return 140;
              if (typeof value === 'number' && value < 175) return 160;
              if (typeof value === 'number' && value >= 260) return 300;
              if (typeof value === 'number') return 220;
              if (value === 'zelo-mala') return explicitNewScale ? 100 : 140;
              if (value === 'mala') return 120;
              if (value === 'velika') return 160;
              if (value === 'zelo-velika') return 220;
              if (value === 'extra-velika' || value === 'najvecja') return 300;
              return 140;
            };
            const nextFont = normalizeFont(n.pisava, n.fontPresetVersion);
            const rootPx = nextFont === 100 ? 14.5 : nextFont === 120 ? 15.25 : nextFont === 160 ? 16.75 : nextFont === 220 ? 19 : nextFont === 300 ? 22 : 16;
            document.documentElement.style.fontSize = rootPx + 'px';
            document.documentElement.style.setProperty('--gb-app-font-scale', '1');
            document.documentElement.style.setProperty('--gb-text-font-scale', String(rootPx / 16));
          } catch {
            // Ignore broken localStorage settings and load the app with defaults.
          }
        `}} />
      </body>
    </html>
  );
}
