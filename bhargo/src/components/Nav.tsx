"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Overview" },
  { href: "/compare", label: "Compare builds" },
  { href: "/purchases", label: "Materials" },
  { href: "/people", label: "People" },
  { href: "/payroll", label: "Wages" },
  { href: "/projects", label: "Builds" },
  { href: "/settings", label: "Settings" },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-line bg-card no-print">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center gap-1 h-14 overflow-x-auto">
        <Link href="/" className="font-semibold text-lg mr-4 shrink-0">
          Bhargo
        </Link>
        {LINKS.map((link) => {
          const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm px-3 py-1.5 rounded whitespace-nowrap transition-colors ${
                active ? "bg-brandsoft text-brand font-medium" : "text-mute hover:text-ink hover:bg-paper"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
