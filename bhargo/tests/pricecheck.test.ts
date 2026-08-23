import test from "node:test";
import assert from "node:assert/strict";

import { checkAgainstUsual, overspendTotal } from "../src/lib/pricecheck";
import { DEFAULT_SETTINGS, type PriceEntry } from "../src/lib/types";

const settings = { ...DEFAULT_SETTINGS, watch_pct: 8, alert_pct: 20 };

const usualCement: PriceEntry = {
  material_key: "cement",
  unit: "bag (50kg)",
  usual_rate: 950,
  note: null,
  updated_at: "2026-05-01T00:00:00.000Z",
  updated_by: null,
};

test("a rate near the usual price passes without noise", () => {
  const check = checkAgainstUsual("cement", 980, 100, usualCement, settings);

  assert.equal(check.verdict, "fair");
  assert.ok(check.diffPct > 0 && check.diffPct < 8);
  assert.match(check.message, /About the usual/);
});

test("a rate well above the usual price says so, with the money at stake", () => {
  const check = checkAgainstUsual("cement", 1150, 344, usualCement, settings);

  assert.equal(check.verdict, "far-over");
  assert.ok(Math.abs(check.diffPct - 21.05) < 0.1, `diff was ${check.diffPct}`);
  assert.equal(check.diffPerUnit, 200);
  assert.equal(check.diffTotal, 68_800);
  assert.match(check.message, /Ask before paying/);
});

test("between the two thresholds it is a question, not an accusation", () => {
  const check = checkAgainstUsual("cement", 1050, 10, usualCement, settings);

  assert.equal(check.verdict, "over");
  assert.doesNotMatch(check.message, /Ask before paying/);
});

test("a rate far under the usual price is flagged too", () => {
  const check = checkAgainstUsual("cement", 700, 100, usualCement, settings);

  assert.equal(check.verdict, "under");
  assert.ok(check.diffTotal < 0);
  assert.match(check.message, /under the usual/);
  assert.match(check.message, /grade and the quantity/);
});

test("with no usual price set, nothing is claimed", () => {
  const check = checkAgainstUsual("cement", 1150, 100, undefined, settings);

  assert.equal(check.verdict, "no-benchmark");
  assert.equal(check.usualRate, null);
  assert.equal(check.diffTotal, 0);
  assert.match(check.message, /No usual price set/);
});

test("a usual price of zero is treated as not set, not as a free material", () => {
  const check = checkAgainstUsual("cement", 1150, 100, { ...usualCement, usual_rate: 0 }, settings);
  assert.equal(check.verdict, "no-benchmark");
});

test("the running total counts only what is above the usual price", () => {
  const over = checkAgainstUsual("cement", 1150, 100, usualCement, settings);
  const under = checkAgainstUsual("cement", 700, 100, usualCement, settings);

  assert.equal(overspendTotal([over, under]), 20_000); // the saving does not cancel the overcharge
});
