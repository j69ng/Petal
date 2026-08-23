// Money and number formatting. Amounts are stored as plain numbers in the
// project's own currency — one contractor, one currency, no FX.

export function formatMoney(amount: number, currency = "Rs."): string {
  const sign = amount < 0 ? "-" : "";
  const abs = Math.abs(amount);
  const body = abs.toLocaleString("en-IN", {
    minimumFractionDigits: abs < 100 && abs % 1 !== 0 ? 2 : 0,
    maximumFractionDigits: abs < 100 ? 2 : 0,
  });
  return `${sign}${currency} ${body}`;
}

/** Compact form for headline numbers: 1,25,000 -> 1.25 L */
export function formatShort(amount: number, currency = "Rs."): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";
  if (abs >= 10_000_000) return `${sign}${currency} ${(abs / 10_000_000).toFixed(2)} Cr`;
  if (abs >= 100_000) return `${sign}${currency} ${(abs / 100_000).toFixed(2)} L`;
  if (abs >= 1_000) return `${sign}${currency} ${(abs / 1_000).toFixed(1)} K`;
  return formatMoney(amount, currency);
}

export function formatPct(pct: number, digits = 1): string {
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(digits)}%`;
}

/** Unit rates: paise matter on a 60-rupee cft, not on a 15,000-rupee lot. */
export function formatRate(rate: number): string {
  if (!rate) return "—";
  const digits = Math.abs(rate) < 100 ? 2 : Math.abs(rate) < 1000 ? 1 : 0;
  return rate.toLocaleString("en-IN", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function formatQty(qty: number): string {
  return qty.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
