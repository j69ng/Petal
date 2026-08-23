// Core domain types. One contractor, many builds (projects), the people who
// work on them and the materials bought for them.

export type ProjectStatus = "planning" | "active" | "done";
export type WageType = "daily" | "monthly";
export type PaymentKind = "advance" | "wage" | "bonus";

export interface Project {
  id: number;
  name: string;
  site: string | null;
  /** Built-up area. Everything cross-build is compared per sq.ft, so this matters. */
  area_sqft: number;
  started_on: string; // YYYY-MM-DD
  ended_on: string | null;
  status: ProjectStatus;
  notes: string | null;
}

export interface Worker {
  id: number;
  name: string;
  /** mason, helper, carpenter, electrician, plumber, painter, bar-bender, driver... */
  trade: string;
  wage_type: WageType;
  /** Per day for `daily`, per month for `monthly`. */
  rate: number;
  phone: string | null;
  active: 0 | 1;
}

export interface Attendance {
  id: number;
  project_id: number;
  worker_id: number;
  work_date: string; // YYYY-MM-DD
  /** 1 = full day, 0.5 = half day. Overtime goes in ot_hours, not here. */
  days: number;
  ot_hours: number;
  /**
   * Day rate that applied on this date. Stored per row on purpose: a worker's
   * rate today must not silently re-cost a build finished three years ago, and
   * a mid-build raise has to stay visible. Null falls back to the worker's
   * current rate.
   */
  day_rate: number | null;
}

export interface Payment {
  id: number;
  worker_id: number;
  project_id: number | null;
  paid_on: string;
  amount: number;
  kind: PaymentKind;
  note: string | null;
}

export interface Purchase {
  id: number;
  project_id: number;
  material_key: string;
  unit: string;
  qty: number;
  /** Price of one unit as billed, before freight. */
  rate: number;
  /** Delivery/cartage on this bill. Landed cost = qty * rate + freight. */
  freight: number;
  vendor: string;
  invoice_no: string | null;
  purchased_on: string;
  note: string | null;
}

export interface Settings {
  currency: string;
  /** Default expected annual price drift, in percent. Per-material overrides live in the catalog. */
  inflation_pct: number;
  /** Above fair price by this much -> "watch". */
  watch_pct: number;
  /** Above fair price by this much -> "overcharged". */
  alert_pct: number;
  /** Using this much more material per sq.ft than last build -> flag. */
  qty_watch_pct: number;
  /** Days a monthly-salaried worker is expected to work per month (26 is the common convention). */
  working_days_per_month: number;
}

export const DEFAULT_SETTINGS: Settings = {
  currency: "Rs.",
  inflation_pct: 6,
  watch_pct: 8,
  alert_pct: 20,
  qty_watch_pct: 10,
  working_days_per_month: 26,
};
