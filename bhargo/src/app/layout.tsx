import type { Metadata } from "next";

import Nav from "@/components/Nav";
import { currentUser } from "@/lib/auth";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bhargo — construction accounts",
  description: "Wages, material bills, and what a build is really costing against the last one.",
};

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Nobody signed in means the sign-in or first-run page, which carries no nav.
  const user = currentUser();

  return (
    <html lang="en">
      <body>
        {user && <Nav user={{ name: user.name, role: user.role }} />}
        <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">{children}</main>
        <footer className="max-w-6xl mx-auto px-4 sm:px-6 py-8 text-xs text-mute no-print">
          Bhargo keeps your books on your own machine. Figures here are your own records — useful for
          asking a supplier a question, not proof of anything on their own.
        </footer>
      </body>
    </html>
  );
}
