import test from "node:test";
import assert from "node:assert/strict";

import { bestRateFor, findAlternative, knownRates, savingsReport } from "../src/lib/sourcing";
import { DEFAULT_SETTINGS, type Quote } from "../src/lib/types";

const settings = { ...DEFAULT_SETTINGS, watch_pct: 8, alert_pct: 20 };

function quote(over: Partial<Quote>): Quote {
  return {
    id: 1,
    vendor: "Shree Traders",
    material_key: "cement",
    unit: "bag (50kg)",
    rate: 950,
    min_qty: null,
    delivery_included: 1,
    quoted_on: "2026-08-01",
    valid_until: null,
    note: null,
    entered_by: null,
    ...over,
  };
}

test("the book holds both written quotes and rates already paid", () => {
  const rates = knownRates(
    [quote({ id: 1, vendor: "Shree Traders", rate: 950 })],
    [{ vendor: "Bharat Supply", material_key: "cement", unit: "bag (50kg)", rate: 910, purchased_on: "2026-06-01" }]
  );

  assert.equal(rates.length, 2);
  assert.equal(rates[0].vendor, "Bharat Supply", "cheapest first");
  assert.equal(rates[0].source, "paid-before");
  assert.equal(rates[1].source, "quoted");
});

test("an expired quote is not offered", () => {
  const rates = knownRates(
    [
      quote({ id: 1, vendor: "Old Quote", rate: 800, valid_until: "2026-07-31" }),
      quote({ id: 2, vendor: "Still Good", rate: 900, valid_until: "2026-12-31" }),
    ],
    []
  );

  const best = bestRateFor("cement", rates, { onDate: "2026-08-23" });
  assert.equal(best?.vendor, "Still Good", "the cheaper rate expired three weeks ago");
});

test("a rate that needs a bigger load is not offered for a small one", () => {
  const rates = knownRates(
    [
      quote({ id: 1, vendor: "Bulk Only", rate: 880, min_qty: 500 }),
      quote({ id: 2, vendor: "Any Size", rate: 940 }),
    ],
    []
  );

  assert.equal(bestRateFor("cement", rates, { qty: 100 })?.vendor, "Any Size");
  assert.equal(bestRateFor("cement", rates, { qty: 600 })?.vendor, "Bulk Only");
});

test("a cheaper supplier is named, with the money and where the rate came from", () => {
  const rates = knownRates([quote({ vendor: "Bharat Supply", rate: 950 })], []);
  const found = findAlternative(
    { materialKey: "cement", rate: 1200, qty: 344, vendor: "Shree Traders", onDate: "2026-08-23" },
    rates,
    settings,
    "Rs."
  );

  assert.ok(found);
  assert.equal(found.best.vendor, "Bharat Supply");
  assert.ok(Math.abs(found.cheaperByPct - 20.83) < 0.1, `cheaper by ${found.cheaperByPct}`);
  assert.equal(found.savingOnThisLoad, 250 * 344);
  assert.match(found.message, /Bharat Supply is 21% cheaper/);
  assert.match(found.message, /save Rs. 86,000/);
  assert.match(found.message, /quoted Rs. 950 per bag \(50kg\) on 2026-08-01/);
});

test("the vendor already being used is never suggested as the alternative", () => {
  const rates = knownRates([quote({ vendor: "Shree Traders", rate: 950 })], []);
  const found = findAlternative(
    { materialKey: "cement", rate: 1200, qty: 100, vendor: "shree traders" },
    rates,
    settings
  );

  assert.equal(found, null, "matching on name should ignore case");
});

test("a few rupees apart is not worth anyone's time", () => {
  const rates = knownRates([quote({ vendor: "Bharat Supply", rate: 970 })], []);
  const found = findAlternative({ materialKey: "cement", rate: 1000, qty: 100, vendor: "Shree" }, rates, settings);

  assert.equal(found, null, "3% is noise, not a finding");
});

test("nothing is claimed when the book has no rate for that material", () => {
  const rates = knownRates([quote({ material_key: "cement" })], []);
  const found = findAlternative({ materialKey: "steel", rate: 200, qty: 1000 }, rates, settings);

  assert.equal(found, null);
});

test("a quote conditional on a big load says so", () => {
  const rates = knownRates([quote({ vendor: "Bulk Only", rate: 900, min_qty: 300, delivery_included: 0 })], []);
  const found = findAlternative({ materialKey: "cement", rate: 1150, qty: 400 }, rates, settings, "Rs.");

  assert.match(found!.message, /needs at least 300/);
  assert.match(found!.message, /Delivery is not included/);
});

test("the savings report ranks materials by money left on the table", () => {
  const rates = knownRates(
    [
      quote({ id: 1, vendor: "Bharat Supply", material_key: "cement", rate: 950 }),
      quote({ id: 2, vendor: "Gopal Suppliers", material_key: "sand", unit: "cft", rate: 68 }),
      quote({ id: 3, vendor: "Cheap Steel", material_key: "steel", unit: "kg", rate: 117 }),
    ],
    []
  );

  const report = savingsReport(
    [
      { material_key: "cement", unit: "bag (50kg)", qty: 1144, rate: 1080, freight: 14_000, vendor: "Shree Traders" },
      { material_key: "sand", unit: "cft", qty: 4300, rate: 86, freight: 0, vendor: "Krishna Sand" },
      { material_key: "steel", unit: "kg", qty: 7800, rate: 118, freight: 0, vendor: "Bharat Steel" },
    ],
    rates,
    settings
  );

  assert.equal(report.lines[0].materialKey, "cement", "biggest saving first");
  assert.ok(report.lines[0].saving > 150_000);
  assert.equal(report.lines[0].best.vendor, "Bharat Supply");

  // Steel is under 1% cheaper elsewhere, so it is left out rather than padding the list.
  assert.ok(!report.lines.some((line) => line.materialKey === "steel"));
  assert.ok(Math.abs(report.total - report.lines.reduce((s, l) => s + l.saving, 0)) < 0.01);
});

test("nothing to save reports nothing rather than inventing a saving", () => {
  const rates = knownRates([quote({ vendor: "Bharat Supply", rate: 1200 })], []);
  const report = savingsReport(
    [{ material_key: "cement", unit: "bag (50kg)", qty: 100, rate: 900, freight: 0, vendor: "Shree" }],
    rates,
    settings
  );

  assert.deepEqual(report.lines, []);
  assert.equal(report.total, 0);
});
