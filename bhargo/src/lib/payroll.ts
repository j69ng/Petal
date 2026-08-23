// Wages. Attendance is the source of truth for what a worker earned; payments
// (advances, weekly settlements, bonuses) are what actually left your hand.
// The difference is what you still owe — the number a worker will ask about on
// Saturday evening.

import type { Attendance, Payment, Project, Settings, Worker } from "./types";

export interface WorkerLedger {
  worker: Worker;
  daysWorked: number;
  otHours: number;
  /** Average day rate across the days worked — monthly salaries divided down to a day. */
  effectiveDailyRate: number;
  wageEarned: number;
  otEarned: number;
  earned: number;
  advancePaid: number;
  wagePaid: number;
  bonusPaid: number;
  /** Advances + wage payments. Bonus sits outside the wage account. */
  settledAgainstWages: number;
  totalPaidOut: number;
  /** Positive: you still owe. Negative: worker has drawn ahead of the work done. */
  balance: number;
}

/** A monthly salary expressed as a day rate. 26 working days is the usual convention. */
export function dailyRateOf(worker: Worker, settings: Settings): number {
  if (worker.wage_type === "daily") return worker.rate;
  const workingDays = settings.working_days_per_month > 0 ? settings.working_days_per_month : 26;
  return worker.rate / workingDays;
}

/** Overtime at 1.5x the hourly equivalent of an 8-hour day. */
export function otHourlyRateOf(worker: Worker, settings: Settings): number {
  return (dailyRateOf(worker, settings) / 8) * 1.5;
}

/**
 * What a day of work actually cost: the rate recorded against that day, or the
 * worker's current rate when the row predates rate-keeping. Using the recorded
 * rate is what keeps an old build costed in old money.
 */
export function rateForDay(worker: Worker, entry: Attendance, settings: Settings): number {
  return entry.day_rate && entry.day_rate > 0 ? entry.day_rate : dailyRateOf(worker, settings);
}

export function workerLedger(
  worker: Worker,
  attendance: Attendance[],
  payments: Payment[],
  settings: Settings
): WorkerLedger {
  const mine = attendance.filter((a) => a.worker_id === worker.id);
  const paid = payments.filter((p) => p.worker_id === worker.id);

  const daysWorked = mine.reduce((sum, a) => sum + a.days, 0);
  const otHours = mine.reduce((sum, a) => sum + (a.ot_hours ?? 0), 0);

  const wageEarned = mine.reduce((sum, a) => sum + a.days * rateForDay(worker, a, settings), 0);
  const otEarned = mine.reduce(
    (sum, a) => sum + (a.ot_hours ?? 0) * ((rateForDay(worker, a, settings) / 8) * 1.5),
    0
  );
  const earned = wageEarned + otEarned;
  const effectiveDailyRate = daysWorked > 0 ? wageEarned / daysWorked : dailyRateOf(worker, settings);

  const sumKind = (kind: Payment["kind"]) =>
    paid.filter((p) => p.kind === kind).reduce((sum, p) => sum + p.amount, 0);

  const advancePaid = sumKind("advance");
  const wagePaid = sumKind("wage");
  const bonusPaid = sumKind("bonus");
  const settledAgainstWages = advancePaid + wagePaid;

  return {
    worker,
    daysWorked,
    otHours,
    effectiveDailyRate,
    wageEarned,
    otEarned,
    earned,
    advancePaid,
    wagePaid,
    bonusPaid,
    settledAgainstWages,
    totalPaidOut: settledAgainstWages + bonusPaid,
    balance: earned - settledAgainstWages,
  };
}

export function payrollLedger(
  workers: Worker[],
  attendance: Attendance[],
  payments: Payment[],
  settings: Settings
): WorkerLedger[] {
  return workers
    .map((w) => workerLedger(w, attendance, payments, settings))
    .filter((l) => l.daysWorked > 0 || l.totalPaidOut > 0)
    .sort((a, b) => b.balance - a.balance);
}

export interface TradeSummary {
  trade: string;
  days: number;
  otHours: number;
  /** Plain day wages: days x rate. */
  wageCost: number;
  otCost: number;
  cost: number;
  /**
   * Wage cost per day worked, overtime deliberately excluded — otherwise a
   * build with more overtime looks like it had dearer workers, and the
   * build-to-build rate comparison stops being like-for-like.
   */
  avgDayRate: number;
  daysPerSqft: number;
  costPerSqft: number;
}

