// The point of this file: answer "am I being charged more than last time, and
// how much more?" without hand-waving.
//
// Two builds are never the same size and never happen in the same year, so a
// raw price comparison is useless — a bigger house costs more, and prices rise
// on their own. So every comparison here does three things:
//
//   1. scales the old build's usage to the new build's floor area,
//   2. ages the old build's prices forward at a normal market drift,
//   3. splits whatever is left over into "charged a higher rate" vs
//      "billed more material", because those are two different problems.
//
// (2) is what a supplier counts on you not doing. (3) is what catches the
// quieter trick: fair rate on paper, but 30% more cement bags than the last
// house of the same size needed.

import { driftFor, material } from "./materials";
import type { Project, Purchase, Settings } from "./types";
import { round2 } from "./money";

export type Verdict = "cheaper" | "ok" | "watch" | "alert" | "new";

export interface MaterialRollup {
  materialKey: string;
  unit: string;
  qty: number;
  /** Landed cost: qty * rate + freight. */
  amount: number;
  /** Landed cost per unit. */
  avgRate: number;
  minRate: number;
  maxRate: number;
  vendors: string[];
  lines: number;
  /** Spend-weighted average purchase date — "when did this money actually go out". */
  weightedDate: string;
}

export interface MaterialComparison {
  materialKey: string;
  label: string;
  unit: string;
  lumpSum: boolean;
  base: { qty: number; amount: number; avgRate: number; perArea: number };
  current: { qty: number; amount: number; avgRate: number; perArea: number };
  /** Years between the two builds' spend on this material. */
  yearsApart: number;
  driftPct: number;
  /** Last build's rate, aged forward at normal market drift. The honest price today. */
  fairRate: number;
  /** How far the rate sits above (or below) that honest price. */
  ratePremiumPct: number;
  /** Same comparison ignoring inflation — what a naive eyeball comparison would show. */
  rawRatePct: number;
  /** What this build should have used, at last build's intensity, scaled to its area. */
  expectedQty: number;
  qtyOverrunPct: number;
  expectedSpend: number;
  actualSpend: number;
  /** Extra money explained by a higher unit rate. */
  excessFromRate: number;
  /** Extra money explained by more material being billed. */
  excessFromQty: number;
  excessTotal: number;
  verdict: Verdict;
  reasons: string[];
}

export interface CompareOptions {
  /**
   * How far along the current build is, 0-100. Leave at 100 to compare against
   * the finished baseline house — the right default, because a material that is
   * already past what the whole last house needed is worth asking about now.
   * Set it lower to ask the softer question: "at this stage, how much would the
   * last house have used?"
   */
  progressPct?: number;
}

export interface CompareResult {
  base: Project;
  current: Project;
  areaRatio: number;
  rows: MaterialComparison[];
  /** Bought last time, not (yet) bought this time — shown so nothing looks silently missing. */
  notBoughtYet: MaterialRollup[];
  totals: {
    baseSpend: number;
    currentSpend: number;
    /** Current spend on materials that also exist in the baseline. */
    comparableSpend: number;
    expectedSpend: number;
    excessFromRate: number;
    excessFromQty: number;
    excessTotal: number;
    /** Rate excess counting only the materials being overcharged — the mid-build headline. */
    excessFromRatePositive: number;
    /** Quantity excess counting only materials already past the baseline. */
    excessFromQtyPositive: number;
    /** Spend on materials with no baseline to compare against. */
    uncomparableSpend: number;
    basePerSqft: number;
    currentPerSqft: number;
    alerts: number;
    watches: number;
  };
}

const DAY_MS = 86_400_000;

function toTime(date: string): number {
  return new Date(`${date}T00:00:00Z`).getTime();
}

