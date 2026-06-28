"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const LINKS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/log", label: "Log today" },
  { href: "/dashboard/trends", label: "Trends" },
  { href: "/dashboard/settings", label: "Settings" },
];

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <nav className="border-b border-mute-light bg-bg/80 backdrop-blur sticky top-0 z-10">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
        <Link href="/dashboard" className="font-display text-xl italic">
          Petal
        </Link>
        <div className="flex items-center gap-1 sm:gap-2">
          {LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm px-3 py-2 rounded-full transition-colors ${
                  active ? "bg-bloom text-white" : "text-ink hover:bg-mute-light"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
          <button
            onClick={signOut}
            className="text-sm px-3 py-2 rounded-full text-mute hover:bg-mute-light"
          >
            Sign out
          </button>
        </div>
      </div>
    </nav>
  );
}
