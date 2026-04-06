"use client";

import Link from "next/link";
import { Shield } from "lucide-react";

export function NavLogo(): React.ReactNode {
  return (
    <Link
      href="/"
      className="flex items-center gap-2 text-emerald-400 hover:text-emerald-300 transition-colors"
    >
      <Shield className="h-5 w-5" />
      <span className="text-lg font-bold tracking-tight">Sentinel</span>
    </Link>
  );
}
