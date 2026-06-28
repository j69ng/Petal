import { redirect } from "next/navigation";
import Link from "next/link";
import { subDays, format, parseISO } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import BloomCalendar from "@/components/BloomCalendar";
import { SymptomLog } from "@/lib/types";

function computeStreak(logs: SymptomLog[]): number {
  const dates = new Set(logs.map((l) => l.log_date));
  let streak = 0;
  let cursor = new Date();
  while (dates.has(format(cursor, "yyyy-MM-dd"))) {
    streak += 1;
    cursor = subDays(cursor, 1);
  }
  return streak;
}

export default async function DashboardOverviewPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, conditions")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || !profile.conditions || profile.conditions.length === 0) {
    redirect("/onboarding");
  }

  const since = format(subDays(new Date(), 35), "yyyy-MM-dd");
  const { data: logs } = await supabase
    .from("symptom_logs")
    .select("*, entries:symptom_entries(*)")
    .eq("user_id", user.id)
    .gte("log_date", since)
    .order("log_date", { ascending: true });

  const typedLogs = (logs ?? []) as unknown as SymptomLog[];
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const loggedToday = typedLogs.some((l) => l.log_date === todayStr);
  const streak = computeStreak(typedLogs);
  const now = new Date();
  const daysLoggedThisMonth = typedLogs.filter((l) => {
    const d = parseISO(l.log_date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <p className="eyebrow mb-1">{format(new Date(), "EEEE, MMMM d")}</p>
          <h1 className="font-display text-3xl">
            {profile.full_name ? `Hi, ${profile.full_name}` : "Your month, at a glance"}
          </h1>
        </div>
        <Link
          href="/dashboard/log"
          className="bg-bloom text-white px-5 py-2.5 rounded-full font-medium hover:bg-bloom-dark transition-colors"
        >
          {loggedToday ? "Edit today's entry" : "Log today"}
        </Link>
      </div>

      <div className="grid sm:grid-cols-3 gap-6">
        <div className="sm:col-span-2 bg-white/50 border border-mute-light rounded-3xl p-6 flex justify-center">
          <BloomCalendar month={new Date()} logs={typedLogs} />
        </div>
        <div className="space-y-4">
          <div className="border border-mute-light rounded-2xl p-5 bg-white/50">
            <p className="text-3xl font-display">{streak}</p>
            <p className="text-sm text-mute">day streak</p>
          </div>
          <div className="border border-mute-light rounded-2xl p-5 bg-white/50">
            <p className="text-3xl font-display">{daysLoggedThisMonth}</p>
            <p className="text-sm text-mute">days logged this month</p>
          </div>
          <Link
            href="/dashboard/trends"
            className="block text-center border border-mute-light rounded-2xl py-3 text-sm hover:border-mute"
          >
            View trends & patterns →
          </Link>
        </div>
      </div>
    </div>
  );
}