export interface LabourSummary {
  project: Project;
  totalDays: number;
  totalOtHours: number;
  totalWageCost: number;
  totalOtCost: number;
  totalCost: number;
  costPerSqft: number;
  daysPerSqft: number;
  byTrade: TradeSummary[];
}

/** What labour cost this build, normalised by floor area so builds can be compared. */
export function labourSummary(
  project: Project,
  workers: Worker[],
  attendance: Attendance[],
  settings: Settings
): LabourSummary {
  const area = project.area_sqft > 0 ? project.area_sqft : 1;
  const workerById = new Map(workers.map((w) => [w.id, w]));
  const trades = new Map<string, { days: number; otHours: number; wageCost: number; otCost: number }>();

  let totalDays = 0;
  let totalOtHours = 0;
  let totalWageCost = 0;
  let totalOtCost = 0;

  for (const a of attendance.filter((a) => a.project_id === project.id)) {
    const worker = workerById.get(a.worker_id);
    if (!worker) continue;
    const dayRate = rateForDay(worker, a, settings);
    const otHours = a.ot_hours ?? 0;
    const wageCost = a.days * dayRate;
    const otCost = otHours * ((dayRate / 8) * 1.5);

    const acc = trades.get(worker.trade) ?? { days: 0, otHours: 0, wageCost: 0, otCost: 0 };
    acc.days += a.days;
    acc.otHours += otHours;
    acc.wageCost += wageCost;
    acc.otCost += otCost;
    trades.set(worker.trade, acc);

    totalDays += a.days;
    totalOtHours += otHours;
    totalWageCost += wageCost;
    totalOtCost += otCost;
  }

  const byTrade: TradeSummary[] = Array.from(trades.entries())
    .map(([trade, v]) => ({
      trade,
      days: v.days,
      otHours: v.otHours,
      wageCost: v.wageCost,
      otCost: v.otCost,
      cost: v.wageCost + v.otCost,
      avgDayRate: v.days > 0 ? v.wageCost / v.days : 0,
      daysPerSqft: v.days / area,
      costPerSqft: (v.wageCost + v.otCost) / area,
    }))
    .sort((a, b) => b.cost - a.cost);

  const totalCost = totalWageCost + totalOtCost;

  return {
    project,
    totalDays,
    totalOtHours,
    totalWageCost,
    totalOtCost,
    totalCost,
    costPerSqft: totalCost / area,
    daysPerSqft: totalDays / area,
    byTrade,
  };
}

export interface TradeComparison {
  trade: string;
  baseDayRate: number;
  currentDayRate: number;
  fairDayRate: number;
  ratePremiumPct: number;
  baseDaysPerSqft: number;
  currentDaysPerSqft: number;
  expectedDays: number;
  currentDays: number;
  daysOverrunPct: number;
  excessFromRate: number;
  excessFromDays: number;
  excessTotal: number;
  verdict: "cheaper" | "ok" | "watch" | "alert" | "new";
  reasons: string[];
}

export interface LabourComparison {
  base: LabourSummary;
  current: LabourSummary;
  yearsApart: number;
  rows: TradeComparison[];
  totals: {
    expectedCost: number;
    actualCost: number;
    excessFromRate: number;
    excessFromDays: number;
    excessTotal: number;
    /** Counting only the trades being overpaid — the honest mid-build headline. */
    excessFromRatePositive: number;
    excessFromDaysPositive: number;
    baseOtCost: number;
    currentOtCost: number;
  };
}

/**
 * Labour, compared the same way as materials: day rates aged forward at normal
 * wage drift, man-days scaled to floor area, and the gap split into "the rate
 * went up" versus "more days were booked than the work needed".
 *
 * Padded muster rolls — days billed for people who were not on site — show up
 * here as a days overrun, not a rate problem.
 */
