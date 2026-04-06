"use client";

import Link from "next/link";
import { Shield } from "lucide-react";

export function NavLogo(): React.ReactNode {
  return (
    <Link
      href="/"
      className="flex items-center gap-2.5 group transition-colors"
    >
      <Shield className="h-4.5 w-4.5 text-[#8b5cf6] group-hover:text-[#a78bfa] transition-colors" />
      <span className="text-sm font-semibold uppercase tracking-[0.2em] text-[#fafafa] group-hover:text-[#f8fafc] transition-colors">
        Sentinel
      </span>
    </Link>
  );
}
