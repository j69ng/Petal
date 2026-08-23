import test from "node:test";
import assert from "node:assert/strict";

import { detectRedFlags } from "../src/lib/redflags";
import type { Purchase } from "../src/lib/types";

function purchase(over: Partial<Purchase>): Purchase {
  return {
    id: 1, project_id: 1, material_key: "cement", unit: "bag (50kg)", qty: 100, rate: 900,
    freight: 0, vendor: "Shree Traders", invoice_no: "A-1", purchased_on: "2026-03-01", note: null,
    status: "approved", entered_by: null, reviewed_by: null, reviewed_at: null, review_note: null,
    ...over,
  };
}

test("the same bill entered twice within days is flagged", () => {
  const flags = detectRedFlags([
    purchase({ id: 1, purchased_on: "2026-03-01", invoice_no: "A-1" }),
    purchase({ id: 2, purchased_on: "2026-03-04", invoice_no: "A-1" }),
  ]);

  const dup = flags.find((f) => f.kind === "duplicate-bill")!;
  assert.ok(dup);
  assert.equal(dup.severity, "high"); // same invoice number on both
  assert.equal(dup.impact, 90_000);
  assert.deepEqual(dup.purchaseIds, [1, 2]);
});

test("two bills far apart are not treated as duplicates", () => {
  const flags = detectRedFlags([
    purchase({ id: 1, purchased_on: "2026-01-01" }),
    purchase({ id: 2, purchased_on: "2026-06-01" }),
  ]);
  assert.equal(flags.filter((f) => f.kind === "duplicate-bill").length, 0);
});

test("a rate walking upward mid-build is flagged with the money it costs", () => {
  const flags = detectRedFlags([
    purchase({ id: 1, purchased_on: "2026-01-10", rate: 900, qty: 100 }),
    purchase({ id: 2, purchased_on: "2026-02-10", rate: 1100, qty: 200 }),
  ]);

  const jump = flags.find((f) => f.kind === "rate-jump")!;
  assert.ok(jump);
  assert.equal(Math.round(jump.impact!), 40_000); // 200 extra per bag on 200 bags
});

test("one vendor quietly dearer than another is quantified", () => {
  const flags = detectRedFlags([
    purchase({ id: 1, vendor: "Shree Traders", rate: 900, qty: 100, purchased_on: "2026-01-05" }),
    purchase({ id: 2, vendor: "Bharat Supply", rate: 1080, qty: 200, purchased_on: "2026-01-20" }),
  ]);

  const spread = flags.find((f) => f.kind === "vendor-spread")!;
  assert.ok(spread);
  assert.match(spread.title, /Bharat Supply is 20% dearer than Shree Traders/);
  assert.equal(Math.round(spread.impact!), 36_000); // 180 per bag on 200 bags
});

test("big money with no invoice is called out", () => {
  const flags = detectRedFlags([
    purchase({ id: 1, qty: 100, rate: 900, invoice_no: null }),
    purchase({ id: 2, qty: 2, rate: 900, invoice_no: null, purchased_on: "2026-05-01" }),
  ]);

  const missing = flags.filter((f) => f.kind === "no-invoice");
  assert.equal(missing.length, 1); // only the one worth arguing about
  assert.deepEqual(missing[0].purchaseIds, [1]);
});

test("clean books produce no flags", () => {
  const flags = detectRedFlags([
    purchase({ id: 1, vendor: "Shree Traders", rate: 900, purchased_on: "2026-01-05", invoice_no: "A-1" }),
    purchase({ id: 2, vendor: "Shree Traders", rate: 910, purchased_on: "2026-02-05", invoice_no: "A-2" }),
    purchase({ id: 3, vendor: "Shree Traders", rate: 915, purchased_on: "2026-03-05", invoice_no: "A-3" }),
  ]);
  assert.deepEqual(flags, []);
});
