// Checks that need only one build's own bills — no baseline required. These
// catch the things that don't show up in a rate comparison: the same bill
// entered twice, one vendor quietly dearer than the other, a rate that walks
// upward mid-build, big money with no invoice behind it.

import { material } from "./materials";
import { lineAmount } from "./variance";
import type { Purchase } from "./types";

export type FlagKind =
  | "duplicate-bill"
  | "rate-jump"
  | "vendor-spread"
  | "rate-outlier"
  | "no-invoice";

export type Severity = "high" | "medium" | "low";

export interface RedFlag {
  kind: FlagKind;
  severity: Severity;
  materialKey: string;
  title: string;
  detail: string;
  /** Money at stake, where it can be put to a number. */
  impact: number | null;
  purchaseIds: number[];
}

const DAY_MS = 86_400_000;
const days = (a: string, b: string) =>
  Math.abs(new Date(`${a}T00:00:00Z`).getTime() - new Date(`${b}T00:00:00Z`).getTime()) / DAY_MS;

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function byMaterial(purchases: Purchase[]): Map<string, Purchase[]> {
  const groups = new Map<string, Purchase[]>();
  for (const p of purchases) {
    const list = groups.get(p.material_key);
    if (list) list.push(p);
    else groups.set(p.material_key, [p]);
  }
  return groups;
}

/** Same vendor, same material, same amount, days apart — usually one bill entered twice, sometimes billed twice. */
function duplicateBills(purchases: Purchase[]): RedFlag[] {
  const flags: RedFlag[] = [];
  const seen = new Map<string, Purchase[]>();
  for (const p of purchases) {
    const key = `${p.vendor.trim().toLowerCase()}|${p.material_key}|${Math.round(lineAmount(p))}`;
    const list = seen.get(key);
    if (list) list.push(p);
    else seen.set(key, [p]);
  }

  for (const group of seen.values()) {
    if (group.length < 2) continue;
    const sorted = [...group].sort((a, b) => a.purchased_on.localeCompare(b.purchased_on));
    for (let i = 1; i < sorted.length; i++) {
      const gap = days(sorted[i - 1].purchased_on, sorted[i].purchased_on);
      if (gap > 10) continue;
      const sameInvoice =
        !!sorted[i].invoice_no && sorted[i].invoice_no === sorted[i - 1].invoice_no;
      flags.push({
        kind: "duplicate-bill",
        severity: sameInvoice ? "high" : "medium",
        materialKey: sorted[i].material_key,
        title: `Possible double billing — ${material(sorted[i].material_key).label}`,
        detail:
          `${sorted[i].vendor} billed the same amount twice for the same material ` +
          `${gap === 0 ? "on the same day" : `${gap.toFixed(0)} day(s) apart`} ` +
          `(${sorted[i - 1].purchased_on} and ${sorted[i].purchased_on})` +
          (sameInvoice ? `, both under invoice ${sorted[i].invoice_no}.` : `.`) +
          ` If only one delivery arrived, one of these should not be paid.`,
        impact: lineAmount(sorted[i]),
        purchaseIds: [sorted[i - 1].id, sorted[i].id],
      });
    }
  }
  return flags;
}

/** One vendor's rate climbing during a single build, faster than a few months of market drift explains. */
function rateJumps(purchases: Purchase[], jumpPct = 12): RedFlag[] {
  const flags: RedFlag[] = [];
  const groups = new Map<string, Purchase[]>();
  for (const p of purchases) {
    if (p.qty <= 0) continue;
    const key = `${p.material_key}|${p.vendor.trim().toLowerCase()}`;
    const list = groups.get(key);
    if (list) list.push(p);
    else groups.set(key, [p]);
  }

  for (const group of groups.values()) {
    const sorted = [...group].sort((a, b) => a.purchased_on.localeCompare(b.purchased_on));
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const cur = sorted[i];
      const prevRate = lineAmount(prev) / prev.qty;
      const curRate = lineAmount(cur) / cur.qty;
      if (prevRate <= 0) continue;
      const changePct = ((curRate - prevRate) / prevRate) * 100;
      const gap = days(prev.purchased_on, cur.purchased_on);
      if (changePct < jumpPct || gap > 120) continue;
      flags.push({
        kind: "rate-jump",
        severity: changePct >= 25 ? "high" : "medium",
        materialKey: cur.material_key,
        title: `${material(cur.material_key).label} rate rose ${changePct.toFixed(0)}% mid-build`,
        detail:
          `${cur.vendor} charged ${prevRate.toFixed(2)} per ${cur.unit} on ${prev.purchased_on} and ` +
          `${curRate.toFixed(2)} on ${cur.purchased_on} — ${gap.toFixed(0)} days later. ` +
          `Ask for the reason in writing before the next load.`,
        impact: (curRate - prevRate) * cur.qty,
        purchaseIds: [prev.id, cur.id],
      });
    }
  }
  return flags;
}

