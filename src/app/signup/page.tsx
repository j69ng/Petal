"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <main className="max-w-sm mx-auto px-4 pt-24 text-center">
        <p className="font-display text-2xl mb-3">Check your inbox</p>
        <p className="text-ink/80">
          We sent a confirmation link to {email}. Click it to finish setting up your account.
        </p>
      </main>
    );
  }

  return (
    <main className="max-w-sm mx-auto px-4 pt-24">
      <Link href="/" className="font-display text-2xl italic">Petal</Link>
      <h1 className="font-display text-2xl mt-8 mb-2">Create your account</h1>
      <p className="text-sm text-mute mb-6">Free to start. No card needed.</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm mb-1" htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-mute-light rounded-lg px-3 py-2 bg-white/60"
          />
        </div>
        <div>
          <label className="block text-sm mb-1" htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-mute-light rounded-lg px-3 py-2 bg-white/60"
          />
        </div>
        {error && <p className="text-sm text-bloom-dark">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-bloom text-white rounded-full py-2.5 font-medium hover:bg-bloom-dark transition-colors disabled:opacity-60"
        >
          {loading ? "Creating account…" : "Create account"}
        </button>
      </form>
      <p className="text-sm text-mute mt-6">
        Already have one?{" "}
        <Link href="/login" className="underline">
          Log in
        </Link>
      </p>
    </main>
  );
}
