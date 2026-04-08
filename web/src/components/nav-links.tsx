"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/discover", label: "Discover" },
  { href: "/analyze", label: "Analyze" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/trade", label: "Trade" },
  { href: "/agents", label: "Agents" },
];

export function NavLinks(): React.ReactNode {
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-1">
      {LINKS.map((link) => {
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`px-3 py-1 text-xs font-medium transition-colors ${
              active
                ? "text-[#fafafa] bg-white/[0.06] rounded"
                : "text-[#a1a1aa] hover:text-[#fafafa]"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </div>
  );
}
