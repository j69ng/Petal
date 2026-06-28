"use client";

import { createBrowserClient } from "@supabase/ssr";

// Browser-side Supabase client — safe to use in client components.
// Reads the public URL + anon key, which are meant to be exposed to the browser.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
