export type ConditionKey = "pcos" | "endometriosis" | "fibromyalgia" | "autoimmune" | "other";

export interface Profile {
  id: string;
  full_name: string | null;
  conditions: ConditionKey[];
  created_at: string;
}

export interface SymptomEntry {
  id: string;
  log_id: string;
  symptom_key: string;
  severity: number; // 0-10
  body_region: string | null;
}

export interface SymptomLog {
  id: string;
  user_id: string;
  log_date: string; // YYYY-MM-DD
  mood: number | null; // 0-10
  energy: number | null; // 0-10
  sleep_hours: number | null;
  notes: string | null;
  created_at: string;
  entries: SymptomEntry[];
}

export interface Subscription {
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  status: "free" | "active" | "past_due" | "canceled";
  current_period_end: string | null;
}
