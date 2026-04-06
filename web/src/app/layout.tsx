import type { Metadata } from "next";
import { Providers } from "../components/providers";
import { ConnectButton } from "../components/connect-button";
import { NavLogo } from "../components/nav-logo";
import { NavLinks } from "../components/nav-links";
import "./globals.css";

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
    <html lang="en" className="h-full antialiased dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Space+Grotesk:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col bg-[#09090b] text-[#fafafa]">
        <Providers>
          <nav className="sticky top-0 z-50 bg-[#09090b]/90 backdrop-blur-sm">
            <div className="mx-auto max-w-[1400px] px-6 lg:px-10">
              <div className="flex h-14 items-center justify-between">
                <div className="flex items-center gap-6">
                  <NavLogo />
                  <NavLinks />
                </div>
                <ConnectButton />
              </div>
            </div>
            {/* Subtle gradient line instead of solid border */}
            <div
              className="h-px"
              style={{
                background:
                  "linear-gradient(90deg, transparent, #27272a 20%, #8b5cf6 50%, #27272a 80%, transparent)",
              }}
            />
          </nav>
          <main className="flex-1">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
