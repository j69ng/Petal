import test from "node:test";
import assert from "node:assert/strict";

import { compareProjects, rollupByMaterial, yearsBetween } from "../src/lib/variance";
import { DEFAULT_SETTINGS, type Project, type Purchase } from "../src/lib/types";

const settings = { ...DEFAULT_SETTINGS, inflation_pct: 6, watch_pct: 8, alert_pct: 20, qty_watch_pct: 10 };

const oldHouse: Project = {
  id: 1, name: "First house", site: null, area_sqft: 1000,
  started_on: "2023-01-01", ended_on: "2023-12-01", status: "done", notes: null,
};
const newHouse: Project = {
  id: 2, name: "Second house", site: null, area_sqft: 2000,
  started_on: "2026-01-01", ended_on: null, status: "active", notes: null,
};

function purchase(over: Partial<Purchase>): Purchase {
  return {
    id: 1, project_id: 1, material_key: "cement", unit: "bag (50kg)", qty: 100, rate: 800,
    freight: 0, vendor: "Vendor A", invoice_no: "1", purchased_on: "2023-01-01", note: null,
    status: "approved", entered_by: null, reviewed_by: null, reviewed_at: null, review_note: null,
    ...over,
  };
}

test("rollup uses landed cost and weights the purchase date by spend", () => {
  const [roll] = rollupByMaterial([
    purchase({ id: 1, qty: 10, rate: 100, freight: 100, purchased_on: "2023-01-01" }),
    purchase({ id: 2, qty: 90, rate: 100, freight: 900, purchased_on: "2023-12-31" }),
  ]);

  assert.equal(roll.qty, 100);
  assert.equal(roll.amount, 11_000); // 1,000 + 100 freight + 9,000 + 900 freight
  assert.equal(roll.avgRate, 110);
  // 90% of the money went out in December, so the weighted date sits there.
  assert.ok(roll.weightedDate > "2023-11-01", `weighted date was ${roll.weightedDate}`);
});

test("a rate that rose exactly at market drift is not flagged", () => {
  const years = yearsBetween("2023-06-01", "2026-06-01");
  const drift = 5; // cement's own drift from the catalog
  const fair = 800 * Math.pow(1 + drift / 100, years);

  const result = compareProjects(
    oldHouse,
    [purchase({ id: 1, project_id: 1, qty: 400, rate: 800, purchased_on: "2023-06-01" })],
    newHouse,
    [purchase({ id: 2, project_id: 2, qty: 800, rate: fair, purchased_on: "2026-06-01" })],
    settings
  );

  const cement = result.rows.find((r) => r.materialKey === "cement")!;
  assert.equal(cement.verdict, "ok");
  assert.ok(Math.abs(cement.excessFromRate) < 1, `rate excess was ${cement.excessFromRate}`);
  // Twice the house, twice the cement, same intensity — no quantity excess either.
  assert.ok(Math.abs(cement.excessFromQty) < 1, `qty excess was ${cement.excessFromQty}`);
  assert.ok(Math.abs(result.totals.excessTotal) < 1);
});

test("naive comparison would blame inflation for an overcharge the engine still catches", () => {
  const result = compareProjects(
    oldHouse,
    [purchase({ id: 1, project_id: 1, qty: 400, rate: 800, purchased_on: "2023-06-01" })],
    newHouse,
    [purchase({ id: 2, project_id: 2, qty: 800, rate: 1200, purchased_on: "2026-06-01" })],
    settings
  );

  const cement = result.rows.find((r) => r.materialKey === "cement")!;
  assert.equal(cement.verdict, "alert");
  assert.ok(cement.rawRatePct > cement.ratePremiumPct); // inflation explains part of it, not all
  assert.ok(cement.ratePremiumPct > 20, `premium was ${cement.ratePremiumPct}`);
  assert.ok(cement.excessFromRate > 200_000, `rate excess was ${cement.excessFromRate}`);
  assert.match(cement.reasons.join(" "), /aged/);
});

