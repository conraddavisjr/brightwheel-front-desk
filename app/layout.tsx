import type { Metadata, Viewport } from "next";
import { Figtree } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui/Toast";
import { ServiceWorker } from "@/components/brand/ServiceWorker";
import { THEME_COLOR, themeInitScript } from "@/lib/client/theme";

const figtree = Figtree({ variable: "--font-figtree", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "brightwheel Front Desk", template: "%s · brightwheel Front Desk" },
  description: "An AI front desk for childcare centers: instant, trustworthy answers for families, and a knowledge base directors control.",
  applicationName: "Front Desk",
  manifest: "/manifest.webmanifest",
  icons: { icon: [{ url: "/icons/favicon-32.png", sizes: "32x32" }, { url: "/icons/icon.svg", type: "image/svg+xml" }], apple: "/icons/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "Front Desk", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Light by default; ThemeToggle swaps this when someone picks dark.
  themeColor: THEME_COLOR.light,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // The inline script may set data-theme before React hydrates.
    <html lang="en" className={`${figtree.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full">
        <ToastProvider>{children}</ToastProvider>
        <ServiceWorker />
      </body>
    </html>
  );
}
