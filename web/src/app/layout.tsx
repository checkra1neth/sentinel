import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Providers } from "../components/providers";
import { NavLinks } from "../components/nav-links";
import { ConnectButton } from "../components/connect-button";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sentinel | Security Oracle",
  description: "Autonomous security oracle on X Layer. 3 AI agents scan, analyze, and invest.",
};

export default function RootLayout({ children }: { children: React.ReactNode }): React.ReactNode {
  return (
    <html lang="en" className={`dark ${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="bg-[#09090b] text-[#fafafa] font-sans antialiased">
        <Providers>
          <nav className="sticky top-0 z-50 bg-[#09090b]/80 backdrop-blur-sm border-b border-white/[0.06]">
            <div className="mx-auto max-w-[1400px] h-12 px-6 flex items-center justify-between">
              <span className="text-sm font-semibold tracking-wide">SENTINEL</span>
              <NavLinks />
              <ConnectButton />
            </div>
          </nav>
          <main>{children}</main>
        </Providers>
      </body>
    </html>
  );
}
