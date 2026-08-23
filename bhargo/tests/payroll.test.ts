import test from "node:test";
import assert from "node:assert/strict";

import { compareLabour, dailyRateOf, labourSummary, workerLedger } from "../src/lib/payroll";
import { DEFAULT_SETTINGS, type Attendance, type Payment, type Project, type Worker } from "../src/lib/types";

const settings = { ...DEFAULT_SETTINGS, working_days_per_month: 26 };

const mason: Worker = { id: 1, name: "Ram", trade: "mason", wage_type: "daily", rate: 1000, phone: null, active: 1 };
const supervisor: Worker = { id: 2, name: "Shyam", trade: "supervisor", wage_type: "monthly", rate: 26_000, phone: null, active: 1 };

function day(
  id: number,
  worker_id: number,
  work_date: string,
  days = 1,
  ot_hours = 0,
  day_rate: number | null = null
): Attendance {
  return { id, project_id: 1, worker_id, work_date, days, ot_hours, day_rate };
}

test("a monthly salary is divided into day rates by the working-day convention", () => {
  assert.equal(dailyRateOf(mason, settings), 1000);
  assert.equal(dailyRateOf(supervisor, settings), 1000);
  assert.equal(dailyRateOf(supervisor, { ...settings, working_days_per_month: 30 }), 26_000 / 30);
});

test("half days and overtime both land in the ledger", () => {
  const attendance = [day(1, 1, "2026-06-01"), day(2, 1, "2026-06-02", 0.5), day(3, 1, "2026-06-03", 1, 4)];
  const ledger = workerLedger(mason, attendance, [], settings);

  assert.equal(ledger.daysWorked, 2.5);
  assert.equal(ledger.otHours, 4);
  assert.equal(ledger.wageEarned, 2500);
  assert.equal(ledger.otEarned, 4 * (1000 / 8) * 1.5); // 750
  assert.equal(ledger.earned, 3250);
  assert.equal(ledger.balance, 3250);
});

test("advances and wage payments clear the balance; a bonus does not", () => {
  const attendance = [day(1, 1, "2026-06-01"), day(2, 1, "2026-06-02")];
  const payments: Payment[] = [
    { id: 1, worker_id: 1, project_id: 1, paid_on: "2026-06-01", amount: 500, kind: "advance", note: null },
    { id: 2, worker_id: 1, project_id: 1, paid_on: "2026-06-03", amount: 1000, kind: "wage", note: null },
    { id: 3, worker_id: 1, project_id: 1, paid_on: "2026-06-03", amount: 300, kind: "bonus", note: "festival" },
  ];
  const ledger = workerLedger(mason, attendance, payments, settings);

  assert.equal(ledger.earned, 2000);
  assert.equal(ledger.settledAgainstWages, 1500);
  assert.equal(ledger.balance, 500); // still owed
  assert.equal(ledger.bonusPaid, 300);
  assert.equal(ledger.totalPaidOut, 1800);
});

test("a worker who has drawn more than they have worked shows a negative balance", () => {
  const payments: Payment[] = [
    { id: 1, worker_id: 1, project_id: 1, paid_on: "2026-06-01", amount: 5000, kind: "advance", note: null },
  ];
  const ledger = workerLedger(mason, [day(1, 1, "2026-06-01")], payments, settings);
  assert.equal(ledger.balance, -4000);
});

const oldHouse: Project = {
  id: 1, name: "First house", site: null, area_sqft: 1000,
  started_on: "2023-01-01", ended_on: "2023-12-01", status: "done", notes: null,
};
const newHouse: Project = {
  id: 2, name: "Second house", site: null, area_sqft: 2000,
  started_on: "2026-01-01", ended_on: null, status: "active", notes: null,
};

test("labour is summarised per sq.ft so two builds of different size can be compared", () => {
  const summary = labourSummary(
    oldHouse,
    [mason],
    [day(1, 1, "2023-02-01"), day(2, 1, "2023-02-02")],
    settings
  );

  assert.equal(summary.totalDays, 2);
  assert.equal(summary.totalCost, 2000);
  assert.equal(summary.costPerSqft, 2);
  assert.equal(summary.byTrade[0].trade, "mason");
  assert.equal(summary.byTrade[0].avgDayRate, 1000);
});

test("a finished build stays costed at the wages of its own time", () => {
  // The worker earns 1,400 today, but worked the old house at 1,000 a day.
  const masonToday: Worker = { ...mason, rate: 1400 };
  const summary = labourSummary(
    oldHouse,
    [masonToday],
    [day(1, 1, "2023-02-01", 1, 0, 1000), day(2, 1, "2023-02-02", 1, 0, 1000)],
    settings
  );

  assert.equal(summary.totalCost, 2000);
  assert.equal(summary.byTrade[0].avgDayRate, 1000);

  const ledger = workerLedger(masonToday, [day(1, 1, "2023-02-01", 1, 0, 1000)], [], settings);
  assert.equal(ledger.earned, 1000);
});

test("padded muster rolls show up as a days overrun, not a rate problem", () => {
  const base = labourSummary(
    oldHouse,
    [mason],
    Array.from({ length: 100 }, (_, i) =>
      day(i + 1, 1, `2023-03-${String((i % 28) + 1).padStart(2, "0")}`, 1, 0, 1000)
    ),
    settings
  );

  // Measure the gap the same way the engine does, off the project start dates.
  const years =
    (new Date("2026-01-01T00:00:00Z").getTime() - new Date("2023-01-01T00:00:00Z").getTime()) /
    (365.25 * 86_400_000);
  const fairRate = 1000 * Math.pow(1 + settings.inflation_pct / 100, years);
  // Same house intensity would be 200 days for twice the area; 260 are booked.
  const current = labourSummary(
    newHouse,
    [mason],
    Array.from({ length: 260 }, (_, i) => ({
      id: i + 1, project_id: 2, worker_id: 1,
      work_date: `2026-03-${String((i % 28) + 1).padStart(2, "0")}`,
      days: 1, ot_hours: 0, day_rate: fairRate,
    })),
    settings
  );

  const comparison = compareLabour(base, current, settings);
  const row = comparison.rows.find((r) => r.trade === "mason")!;

  // The day rate itself only tracked normal wage rise, so nothing is owed to the
  // rate — but 30% more man-days than the work needed still has to read as a problem.
  assert.equal(row.verdict, "alert");
  assert.ok(Math.abs(row.excessFromRate) < 1, `rate excess ${row.excessFromRate}`);
  assert.ok(row.daysOverrunPct > 29 && row.daysOverrunPct < 31, `overrun ${row.daysOverrunPct}`);
  assert.ok(row.excessFromDays > 0);
  assert.match(row.reasons.join(" "), /muster roll/);

  // And the split still reconciles against the money.
  const diff = row.currentDays * row.currentDayRate - row.expectedDays * row.fairDayRate;
  assert.ok(Math.abs(diff - row.excessTotal) < 0.01);
});
