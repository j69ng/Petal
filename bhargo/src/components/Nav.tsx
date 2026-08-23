"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { signOutAction } from "@/lib/actions";

const LINKS = [
  { href: "/", label: "Overview" },
  { href: "/compare", label: "Compare builds" },
  { href: "/purchases", label: "Materials" },
  { href: "/people", label: "People" },
  { href: "/payroll", label: "Wages" },
  { href: "/projects", label: "Builds" },
];

const OWNER_LINKS = [
  { href: "/settings", label: "Settings" },
  { href: "/users", label: "Accounts" },
];

export default function Nav({ user }: { user: { name: string; role: string } }) {
  const pathname = usePathname();
  const links = user.role === "owner" ? [...LINKS, ...OWNER_LINKS] : LINKS;

  return (
    <nav className="border-b border-line bg-card no-print">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center gap-1 h-14 overflow-x-auto">
        <Link href="/" className="font-semibold text-lg mr-4 shrink-0">
          Bhargo
        </Link>
        {links.map((link) => {
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
        <form action={signOutAction} className="ml-auto flex items-center gap-3 pl-4 shrink-0">
          <span className="text-xs text-mute whitespace-nowrap">{user.name}</span>
          <button className="btn-quiet">Sign out</button>
        </form>
      </div>
    </nav>
  );
}