export function compareLabour(
  base: LabourSummary,
  current: LabourSummary,
  settings: Settings,
  wageDriftPct = settings.inflation_pct
): LabourComparison {
  const baseArea = base.project.area_sqft > 0 ? base.project.area_sqft : 1;
  const curArea = current.project.area_sqft > 0 ? current.project.area_sqft : 1;
  const areaRatio = curArea / baseArea;

  const startToStart =
    (new Date(`${current.project.started_on}T00:00:00Z`).getTime() -
      new Date(`${base.project.started_on}T00:00:00Z`).getTime()) /
    (365.25 * 86_400_000);
  const yearsApart = startToStart;

  const baseByTrade = new Map(base.byTrade.map((t) => [t.trade, t]));
  const rows: TradeComparison[] = [];

  for (const cur of current.byTrade) {
    const b = baseByTrade.get(cur.trade);
    if (!b || b.days <= 0 || b.avgDayRate <= 0) {
      rows.push({
        trade: cur.trade,
        baseDayRate: 0,
        currentDayRate: cur.avgDayRate,
        fairDayRate: 0,
        ratePremiumPct: 0,
        baseDaysPerSqft: 0,
        currentDaysPerSqft: cur.daysPerSqft,
        expectedDays: 0,
        currentDays: cur.days,
        daysOverrunPct: 0,
        excessFromRate: 0,
        excessFromDays: 0,
        excessTotal: 0,
        verdict: "new",
        reasons: ["This trade was not used on the baseline build."],
      });
      continue;
    }

    const fairDayRate = b.avgDayRate * Math.pow(1 + wageDriftPct / 100, yearsApart);
    const ratePremiumPct = fairDayRate > 0 ? ((cur.avgDayRate - fairDayRate) / fairDayRate) * 100 : 0;
    const expectedDays = b.days * areaRatio;
    const daysOverrunPct = expectedDays > 0 ? ((cur.days - expectedDays) / expectedDays) * 100 : 0;
    const excessFromRate = (cur.avgDayRate - fairDayRate) * cur.days;
    const excessFromDays = (cur.days - expectedDays) * fairDayRate;

    const rateVerdict: TradeComparison["verdict"] =
      ratePremiumPct <= -settings.watch_pct
        ? "cheaper"
        : ratePremiumPct <= settings.watch_pct
        ? "ok"
        : ratePremiumPct < settings.alert_pct
        ? "watch"
        : "alert";

    const verdict: TradeComparison["verdict"] =
      daysOverrunPct >= settings.alert_pct
        ? "alert"
        : daysOverrunPct > settings.qty_watch_pct && rateVerdict !== "alert"
        ? "watch"
        : rateVerdict;

    const reasons: string[] = [];
    if (verdict === "watch" || verdict === "alert") {
      reasons.push(
        `Day rate is ${cur.avgDayRate.toFixed(0)} against ${fairDayRate.toFixed(0)} expected from the ` +
          `last build after ${yearsApart.toFixed(1)} yr of normal wage rise.`
      );
    }
    if (daysOverrunPct > settings.qty_watch_pct) {
      reasons.push(
        `${cur.days.toFixed(1)} man-days booked where the last build needed ${expectedDays.toFixed(1)} ` +
          `for this floor area. Check the muster roll against who was actually on site.`
      );
    }

    rows.push({
      trade: cur.trade,
      baseDayRate: b.avgDayRate,
      currentDayRate: cur.avgDayRate,
      fairDayRate,
      ratePremiumPct,
      baseDaysPerSqft: b.daysPerSqft,
      currentDaysPerSqft: cur.daysPerSqft,
      expectedDays,
      currentDays: cur.days,
      daysOverrunPct,
      excessFromRate,
      excessFromDays,
      excessTotal: excessFromRate + excessFromDays,
      verdict,
      reasons,
    });
  }

  rows.sort((a, b) => b.excessTotal - a.excessTotal);
  const comparable = rows.filter((r) => r.verdict !== "new");

  return {
    base,
    current,
    yearsApart,
    rows,
    totals: {
      expectedCost: comparable.reduce((s, r) => s + r.expectedDays * r.fairDayRate, 0),
      actualCost: comparable.reduce((s, r) => s + r.currentDays * r.currentDayRate, 0),
      excessFromRate: comparable.reduce((s, r) => s + r.excessFromRate, 0),
      excessFromDays: comparable.reduce((s, r) => s + r.excessFromDays, 0),
      excessTotal: comparable.reduce((s, r) => s + r.excessTotal, 0),
      excessFromRatePositive: comparable.reduce((s, r) => s + Math.max(r.excessFromRate, 0), 0),
      excessFromDaysPositive: comparable.reduce((s, r) => s + Math.max(r.excessFromDays, 0), 0),
      baseOtCost: base.totalOtCost,
      currentOtCost: current.totalOtCost,
    },
  };
}
