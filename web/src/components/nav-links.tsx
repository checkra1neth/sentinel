"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/feed", label: "Feed" },
  { href: "/portfolio", label: "Portfolio" },
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
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              active
                ? "text-[#fafafa] bg-[#27272a]"
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
