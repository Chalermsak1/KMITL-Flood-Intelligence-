import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Header } from "../components/common/Header";

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
    <html lang="th" className="dark">
      <body className="min-h-screen flex flex-col bg-background text-gray-100 antialiased selection:bg-primary-500 selection:text-white">
        <Header />
        <main className="flex-1 flex flex-col">{children}</main>
      </body>
    </html>
  );
}