function fromTime(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function yearsBetween(from: string, to: string): number {
  return (toTime(to) - toTime(from)) / (365.25 * DAY_MS);
}

/** Landed cost of one purchase line: goods plus whatever it cost to get them here. */
export function lineAmount(p: Pick<Purchase, "qty" | "rate" | "freight">): number {
  return p.qty * p.rate + (p.freight ?? 0);
}

export function rollupByMaterial(purchases: Purchase[]): MaterialRollup[] {
  const groups = new Map<string, Purchase[]>();
  for (const p of purchases) {
    const list = groups.get(p.material_key);
    if (list) list.push(p);
    else groups.set(p.material_key, [p]);
  }

  const rollups: MaterialRollup[] = [];
  for (const [key, lines] of groups) {
    const qty = lines.reduce((sum, l) => sum + l.qty, 0);
    const amount = lines.reduce((sum, l) => sum + lineAmount(l), 0);
    const unitRates = lines.filter((l) => l.qty > 0).map((l) => lineAmount(l) / l.qty);
    // Weight the date by spend so one small early bill doesn't drag the age of
    // a material that was mostly bought a year later.
    const weight = lines.reduce((sum, l) => sum + Math.max(lineAmount(l), 0), 0);
    const weightedMs =
      weight > 0
        ? lines.reduce((sum, l) => sum + toTime(l.purchased_on) * Math.max(lineAmount(l), 0), 0) / weight
        : toTime(lines[0].purchased_on);

    rollups.push({
      materialKey: key,
      unit: lines[0].unit || material(key).unit,
      qty: round2(qty),
      amount: round2(amount),
      avgRate: qty > 0 ? amount / qty : 0,
      minRate: unitRates.length ? Math.min(...unitRates) : 0,
      maxRate: unitRates.length ? Math.max(...unitRates) : 0,
      vendors: Array.from(new Set(lines.map((l) => l.vendor).filter(Boolean))),
      lines: lines.length,
      weightedDate: fromTime(weightedMs),
    });
  }

  return rollups.sort((a, b) => b.amount - a.amount);
}

/**
 * The verdict answers "is there something to argue about here", so it weighs
 * both ways of being charged more: a dearer rate, and more material billed than
 * the last house of this size needed. A fair rate on a 30% padded quantity is
 * still a 30% problem.
 */
function verdictFor(ratePremiumPct: number, qtyOverrunPct: number, settings: Settings): Verdict {
  const rate: Verdict =
    ratePremiumPct <= -settings.watch_pct
      ? "cheaper"
      : ratePremiumPct <= settings.watch_pct
      ? "ok"
      : ratePremiumPct < settings.alert_pct
      ? "watch"
      : "alert";

  // A normal quantity says nothing, so it never pulls a verdict up or down —
  // only an overrun can escalate one.
  if (qtyOverrunPct >= settings.alert_pct) return "alert";
  if (qtyOverrunPct > settings.qty_watch_pct && rate !== "alert") return "watch";
  return rate;
}

/**
 * Compare a build in progress against a finished one.
 *
 * The arithmetic that matters, per material:
 *
 *   fairRate     = baseRate x (1 + drift)^years
 *   expectedQty  = baseQty x (currentArea / baseArea)
 *   excessRate   = (currentRate - fairRate) x currentQty
 *   excessQty    = (currentQty - expectedQty) x fairRate
 *
 * Those two pieces add up exactly to actualSpend - expectedSpend, so the
 * summary always reconciles — no leftover "other" bucket to argue about.
 */
export function compareProjects(
  base: Project,
  basePurchases: Purchase[],
  current: Project,
  currentPurchases: Purchase[],
  settings: Settings,
  options: CompareOptions = {}
): CompareResult {
  const progress = Math.min(Math.max(options.progressPct ?? 100, 1), 200) / 100;
  const baseRolls = rollupByMaterial(basePurchases);
  const curRolls = rollupByMaterial(currentPurchases);
  const baseByKey = new Map(baseRolls.map((r) => [r.materialKey, r]));
  const curByKey = new Map(curRolls.map((r) => [r.materialKey, r]));

  const baseArea = base.area_sqft > 0 ? base.area_sqft : 1;
  const curArea = current.area_sqft > 0 ? current.area_sqft : 1;
  const areaRatio = curArea / baseArea;

  const rows: MaterialComparison[] = [];

  for (const cur of curRolls) {
    const def = material(cur.materialKey);
    const b = baseByKey.get(cur.materialKey);

    if (!b || b.qty <= 0 || b.avgRate <= 0) {
      rows.push({
        materialKey: cur.materialKey,
        label: def.label,
        unit: cur.unit,
        lumpSum: !!def.lumpSum,
        base: { qty: 0, amount: 0, avgRate: 0, perArea: 0 },
        current: {
          qty: cur.qty,
          amount: cur.amount,
          avgRate: cur.avgRate,
          perArea: cur.qty / curArea,
        },
        yearsApart: 0,
        driftPct: driftFor(cur.materialKey, settings.inflation_pct),
        fairRate: 0,
        ratePremiumPct: 0,
        rawRatePct: 0,
        expectedQty: 0,
        qtyOverrunPct: 0,
        expectedSpend: 0,
        actualSpend: cur.amount,
        excessFromRate: 0,
        excessFromQty: 0,
        excessTotal: 0,
        verdict: "new",
        reasons: ["Not bought on the baseline build — nothing to compare the price against yet."],
        });
      continue;
    }

    const driftPct = driftFor(cur.materialKey, settings.inflation_pct);
    const yearsApart = yearsBetween(b.weightedDate, cur.weightedDate);
    // A lump sum is one "lot" whatever the house size, so the size adjustment
    // belongs on its price, not on its quantity. Without this, a bigger house's
    // bigger wiring contract would read as an overcharge on its own.
    const sizeOnRate = def.lumpSum ? areaRatio : 1;
    const fairRate = b.avgRate * Math.pow(1 + driftPct / 100, yearsApart) * sizeOnRate;
    const ratePremiumPct = fairRate > 0 ? ((cur.avgRate - fairRate) / fairRate) * 100 : 0;
    const rawRatePct = ((cur.avgRate - b.avgRate) / b.avgRate) * 100;

    const expectedQty = b.qty * (def.lumpSum ? 1 : areaRatio) * progress;
    const qtyOverrunPct = expectedQty > 0 ? ((cur.qty - expectedQty) / expectedQty) * 100 : 0;

    const excessFromRate = (cur.avgRate - fairRate) * cur.qty;
    const excessFromQty = (cur.qty - expectedQty) * fairRate;
    const expectedSpend = expectedQty * fairRate;

    const verdict = verdictFor(ratePremiumPct, qtyOverrunPct, settings);
    const reasons: string[] = [];

    if (verdict === "alert" || verdict === "watch") {
      reasons.push(
        `Paying ${cur.avgRate.toFixed(2)} per ${cur.unit} where last build's rate, aged ` +
          `${yearsApart.toFixed(1)} yr at ${driftPct}%/yr, works out to ${fairRate.toFixed(2)}.`
      );
    }
    if (verdict === "cheaper") {
      reasons.push(`Rate is below the inflation-adjusted price of the last build. Nothing to chase here.`);
    } else if (ratePremiumPct <= settings.watch_pct && qtyOverrunPct > settings.qty_watch_pct) {
      reasons.push(`The rate itself is fair — the money is going out on quantity, not price.`);
    }
    if (qtyOverrunPct > settings.qty_watch_pct) {
      reasons.push(
        `Using ${qtyOverrunPct.toFixed(0)}% more than the last build needed for this floor area ` +
          `(${(cur.qty / curArea).toFixed(3)} vs ${(b.qty / baseArea).toFixed(3)} ${cur.unit} per sq.ft). ` +
          `Check delivery slips against what actually reached the site.`
      );
    }
    if (cur.minRate > 0 && cur.maxRate / cur.minRate > 1.15) {
      reasons.push(
        `Same material billed between ${cur.minRate.toFixed(2)} and ${cur.maxRate.toFixed(2)} on this build — ` +
          `ask why the same thing has two prices.`
      );
    }
    if (def.lumpSum) {
      reasons.push(`Lump-sum item: judge the total, not the unit rate.`);
    }

    rows.push({
      materialKey: cur.materialKey,
      label: def.label,
      unit: cur.unit,
      lumpSum: !!def.lumpSum,
      base: { qty: b.qty, amount: b.amount, avgRate: b.avgRate, perArea: b.qty / baseArea },
      current: { qty: cur.qty, amount: cur.amount, avgRate: cur.avgRate, perArea: cur.qty / curArea },
      yearsApart,
      driftPct,
      fairRate,
      ratePremiumPct,
      rawRatePct,
      expectedQty,
      qtyOverrunPct,
      expectedSpend,
      actualSpend: cur.amount,
      excessFromRate,
      excessFromQty,
      excessTotal: excessFromRate + excessFromQty,
      verdict,
      reasons,
    });
  }

  rows.sort((a, b) => b.excessTotal - a.excessTotal);

  const comparable = rows.filter((r) => r.verdict !== "new");
  const totals = {
    baseSpend: baseRolls.reduce((s, r) => s + r.amount, 0),
    currentSpend: curRolls.reduce((s, r) => s + r.amount, 0),
    comparableSpend: comparable.reduce((s, r) => s + r.actualSpend, 0),
    expectedSpend: comparable.reduce((s, r) => s + r.expectedSpend, 0),
    excessFromRate: comparable.reduce((s, r) => s + r.excessFromRate, 0),
    excessFromQty: comparable.reduce((s, r) => s + r.excessFromQty, 0),
    excessTotal: comparable.reduce((s, r) => s + r.excessTotal, 0),
    excessFromRatePositive: comparable.reduce((s, r) => s + Math.max(r.excessFromRate, 0), 0),
    excessFromQtyPositive: comparable.reduce((s, r) => s + Math.max(r.excessFromQty, 0), 0),
    uncomparableSpend: rows.filter((r) => r.verdict === "new").reduce((s, r) => s + r.actualSpend, 0),
    basePerSqft: baseRolls.reduce((s, r) => s + r.amount, 0) / baseArea,
    currentPerSqft: curRolls.reduce((s, r) => s + r.amount, 0) / curArea,
    alerts: rows.filter((r) => r.verdict === "alert").length,
    watches: rows.filter((r) => r.verdict === "watch").length,
  };

  return {
    base,
    current,
    areaRatio,
    rows,
    notBoughtYet: baseRolls.filter((r) => !curByKey.has(r.materialKey)),
    totals,
  };
}
