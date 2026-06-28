import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  let query = supabase
    .from("symptom_logs")
    .select("*, entries:symptom_entries(*)")
    .eq("user_id", user.id)
    .order("log_date", { ascending: true });

  if (start) query = query.gte("log_date", start);
  if (end) query = query.lte("log_date", end);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ logs: data });
}

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { log_date, mood, energy, sleep_hours, notes, entries } = body;
  if (!log_date) return NextResponse.json({ error: "log_date is required" }, { status: 400 });

  const { data: log, error: logError } = await supabase
    .from("symptom_logs")
    .upsert(
      { user_id: user.id, log_date, mood, energy, sleep_hours, notes },
      { onConflict: "user_id,log_date" }
    )
    .select()
    .single();

  if (logError) return NextResponse.json({ error: logError.message }, { status: 500 });

  const { error: deleteError } = await supabase
    .from("symptom_entries")
    .delete()
    .eq("log_id", log.id);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });

  if (Array.isArray(entries) && entries.length > 0) {
    const rows = entries.map((e: { symptom_key: string; severity: number; body_region?: string | null }) => ({
      log_id: log.id,
      symptom_key: e.symptom_key,
      severity: e.severity,
      body_region: e.body_region ?? null,
    }));
    const { error: insertError } = await supabase.from("symptom_entries").insert(rows);
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, log_id: log.id });
}
