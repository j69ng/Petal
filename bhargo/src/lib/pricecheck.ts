// Comparing builds only works once there is a second build. This works on the
// first bill of the first house: the owner writes down what a material usually
// costs, and every rate is measured against that the moment it is entered.
//
// It answers in both directions on purpose. Paying more than usual is the
// obvious worry. Paying much less is worth a look too — a rate far under the
// going price usually means a different grade, a short load, or a quote that
// will be "corrected" later.

import { material } from "./materials";
import type { PriceEntry, Settings } from "./types";

export type PriceVerdict = "no-benchmark" | "under" | "fair" | "over" | "far-over";

export interface PriceCheck {
  materialKey: string;
  unit: string;
  rate: number;
  usualRate: number | null;
  /** How far the rate sits from the usual price, in percent. */
  diffPct: number;
  /** Difference on one unit. */
  diffPerUnit: number;
  /** Difference across the whole quantity — the money actually at stake. */
  diffTotal: number;
  verdict: PriceVerdict;
  message: string;
}

export function verdictFor(diffPct: number, settings: Settings): PriceVerdict {
  if (diffPct <= -settings.watch_pct) return "under";
  if (diffPct <= settings.watch_pct) return "fair";
  if (diffPct < settings.alert_pct) return "over";
  return "far-over";
}

/**
 * Judge one rate against the usual price. `qty` only scales the money at stake;
 * the verdict itself is about the rate.
 */
export function checkAgainstUsual(
  materialKey: string,
  rate: number,
  qty: number,
  entry: PriceEntry | undefined | null,
  settings: Settings,
  currency = ""
): PriceCheck {
  const unit = entry?.unit || material(materialKey).unit;
  const label = material(materialKey).label;
  const money = (n: number) => `${currency}${currency ? " " : ""}${Math.round(Math.abs(n)).toLocaleString("en-IN")}`;

  if (!entry || entry.usual_rate <= 0) {
    return {
      materialKey,
      unit,
      rate,
      usualRate: null,
      diffPct: 0,
      diffPerUnit: 0,
      diffTotal: 0,
      verdict: "no-benchmark",
      message: `No usual price set for ${label.toLowerCase()} yet, so there is nothing to check this against.`,
    };
  }

  const usualRate = entry.usual_rate;
  const diffPerUnit = rate - usualRate;
  const diffPct = (diffPerUnit / usualRate) * 100;
  const diffTotal = diffPerUnit * qty;
  const verdict = verdictFor(diffPct, settings);

  const messages: Record<PriceVerdict, string> = {
    "no-benchmark": "",
    fair: `About the usual ${money(usualRate)} per ${unit}.`,
    under: `${Math.abs(diffPct).toFixed(0)}% under the usual ${money(usualRate)} per ${unit}${
      qty > 0 ? `, saving ${money(diffTotal)} on this load` : ""
    }. Worth checking the grade and the quantity delivered.`,
    over: `${diffPct.toFixed(0)}% over the usual ${money(usualRate)} per ${unit}${
      qty > 0 ? ` — ${money(diffTotal)} more on this load` : ""
    }.`,
    "far-over": `${diffPct.toFixed(0)}% over the usual ${money(usualRate)} per ${unit}${
      qty > 0 ? ` — ${money(diffTotal)} more on this load` : ""
    }. Ask before paying.`,
  };

  return {
    materialKey,
    unit,
    rate,
    usualRate,
    diffPct,
    diffPerUnit,
    diffTotal,
    verdict,
    message: messages[verdict],
  };
}

/** Money at stake across a set of checks, counting only what is above the usual price. */
export function overspendTotal(checks: PriceCheck[]): number {
  return checks.reduce((sum, c) => sum + Math.max(c.diffTotal, 0), 0);
}