test("quantity inflation is caught even when the rate is honest", () => {
  const years = yearsBetween("2023-06-01", "2026-06-01");
  const fair = 800 * Math.pow(1.05, years);

  const result = compareProjects(
    oldHouse,
    [purchase({ id: 1, project_id: 1, qty: 400, rate: 800, purchased_on: "2023-06-01" })],
    newHouse,
    // Same honest rate, but 1,040 bags where 800 would match last build's intensity.
    [purchase({ id: 2, project_id: 2, qty: 1040, rate: fair, purchased_on: "2026-06-01" })],
    settings
  );

  const cement = result.rows.find((r) => r.materialKey === "cement")!;
  // The rate is honest, but 30% more material than the last house needed is
  // still a 30% problem, so the row must not read as fine.
  assert.equal(cement.verdict, "alert");
  assert.ok(Math.abs(cement.excessFromRate) < 1);
  assert.ok(cement.qtyOverrunPct > 29 && cement.qtyOverrunPct < 31, `overrun ${cement.qtyOverrunPct}`);
  assert.ok(cement.excessFromQty > 200_000, `qty excess was ${cement.excessFromQty}`);
  assert.match(cement.reasons.join(" "), /more than the last build needed/);
  assert.match(cement.reasons.join(" "), /rate itself is fair/);
});

test("rate and quantity effects always add back up to the money difference", () => {
  const result = compareProjects(
    oldHouse,
    [
      purchase({ id: 1, project_id: 1, material_key: "cement", qty: 400, rate: 800, purchased_on: "2023-04-01" }),
      purchase({ id: 2, project_id: 1, material_key: "steel", unit: "kg", qty: 4000, rate: 90, purchased_on: "2023-05-01" }),
      purchase({ id: 3, project_id: 1, material_key: "sand", unit: "cft", qty: 3000, rate: 55, freight: 4000, purchased_on: "2023-06-01" }),
    ],
    newHouse,
    [
      purchase({ id: 4, project_id: 2, material_key: "cement", qty: 1040, rate: 1050, purchased_on: "2026-03-01" }),
      purchase({ id: 5, project_id: 2, material_key: "steel", unit: "kg", qty: 8200, rate: 112, purchased_on: "2026-04-01" }),
      purchase({ id: 6, project_id: 2, material_key: "sand", unit: "cft", qty: 6400, rate: 78, freight: 9000, purchased_on: "2026-05-01" }),
      purchase({ id: 7, project_id: 2, material_key: "tiles", unit: "sqft", qty: 900, rate: 95, purchased_on: "2026-06-01" }),
    ],
    settings
  );

  for (const row of result.rows.filter((r) => r.verdict !== "new")) {
    const diff = row.actualSpend - row.expectedSpend;
    assert.ok(
      Math.abs(diff - (row.excessFromRate + row.excessFromQty)) < 0.01,
      `${row.materialKey}: ${diff} != ${row.excessFromRate} + ${row.excessFromQty}`
    );
  }

  const { totals } = result;
  assert.ok(Math.abs(totals.comparableSpend - totals.expectedSpend - totals.excessTotal) < 0.01);
  assert.ok(Math.abs(totals.excessFromRate + totals.excessFromQty - totals.excessTotal) < 0.01);

  // Tiles were never bought on the first house, so they sit outside the comparison.
  const tiles = result.rows.find((r) => r.materialKey === "tiles")!;
  assert.equal(tiles.verdict, "new");
  assert.equal(totals.uncomparableSpend, 900 * 95);
});

test("materials bought last time but not yet this time are reported, not silently dropped", () => {
  const result = compareProjects(
    oldHouse,
    [
      purchase({ id: 1, project_id: 1, material_key: "cement", qty: 400, rate: 800 }),
      purchase({ id: 2, project_id: 1, material_key: "paint", unit: "litre", qty: 200, rate: 400 }),
    ],
    newHouse,
    [purchase({ id: 3, project_id: 2, material_key: "cement", qty: 800, rate: 900, purchased_on: "2026-01-01" })],
    settings
  );

  assert.deepEqual(result.notBoughtYet.map((r) => r.materialKey), ["paint"]);
});

