import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppShell } from "@/components/AppShell";
import { ThemeInit, themeScript } from "@/components/theme";
import { ToastHost } from "@/components/toast";
import { PWA } from "@/components/PWA";

export const metadata: Metadata = {
  title: "Cibo — Cucina intelligente",
  description:
    "Gestisci dispensa, scadenze, spesa, ricette e nutrizione. Mangia meglio, spendi meno, spreca zero.",
  applicationName: "Cibo",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Cibo" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f7f9" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0d10" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <ThemeInit />
        <PWA />
        <AppShell>{children}</AppShell>
        <ToastHost />
      </body>
    </html>
  );
}
