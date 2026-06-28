import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ConditionKey, Subscription } from "@/lib/types";
import SettingsForm from "@/components/SettingsForm";

export default async function SettingsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, conditions")
    .eq("id", user.id)
    .maybeSingle();

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <div>
      <h1 className="font-display text-3xl mb-8">Settings</h1>
      <SettingsForm
        userId={user.id}
        initialFullName={profile?.full_name ?? ""}
        initialConditions={(profile?.conditions as ConditionKey[]) ?? []}
        subscription={subscription as Subscription | null}
      />
    </div>
  );
}
