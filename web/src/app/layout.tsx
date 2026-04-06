import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { Providers } from "../components/providers";
import { ConnectButton } from "../components/connect-button";
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
  title: "Sentinel — Security Oracle on X Layer",
  description:
    "Autonomous AI agents scan, analyze, and protect liquidity on X Layer.",
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
                  {"\uD83D\uDEE1\uFE0F"} Sentinel
                </Link>
                <div className="flex items-center gap-6">
                  <ConnectButton />
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
