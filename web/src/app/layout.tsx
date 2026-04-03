import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { Providers } from "../components/providers";
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
  title: "Agentra — Agent Marketplace on X Layer",
  description:
    "Autonomous AI agent marketplace with x402 micropayments and on-chain yield on X Layer.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): React.ReactNode {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-gray-950 text-white">
        <Providers>
          <nav className="border-b border-gray-800 bg-gray-950/80 backdrop-blur-sm sticky top-0 z-50">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="flex h-16 items-center justify-between">
                <Link
                  href="/"
                  className="text-xl font-bold text-emerald-400 tracking-tight"
                >
                  Agentra
                </Link>
                <div className="flex items-center gap-6">
                  <Link
                    href="/marketplace"
                    className="text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    Marketplace
                  </Link>
                  <Link
                    href="/dashboard"
                    className="text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    Dashboard
                  </Link>
                </div>
              </div>
            </div>
          </nav>
          <main className="flex-1">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
