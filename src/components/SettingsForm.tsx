"use client";

import { useState } from "react";
import ConditionPicker from "./ConditionPicker";
import { createClient } from "@/lib/supabase/client";
import { ConditionKey, Subscription } from "@/lib/types";

interface SettingsFormProps {
  userId: string;
  initialFullName: string;
  initialConditions: ConditionKey[];
  subscription: Subscription | null;
}

export default function SettingsForm({
  userId,
  initialFullName,
  initialConditions,
  subscription,
}: SettingsFormProps) {
  const [fullName, setFullName] = useState(initialFullName);
  const [conditions, setConditions] = useState<ConditionKey[]>(initialConditions);
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingInterval, setBillingInterval] = useState<"month" | "year">("year");

  const isPro = subscription?.status === "active";

  async function saveProfile() {
    setSaving(true);
    setSavedMessage(null);
    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .upsert({ id: userId, full_name: fullName || null, conditions });
    setSaving(false);
    setSavedMessage(error ? "Couldn't save — try again." : "Saved.");
  }

  async function startCheckout() {
    setBillingLoading(true);
    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ interval: billingInterval }),
    });
    const data = await res.json();
    setBillingLoading(false);
    if (data.url) window.location.href = data.url;
  }

  async function openBillingPortal() {
    setBillingLoading(true);
    const res = await fetch("/api/stripe/portal", { method: "POST" });
    const data = await res.json();
    setBillingLoading(false);
    if (data.url) window.location.href = data.url;
  }

  return (
    <div className="space-y-10 max-w-xl">
      <section>
        <p className="eyebrow mb-3">Profile</p>
        <label className="block text-sm mb-1" htmlFor="fullName">Name</label>
        <input
          id="fullName"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="w-full border border-mute-light rounded-lg px-3 py-2 bg-white/60 mb-4"
        />
        <p className="text-sm mb-2">Conditions you track</p>
        <ConditionPicker value={conditions} onChange={setConditions} />
        <div className="flex items-center gap-4 mt-4">
          <button
            onClick={saveProfile}
            disabled={saving}
            className="bg-bloom text-white px-5 py-2 rounded-full text-sm hover:bg-bloom-dark transition-colors disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
          {savedMessage && <span className="text-sm text-mute">{savedMessage}</span>}
        </div>
      </section>

      <section>
        <p className="eyebrow mb-3">Billing</p>
        {isPro ? (
          <div className="border border-mute-light rounded-2xl p-5 bg-white/50">
            <p className="font-display text-lg mb-1">Petal Pro</p>
            <p className="text-sm text-mute mb-4">
              {subscription?.current_period_end
                ? `Renews ${new Date(subscription.current_period_end).toLocaleDateString()}`
                : "Active"}
            </p>
            <button
              onClick={openBillingPortal}
              disabled={billingLoading}
              className="border border-ink rounded-full px-4 py-2 text-sm hover:bg-ink hover:text-bg transition-colors disabled:opacity-60"
            >
              {billingLoading ? "Loading…" : "Manage billing"}
            </button>
          </div>
        ) : (
          <div className="border border-mute-light rounded-2xl p-5 bg-white/50">
            <p className="font-display text-lg mb-1">Free plan</p>
            <p className="text-sm text-mute mb-4">
              Upgrade for unlimited history, pattern insights, and doctor-ready exports.
            </p>

            <div className="inline-flex border border-mute-light rounded-full p-1 mb-4 text-sm">
              <button
                type="button"
                onClick={() => setBillingInterval("month")}
                className={`px-3 py-1 rounded-full transition-colors ${
                  billingInterval === "month" ? "bg-ink text-bg" : "text-ink/70"
                }`}
              >
                Monthly — $7
              </button>
              <button
                type="button"
                onClick={() => setBillingInterval("year")}
                className={`px-3 py-1 rounded-full transition-colors ${
                  billingInterval === "year" ? "bg-ink text-bg" : "text-ink/70"
                }`}
              >
                Annual — $60 (save 29%)
              </button>
            </div>

            <div>
              <button
                onClick={startCheckout}
                disabled={billingLoading}
                className="bg-bloom text-white px-5 py-2 rounded-full text-sm hover:bg-bloom-dark transition-colors disabled:opacity-60"
              >
                {billingLoading ? "Loading…" : "Upgrade to Pro"}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