/** Two vendors, same material, same build, different prices — the gap is money left on the table. */
function vendorSpread(purchases: Purchase[], spreadPct = 10): RedFlag[] {
  const flags: RedFlag[] = [];
  for (const [key, lines] of byMaterial(purchases)) {
    const byVendor = new Map<string, { qty: number; amount: number; ids: number[]; name: string }>();
    for (const l of lines) {
      if (l.qty <= 0) continue;
      const vendorKey = l.vendor.trim().toLowerCase();
      const acc = byVendor.get(vendorKey) ?? { qty: 0, amount: 0, ids: [], name: l.vendor };
      acc.qty += l.qty;
      acc.amount += lineAmount(l);
      acc.ids.push(l.id);
      byVendor.set(vendorKey, acc);
    }
    if (byVendor.size < 2) continue;

    const rates = Array.from(byVendor.values()).map((v) => ({ ...v, rate: v.amount / v.qty }));
    const cheapest = rates.reduce((a, b) => (a.rate <= b.rate ? a : b));
    const dearest = rates.reduce((a, b) => (a.rate >= b.rate ? a : b));
    const gapPct = ((dearest.rate - cheapest.rate) / cheapest.rate) * 100;
    if (gapPct < spreadPct) continue;

    const overpaid = rates
      .filter((v) => v.rate > cheapest.rate)
      .reduce((sum, v) => sum + (v.rate - cheapest.rate) * v.qty, 0);

    flags.push({
      kind: "vendor-spread",
      severity: gapPct >= 25 ? "high" : "low",
      materialKey: key,
      title: `${material(key).label}: ${dearest.name} is ${gapPct.toFixed(0)}% dearer than ${cheapest.name}`,
      detail:
        `${cheapest.name} supplied at ${cheapest.rate.toFixed(2)} per unit, ${dearest.name} at ` +
        `${dearest.rate.toFixed(2)} on the same build. Buying it all at the cheaper rate would have ` +
        `saved this much.`,
      impact: overpaid,
      purchaseIds: rates.flatMap((v) => v.ids),
    });
  }
  return flags;
}

/** A single bill priced well above the rest of the same material on the same build. */
function rateOutliers(purchases: Purchase[], outlierPct = 20): RedFlag[] {
  const flags: RedFlag[] = [];
  for (const [key, lines] of byMaterial(purchases)) {
    const priced = lines.filter((l) => l.qty > 0);
    if (priced.length < 3) continue;
    const rates = priced.map((l) => lineAmount(l) / l.qty);
    const mid = median(rates);
    if (mid <= 0) continue;

    priced.forEach((l, i) => {
      const overPct = ((rates[i] - mid) / mid) * 100;
      if (overPct < outlierPct) return;
      flags.push({
        kind: "rate-outlier",
        severity: overPct >= 40 ? "high" : "medium",
        materialKey: key,
        title: `One ${material(key).label} bill is ${overPct.toFixed(0)}% above the rest`,
        detail:
          `${l.vendor} billed ${rates[i].toFixed(2)} per ${l.unit} on ${l.purchased_on}, against a ` +
          `typical ${mid.toFixed(2)} on this build.`,
        impact: (rates[i] - mid) * l.qty,
        purchaseIds: [l.id],
      });
    });
  }
  return flags;
}

/** Large payments with no invoice number recorded — the ones that are hardest to dispute later. */
function missingInvoices(purchases: Purchase[]): RedFlag[] {
  const total = purchases.reduce((s, p) => s + lineAmount(p), 0);
  if (total <= 0) return [];
  const threshold = total * 0.03;

  return purchases
    .filter((p) => !p.invoice_no?.trim() && lineAmount(p) >= threshold)
    .map((p) => ({
      kind: "no-invoice" as const,
      severity: "low" as const,
      materialKey: p.material_key,
      title: `No bill on record — ${material(p.material_key).label}`,
      detail:
        `${p.vendor} was paid for ${p.qty} ${p.unit} on ${p.purchased_on} with no invoice number ` +
        `recorded. Without paper you cannot argue the rate later.`,
      impact: null,
      purchaseIds: [p.id],
    }));
}

const SEVERITY_ORDER: Record<Severity, number> = { high: 0, medium: 1, low: 2 };

/** Everything above, worst first. */
export function detectRedFlags(purchases: Purchase[]): RedFlag[] {
  const flags = [
    ...duplicateBills(purchases),
    ...rateJumps(purchases),
    ...vendorSpread(purchases),
    ...rateOutliers(purchases),
    ...missingInvoices(purchases),
  ];

  return flags.sort((a, b) => {
    const bySeverity = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (bySeverity !== 0) return bySeverity;
    return (b.impact ?? 0) - (a.impact ?? 0);
  });
}

export function flagImpactTotal(flags: RedFlag[]): number {
  return flags.reduce((sum, f) => sum + (f.impact ?? 0), 0);
}
