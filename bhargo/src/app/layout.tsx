import type { Metadata, Viewport } from "next";

import Nav from "@/components/Nav";
import { currentUser, isOwner } from "@/lib/auth";
import { pendingCounts } from "@/lib/db";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bhargo — construction accounts",
  description: "Wages, material bills, and what a build is really costing against the last one.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Bhargo", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Let people zoom — site foremen read this in daylight.
  maximumScale: 5,
  themeColor: "#8a5a2b",
};

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Nobody signed in means the sign-in or first-run page, which carries no nav.
  const user = currentUser();
  const pending = user && isOwner(user) ? pendingCounts().total : 0;

  return (
    <html lang="en">
      <body>
        {user && <Nav user={{ name: user.name, role: user.role }} pending={pending} />}
        <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">{children}</main>
        <footer className="max-w-6xl mx-auto px-4 sm:px-6 py-8 text-xs text-mute no-print">
          Bhargo keeps your books on your own machine. Figures here are your own records — useful for
          asking a supplier a question, not proof of anything on their own.
        </footer>
        {/* Room for the thumb bar on phones */}
        {user && <div className="h-16 md:hidden" aria-hidden />}
      </body>
    </html>
  );
}