test("a cheaper supplier reads as cheaper, not as a problem", () => {
  const result = compareProjects(
    oldHouse,
    [purchase({ id: 1, project_id: 1, qty: 400, rate: 800, purchased_on: "2023-06-01" })],
    newHouse,
    [purchase({ id: 2, project_id: 2, qty: 800, rate: 700, purchased_on: "2026-06-01" })],
    settings
  );

  const cement = result.rows.find((r) => r.materialKey === "cement")!;
  assert.equal(cement.verdict, "cheaper");
  assert.ok(cement.excessTotal < 0);
});

test("a lump-sum contract is judged per house size, not per lot", () => {
  // Same wiring contractor, house 2x bigger, price 2x bigger plus normal drift.
  const years = yearsBetween("2023-06-01", "2026-06-01");
  const fairLot = 200_000 * Math.pow(1.05, years) * 2;

  const result = compareProjects(
    oldHouse,
    [purchase({ id: 1, project_id: 1, material_key: "wiring", unit: "lot", qty: 1, rate: 200_000, purchased_on: "2023-06-01" })],
    newHouse,
    [purchase({ id: 2, project_id: 2, material_key: "wiring", unit: "lot", qty: 1, rate: fairLot, purchased_on: "2026-06-01" })],
    settings
  );

  const wiring = result.rows.find((r) => r.materialKey === "wiring")!;
  assert.equal(wiring.verdict, "ok");
  assert.ok(Math.abs(wiring.excessTotal) < 1, `excess was ${wiring.excessTotal}`);
});

test("progress scaling asks the softer mid-build question without breaking the arithmetic", () => {
  const purchases = [purchase({ id: 2, project_id: 2, qty: 600, rate: 900, purchased_on: "2026-06-01" })];
  const basePurchases = [purchase({ id: 1, project_id: 1, qty: 400, rate: 800, purchased_on: "2023-06-01" })];

  // Against the finished house (800 bags expected for 2x the area) 600 looks light.
  const full = compareProjects(oldHouse, basePurchases, newHouse, purchases, settings);
  assert.ok(full.rows[0].qtyOverrunPct < 0);

  // At 60% built, the last house would have used ~480 bags by now — 600 is over.
  const staged = compareProjects(oldHouse, basePurchases, newHouse, purchases, settings, { progressPct: 60 });
  assert.ok(staged.rows[0].qtyOverrunPct > 20, `overrun ${staged.rows[0].qtyOverrunPct}`);

  const row = staged.rows[0];
  assert.ok(Math.abs(row.actualSpend - row.expectedSpend - row.excessTotal) < 0.01);
});

test("mid-build headline counts only what is actually over", () => {
  const result = compareProjects(
    oldHouse,
    [
      purchase({ id: 1, project_id: 1, material_key: "cement", qty: 400, rate: 800, purchased_on: "2023-06-01" }),
      purchase({ id: 2, project_id: 1, material_key: "tiles", unit: "sqft", qty: 1000, rate: 80, purchased_on: "2023-09-01" }),
    ],
    newHouse,
    [
      // Cement already past the whole last house, tiles barely started.
      purchase({ id: 3, project_id: 2, material_key: "cement", qty: 1000, rate: 1200, purchased_on: "2026-06-01" }),
      purchase({ id: 4, project_id: 2, material_key: "tiles", unit: "sqft", qty: 200, rate: 85, purchased_on: "2026-06-01" }),
    ],
    settings
  );

  const { totals } = result;
  // Net quantity effect is dragged negative by the unbought tiles...
  assert.ok(totals.excessFromQty < totals.excessFromQtyPositive);
  // ...but the cement overrun still stands on its own.
  assert.ok(totals.excessFromQtyPositive > 0);
  assert.ok(totals.excessFromRatePositive >= totals.excessFromRate);
});
