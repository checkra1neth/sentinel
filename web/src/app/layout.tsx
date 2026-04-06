import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "../components/providers";
import { ConnectButton } from "../components/connect-button";
import { NavLogo } from "../components/nav-logo";
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
  title: "Sentinel -- Security Oracle on X Layer",
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
      <body className="min-h-full flex flex-col bg-[#0a0e17] text-white">
        <Providers>
          <nav className="border-b border-slate-800/50 bg-[#0a0e17]/80 backdrop-blur-sm sticky top-0 z-50">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="flex h-14 items-center justify-between">
                <NavLogo />
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
