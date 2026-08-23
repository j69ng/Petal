// "Am I being overcharged?" is only half a question. The useful half is "and who
// should I ring instead?" — which needs somewhere to keep what other suppliers
// have said they will charge.
//
// Two sources feed that, and neither needs anything from outside the company:
//
//   1. Quotes someone wrote down — a phone call, a rate list, a WhatsApp message.
//   2. What each vendor has actually been paid on confirmed bills. Every load
//      bought is evidence of what that supplier accepts, so the book fills
//      itself from work already being done.
//
// A quote nobody collected is a quote nobody can act on: the software cannot go
// and find local rates on its own. What it can do is make sure a rate collected
// once is never forgotten, and is put in front of whoever is about to pay more.

import { material } from "./materials";
import type { Quote, Settings } from "./types";

export type QuoteSource = "quoted" | "paid-before";

export interface KnownRate {
  vendor: string;
  materialKey: string;
  unit: string;
  rate: number;
  source: QuoteSource;
  /** When the rate was quoted, or the date of the bill it came from. */
  asOf: string;
  validUntil: string | null;
  minQty: number | null;
  deliveryIncluded: boolean;
  note: string | null;
}

export interface Alternative {
  materialKey: string;
  unit: string;
  /** What is being paid, delivered. */
  payingRate: number;
  currentVendor: string | null;
  best: KnownRate;
  /** How much lower the best known rate is, in percent. */
  cheaperByPct: number;
  /** Money saved on this quantity by buying at the better rate. */
  savingOnThisLoad: number;
  message: string;
}

function isExpired(rate: KnownRate, onDate: string): boolean {
  return !!rate.validUntil && rate.validUntil < onDate;
}

/** Written-down quotes and rates actually paid, as one list. */
export function knownRates(
  quotes: Quote[],
  paid: { vendor: string; material_key: string; unit: string; rate: number; purchased_on: string }[]
): KnownRate[] {
  const fromQuotes: KnownRate[] = quotes.map((q) => ({
    vendor: q.vendor,
    materialKey: q.material_key,
    unit: q.unit,
    rate: q.rate,
    source: "quoted",
    asOf: q.quoted_on,
    validUntil: q.valid_until,
    minQty: q.min_qty,
    deliveryIncluded: q.delivery_included === 1,
    note: q.note,
  }));

  const fromBills: KnownRate[] = paid.map((p) => ({
    vendor: p.vendor,
    materialKey: p.material_key,
    unit: p.unit,
    rate: p.rate,
    source: "paid-before",
    asOf: p.purchased_on,
    validUntil: null,
    minQty: null,
    // A bill's rate is the landed cost, so delivery is in it by definition.
    deliveryIncluded: true,
    note: null,
  }));

  return [...fromQuotes, ...fromBills].sort((a, b) => a.rate - b.rate);
}

/**
 * The cheapest rate on the books for a material that could actually be used:
 * not expired, and not conditional on a bigger load than the one being bought.
 */
export function bestRateFor(
  materialKey: string,
  rates: KnownRate[],
  options: { qty?: number; onDate?: string; excludeVendor?: string } = {}
): KnownRate | null {
  const onDate = options.onDate ?? new Date().toISOString().slice(0, 10);
  const usable = rates.filter(
    (rate) =>
      rate.materialKey === materialKey &&
      rate.rate > 0 &&
      !isExpired(rate, onDate) &&
      (!rate.minQty || !options.qty || options.qty >= rate.minQty) &&
      (!options.excludeVendor || rate.vendor.toLowerCase() !== options.excludeVendor.toLowerCase())
  );

  return usable.length ? usable.reduce((a, b) => (a.rate <= b.rate ? a : b)) : null;
}

/**
 * Is someone else cheaper than what is about to be paid? Answers with the
 * vendor's name and the money, or with nothing when there is nothing to say.
 */
export function findAlternative(
  input: { materialKey: string; rate: number; qty: number; vendor?: string | null; onDate?: string },
  rates: KnownRate[],
  settings: Settings,
  currency = ""
): Alternative | null {
  const best = bestRateFor(input.materialKey, rates, {
    qty: input.qty,
    onDate: input.onDate,
    excludeVendor: input.vendor ?? undefined,
  });

  if (!best || input.rate <= 0) return null;

  const cheaperByPct = ((input.rate - best.rate) / input.rate) * 100;
  // Below the watch threshold it is noise — every supplier is a rupee apart.
  if (cheaperByPct < settings.watch_pct) return null;

  const savingOnThisLoad = (input.rate - best.rate) * input.qty;
  const money = (n: number) => `${currency}${currency ? " " : ""}${Math.round(n).toLocaleString("en-IN")}`;
  const label = material(input.materialKey).label.toLowerCase();

  const provenance =
    best.source === "quoted"
      ? `quoted ${money(best.rate)} per ${best.unit} on ${best.asOf}`
      : `charged ${money(best.rate)} per ${best.unit} on a bill dated ${best.asOf}`;

  return {
    materialKey: input.materialKey,
    unit: best.unit,
    payingRate: input.rate,
    currentVendor: input.vendor ?? null,
    best,
    cheaperByPct,
    savingOnThisLoad,
    message:
      `${best.vendor} is ${cheaperByPct.toFixed(0)}% cheaper on ${label} — ${provenance}. ` +
      `Buying this load there instead would save ${money(savingOnThisLoad)}.` +
      (best.minQty ? ` That rate needs at least ${best.minQty} ${best.unit}.` : "") +
      (best.deliveryIncluded ? "" : " Delivery is not included in that rate."),
  };
}

export interface SavingLine {
  materialKey: string;
  unit: string;
  qty: number;
  paidRate: number;
  paidTotal: number;
  best: KnownRate;
  bestTotal: number;
  saving: number;
  savingPct: number;
}

/**
 * What buying everything at the best known rate would have saved. This is the
 * number that turns a supplier conversation into a decision — and the number
 * worth showing a contractor before they sign next month's orders.
 */
export function savingsReport(
  purchases: { material_key: string; unit: string; qty: number; rate: number; freight: number; vendor: string }[],
  rates: KnownRate[],
  settings: Settings
): { lines: SavingLine[]; total: number } {
  const byMaterial = new Map<string, { qty: number; amount: number; unit: string }>();

  for (const purchase of purchases) {
    if (purchase.qty <= 0) continue;
    const acc = byMaterial.get(purchase.material_key) ?? { qty: 0, amount: 0, unit: purchase.unit };
    acc.qty += purchase.qty;
    acc.amount += purchase.qty * purchase.rate + (purchase.freight ?? 0);
    byMaterial.set(purchase.material_key, acc);
  }

  const lines: SavingLine[] = [];

  for (const [materialKey, totals] of byMaterial) {
    const paidRate = totals.amount / totals.qty;
    const best = bestRateFor(materialKey, rates, { qty: totals.qty });
    if (!best || best.rate >= paidRate) continue;

    const saving = (paidRate - best.rate) * totals.qty;
    const savingPct = ((paidRate - best.rate) / paidRate) * 100;
    if (savingPct < settings.watch_pct) continue;

    lines.push({
      materialKey,
      unit: totals.unit,
      qty: totals.qty,
      paidRate,
      paidTotal: totals.amount,
      best,
      bestTotal: best.rate * totals.qty,
      saving,
      savingPct,
    });
  }

  lines.sort((a, b) => b.saving - a.saving);
  return { lines, total: lines.reduce((sum, line) => sum + line.saving, 0) };
}
