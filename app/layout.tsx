// app/layout.tsx
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "../globals.css";

const inter = Inter({ subsets: ["latin"], display: "swap" });
import AuthProvider from "@/components/AuthProvider";
import Nav from "@/components/Nav.client";

// ⚠️ Gebruik de nieuwe footer uit /components/ui/Footer.tsx
import Footer from "@/components/ui/Footer";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://www.pharmgtn.com"),
  title: { default: "PharmGtN", template: "%s | PharmGtN" },
  description:
    "PharmaGtN helpt farma-fabrikanten hun gross-to-net en kortingsbeleid te optimaliseren.",
  icons: {
    icon: "/favicon.png",           // standaard favicon
    shortcut: "/favicon.png",       // fallback voor sommige browsers
    apple: "/apple-touch-icon.png", // voor iOS “op beginscherm”
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl" className={inter.className}>
      <body className="min-h-screen flex flex-col bg-white text-gray-900">
        <AuthProvider>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 bg-black text-white px-3 py-2 rounded"
          >
            Naar inhoud
          </a>

          <Nav />
          <main id="main" className="flex-1">
            {children}
          </main>

          {/* Nieuwe, professionele footer */}
          <Footer />
        </AuthProvider>
      </body>
    </html>
  );
}
