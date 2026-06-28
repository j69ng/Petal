import { redirect } from "next/navigation";
import Link from "next/link";
import { subDays, format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { SymptomLog, Subscription } from "@/lib/types";
import TrendChart from "@/components/TrendChart";
import InsightCard from "@/components/InsightCard";
import ExportButton from "@/components/ExportButton";
import { generateInsights } from "@/lib/insights";

export default async function TrendsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  const isPro = (subscription as Subscription | null)?.status === "active";
  const historyDays = isPro ? 365 : 30;
  const since = format(subDays(new Date(), historyDays), "yyyy-MM-dd");

  const { data: logs } = await supabase
    .from("symptom_logs")
    .select("*, entries:symptom_entries(*)")
    .eq("user_id", user.id)
    .gte("log_date", since)
    .order("log_date", { ascending: true });

  const typedLogs = (logs ?? []) as unknown as SymptomLog[];
  const insights = isPro ? generateInsights([...typedLogs].reverse()) : [];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <p className="eyebrow mb-1">Last {historyDays} days</p>
          <h1 className="font-display text-3xl">Trends</h1>
        </div>
        {isPro && <ExportButton />}
      </div>

      <div className="border border-mute-light rounded-3xl p-6 bg-white/50 mb-8">
        {typedLogs.length > 0 ? (
          <TrendChart logs={typedLogs} />
        ) : (
          <p className="text-mute text-center py-12">Log a few days to see your trend line here.</p>
        )}
      </div>

      <h2 className="font-display text-xl mb-4">Patterns we noticed</h2>
      {isPro ? (
        <div className="grid sm:grid-cols-2 gap-4">
          {insights.map((insight) => (
            <InsightCard key={insight.id} insight={insight} />
          ))}
        </div>
      ) : (
        <div className="border border-dashed border-mute-light rounded-2xl p-6 text-center">
          <p className="text-ink/80 mb-3">
            Pattern insights and unlimited history are part of Petal Pro.
          </p>
          <Link
            href="/dashboard/settings"
            className="inline-block bg-bloom text-white px-5 py-2 rounded-full text-sm hover:bg-bloom-dark transition-colors"
          >
            Upgrade for $7/mo
          </Link>
        </div>
      )}

      <p className="text-xs text-mute mt-8 max-w-xl">
        These patterns describe your own logged data — they&apos;re not a diagnosis or medical
        advice. Worth bringing up with a clinician, not acting on alone.
      </p>
    </div>
  );
}
