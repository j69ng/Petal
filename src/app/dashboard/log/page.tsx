import { redirect } from "next/navigation";
import { format, parseISO } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { getConditionSymptoms } from "@/lib/conditions";
import { ConditionKey, SymptomLog } from "@/lib/types";
import LogForm from "@/components/LogForm";

export default async function LogPage({
  searchParams,
}: {
  searchParams: { date?: string };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const date = searchParams.date ?? format(new Date(), "yyyy-MM-dd");

  const { data: profile } = await supabase
    .from("profiles")
    .select("conditions")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || !profile.conditions || profile.conditions.length === 0) {
    redirect("/onboarding");
  }

  const availableSymptoms = getConditionSymptoms(profile.conditions as ConditionKey[]);

  const { data: existing } = await supabase
    .from("symptom_logs")
    .select("*, entries:symptom_entries(*)")
    .eq("user_id", user.id)
    .eq("log_date", date)
    .maybeSingle();

  return (
    <div className="max-w-2xl">
      <p className="eyebrow mb-1">Daily log</p>
      <h1 className="font-display text-3xl mb-8">{format(parseISO(date), "EEEE, MMMM d")}</h1>
      <LogForm
        date={date}
        availableSymptoms={availableSymptoms}
        initialLog={(existing as unknown as SymptomLog) ?? null}
      />
    </div>
  );
}
