"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { signOutAction } from "@/lib/actions";

const MAIN = [
  { href: "/", label: "Home", icon: "▤" },
  { href: "/purchases", label: "Materials", icon: "▦" },
  { href: "/people", label: "Muster", icon: "☰" },
  { href: "/payroll", label: "Wages", icon: "₹" },
  { href: "/compare", label: "Compare", icon: "⇄" },
];

const MORE = [
  { href: "/prices", label: "Usual prices" },
  { href: "/projects", label: "Builds" },
];

const OWNER_MORE = [
  { href: "/approvals", label: "Waiting for you" },
  { href: "/settings", label: "Settings" },
  { href: "/users", label: "Accounts" },
];

/**
 * Two shapes for one nav. On a phone the five things done daily sit in a thumb
 * bar at the bottom and everything else lives behind "More"; on a wider screen
 * it is one row along the top. Same links either way.
 */
export default function Nav({
  user,
  pending,
}: {
  user: { name: string; role: string };
  pending: number;
}) {
  const pathname = usePathname();
  const [openMore, setOpenMore] = useState(false);
  const owner = user.role === "owner";
  const more = owner ? [...MORE, ...OWNER_MORE] : MORE;
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <>
      {/* Top bar: full nav on desktop, name + More on a phone */}
      <nav className="border-b border-line bg-card sticky top-0 z-20 no-print">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-1">
          <Link href="/" className="font-semibold text-lg mr-2 sm:mr-4 shrink-0">
            Bhargo
          </Link>

          <div className="hidden md:flex items-center gap-1 overflow-x-auto">
            {[...MAIN, ...more].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm px-3 py-1.5 rounded whitespace-nowrap transition-colors ${
                  isActive(link.href) ? "bg-brandsoft text-brand font-medium" : "text-mute hover:text-ink hover:bg-paper"
                }`}
              >
                {link.label}
                {link.href === "/approvals" && pending > 0 && (
                  <span className="ml-1.5 inline-block bg-alert text-white text-xs rounded-full px-1.5">{pending}</span>
                )}
              </Link>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2 shrink-0">
            {owner && pending > 0 && (
              <Link href="/approvals" className="md:hidden text-xs bg-alert text-white rounded-full px-2 py-1">
                {pending} waiting
              </Link>
            )}
            <button
              onClick={() => setOpenMore((open) => !open)}
              className="md:hidden btn-quiet"
              aria-expanded={openMore}
            >
              More
            </button>
            <form action={signOutAction} className="hidden md:flex items-center gap-3">
              <span className="text-xs text-mute whitespace-nowrap">{user.name}</span>
              <button className="btn-quiet">Sign out</button>
            </form>
          </div>
        </div>

        {openMore && (
          <div className="md:hidden border-t border-line bg-card px-4 py-3 space-y-1">
            {more.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpenMore(false)}
                className={`block px-3 py-2.5 rounded text-sm ${
                  isActive(link.href) ? "bg-brandsoft text-brand font-medium" : "text-ink hover:bg-paper"
                }`}
              >
                {link.label}
                {link.href === "/approvals" && pending > 0 && (
                  <span className="ml-2 inline-block bg-alert text-white text-xs rounded-full px-1.5">{pending}</span>
                )}
              </Link>
            ))}
            <form action={signOutAction} className="pt-2 border-t border-line mt-2">
              <div className="text-xs text-mute px-3 pb-2">Signed in as {user.name}</div>
              <button className="btn-quiet ml-3">Sign out</button>
            </form>
          </div>
        )}
      </nav>

      {/* Thumb bar, phones only */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-20 bg-card border-t border-line no-print">
        <div className="grid grid-cols-5">
          {MAIN.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] min-h-[3.5rem] ${
                isActive(link.href) ? "text-brand font-medium" : "text-mute"
              }`}
            >
              <span aria-hidden className="text-base leading-none">{link.icon}</span>
              {link.label}
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
