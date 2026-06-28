"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ConditionPicker from "@/components/ConditionPicker";
import { createClient } from "@/lib/supabase/client";
import { ConditionKey } from "@/lib/types";

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();
  const [conditions, setConditions] = useState<ConditionKey[]>([]);
  const [fullName, setFullName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadExisting() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.push("/login");
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("conditions, full_name")
        .eq("id", userData.user.id)
        .maybeSingle();
      if (profile) {
        setConditions((profile.conditions as ConditionKey[]) ?? []);
        setFullName(profile.full_name ?? "");
      }
    }
    loadExisting();
  }, []);

  async function handleContinue() {
    setSaving(true);
    setError(null);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setError("Session expired — please log in again.");
      setSaving(false);
      return;
    }
    const { error } = await supabase.from("profiles").upsert({
      id: userData.user.id,
      full_name: fullName || null,
      conditions,
    });
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 pt-16 sm:pt-20 pb-16">
      <p className="eyebrow mb-3">Step 1 of 1</p>
      <h1 className="font-display text-3xl mb-2">What are you tracking?</h1>
      <p className="text-ink/80 mb-8">
        Pick everything that applies — we&apos;ll use it to load the right symptom list. You can
        change this anytime in Settings.
      </p>

      <div className="mb-6">
        <label className="block text-sm mb-1" htmlFor="fullName">
          What should we call you? (optional)
        </label>
        <input
          id="fullName"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="w-full max-w-sm border border-mute-light rounded-lg px-3 py-2 bg-white/60"
        />
      </div>

      <ConditionPicker value={conditions} onChange={setConditions} />

      {error && <p className="text-sm text-bloom-dark mt-4">{error}</p>}

      <button
        onClick={handleContinue}
        disabled={saving || conditions.length === 0}
        className="mt-8 bg-bloom text-white px-6 py-2.5 rounded-full font-medium hover:bg-bloom-dark transition-colors disabled:opacity-50"
      >
        {saving ? "Saving…" : "Go to my dashboard"}
      </button>
    </main>
  );
}
