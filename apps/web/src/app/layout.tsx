import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Header } from "../components/common/Header";
import { MobileBottomNav } from "../components/common/MobileBottomNav";

export const metadata: Metadata = {
  title: "KMITL Flood Intelligence | Real-Time Situational Awareness",
  description: "Real-time flood situational awareness, crowdsourced reporting, and emergency assistance platform for KMITL and Lat Krabang district.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var theme = localStorage.getItem('kmitl_theme_v2');
                if (!theme) {
                  try { localStorage.removeItem('kmitl_theme'); } catch (_) {}
                  try { localStorage.setItem('kmitl_theme_v2', 'light'); } catch (_) {}
                  document.documentElement.classList.remove('dark');
                } else if (theme === 'dark') {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
              } catch (_) {}
            `,
          }}
        />
      </head>
      <body className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 antialiased selection:bg-blue-600 selection:text-white">
        <Header />
        <main className="flex-1 flex flex-col pb-16 sm:pb-0">{children}</main>
        <MobileBottomNav />
      </body>
    </html>
  );
}
