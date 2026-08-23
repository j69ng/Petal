/**
 * Sample data: one finished house and one being built now by the same
 * contractor, three years later. The second build has real problems buried in
 * it — a cement rate that jumped mid-build and quantities well past what the
 * first house needed, sand bought from a dearer second vendor, one bill
 * entered twice, one large payment with no invoice, and mason day rates ahead
 * of normal wage rise. Run `npm run seed`, then open /compare and see whether
 * the numbers find them.
 *
 * Everything here is invented. Replace it with your own books.
 */

import {
  db,
  createProject,
  createWorker,
  createPurchase,
  createPayment,
  markAttendance,
  savePriceEntry,
} from "../src/lib/db";
import type { Draft, PaymentKind, Purchase, RecordStatus } from "../src/lib/types";

const database = db();

// Wipe first so re-seeding doesn't stack duplicates on top of old sample data.
database.exec(
  `delete from attendance; delete from payments; delete from purchases; delete from workers;
   delete from projects; delete from price_book;`
);
database.exec(`delete from sqlite_sequence where name in ('attendance','payments','purchases','workers','projects')`);

// ---------------------------------------------------------------- projects

const houseA = createProject({
  name: "Ram Nagar house",
  site: "Ram Nagar, plot 14",
  area_sqft: 1800,
  started_on: "2023-02-01",
  ended_on: "2023-12-20",
  status: "done",
  notes: "Two floors, finished. This is the build everything else gets measured against.",
});

const houseB = createProject({
  name: "Hill Road house",
  site: "Hill Road, plot 3",
  area_sqft: 2200,
  started_on: "2026-02-01",
  ended_on: null,
  status: "active",
  notes: "Two floors plus terrace room. Structure and masonry done, finishes started.",
});

// ---------------------------------------------------------------- materials

type Line = Draft<Purchase>;

function buy(
  project_id: number,
  material_key: string,
  unit: string,
  qty: number,
  rate: number,
  vendor: string,
  purchased_on: string,
  invoice_no: string | null = null,
  freight = 0,
  note: string | null = null,
  status: RecordStatus = "approved"
): Line {
  return {
    project_id, material_key, unit, qty, rate, freight, vendor, invoice_no, purchased_on, note,
    status,
    entered_by: null,
  };
}

// --- the finished house: 1,800 sq.ft, honest prices for 2023
const houseALines: Line[] = [
  buy(houseA, "cement", "bag (50kg)", 200, 780, "Shree Traders", "2023-03-05", "C-101", 2500),
  buy(houseA, "cement", "bag (50kg)", 260, 780, "Shree Traders", "2023-05-12", "C-140", 3000),
  buy(houseA, "cement", "bag (50kg)", 260, 780, "Shree Traders", "2023-08-02", "C-190", 3000),
  buy(houseA, "steel", "kg", 3000, 92, "Bharat Steel", "2023-03-20", "S-22", 6000),
  buy(houseA, "steel", "kg", 3300, 92, "Bharat Steel", "2023-06-15", "S-58", 6500),
  buy(houseA, "sand", "cft", 1200, 52, "Gopal Suppliers", "2023-03-10", "N-9"),
  buy(houseA, "sand", "cft", 1680, 52, "Gopal Suppliers", "2023-05-25", "N-31"),
  buy(houseA, "aggregate", "cft", 1200, 58, "Gopal Suppliers", "2023-04-01", "N-18"),
  buy(houseA, "aggregate", "cft", 1230, 58, "Gopal Suppliers", "2023-06-05", "N-40"),
  buy(houseA, "bricks", "1000 nos", 7.2, 13500, "Lakshmi Bricks", "2023-04-10", "B-14"),
  buy(houseA, "bricks", "1000 nos", 7.2, 13500, "Lakshmi Bricks", "2023-06-20", "B-33"),
  buy(houseA, "timber", "cft", 90, 2200, "Verma Timber", "2023-08-15", "V-6"),
  buy(houseA, "doors", "nos", 9, 9500, "Verma Timber", "2023-09-01", "V-11"),
  buy(houseA, "windows", "nos", 12, 7800, "Metro Aluminium", "2023-09-05", "M-4"),
  buy(houseA, "plumbing", "lot", 1, 185000, "Sanjay Plumbing", "2023-08-20", "P-2"),
  buy(houseA, "wiring", "lot", 1, 210000, "Volt Electricals", "2023-08-25", "E-3"),
  buy(houseA, "tiles", "sqft", 1400, 82, "Ceramic House", "2023-09-10", "T-7"),
  buy(houseA, "paint", "litre", 180, 400, "Colour Point", "2023-10-05", "CP-9"),
  buy(houseA, "sanitary", "lot", 1, 145000, "Ceramic House", "2023-10-20", "T-19"),
  buy(houseA, "hardware", "lot", 1, 62000, "Shree Traders", "2023-07-01", "C-166"),
];

// --- the house being built now: 2,200 sq.ft (1.22x), 2026 prices
const houseBLines: Line[] = [
  // Cement: starts near fair, then the rate walks up. And the quantity is
  // already past what the whole last house needed, pro-rata for size.
  buy(houseB, "cement", "bag (50kg)", 400, 950, "Shree Traders", "2026-03-05", "C-401", 5000),
  buy(houseB, "cement", "bag (50kg)", 400, 1150, "Shree Traders", "2026-05-10", "C-455", 5000),
  buy(houseB, "cement", "bag (50kg)", 344, 1150, "Shree Traders", "2026-06-18", null, 4000, "No bill given yet", "pending"),
  // Steel: honest. Structure is done, so the quantity is close to final.
  buy(houseB, "steel", "kg", 4000, 118, "Bharat Steel", "2026-03-18", "S-311", 8000),
  buy(houseB, "steel", "kg", 3800, 118, "Bharat Steel", "2026-05-02", "S-355", 7500),
  // Sand: a second, dearer vendor appears, and one bill is entered twice.
  buy(houseB, "sand", "cft", 1500, 68, "Gopal Suppliers", "2026-03-12", "N-201"),
  buy(houseB, "sand", "cft", 1400, 86, "Krishna Sand Supply", "2026-04-20", "K-11"),
  buy(houseB, "sand", "cft", 700, 86, "Krishna Sand Supply", "2026-06-02", "K-33"),
  buy(houseB, "sand", "cft", 700, 86, "Krishna Sand Supply", "2026-06-05", "K-33", 0, "Second copy of the same challan?", "pending"),
  buy(houseB, "aggregate", "cft", 1600, 70, "Gopal Suppliers", "2026-03-25", "N-233"),
  buy(houseB, "aggregate", "cft", 1400, 70, "Gopal Suppliers", "2026-05-15", "N-266"),
  buy(houseB, "bricks", "1000 nos", 9, 15800, "Lakshmi Bricks", "2026-04-05", "B-121"),
  buy(houseB, "bricks", "1000 nos", 8.6, 15800, "Lakshmi Bricks", "2026-06-10", "B-158"),
  buy(houseB, "timber", "cft", 110, 2900, "Verma Timber", "2026-07-02", "V-88"),
  buy(houseB, "doors", "nos", 6, 12500, "Verma Timber", "2026-07-20", "V-94"),
  buy(houseB, "windows", "nos", 14, 9000, "Metro Aluminium", "2026-07-05", "M-51"),
  buy(houseB, "plumbing", "lot", 1, 265000, "Sanjay Plumbing", "2026-06-25", "P-30"),
  buy(houseB, "wiring", "lot", 1, 310000, "Volt Electricals", "2026-06-28", "E-41"),
  buy(houseB, "tiles", "sqft", 900, 88, "Ceramic House", "2026-08-01", "T-95", 0, null, "pending"),
  buy(houseB, "hardware", "lot", 1, 96000, "Shree Traders", "2026-05-20", "C-460"),
  // Not on the last house at all — nothing to compare it against.
  buy(houseB, "marble", "sqft", 320, 210, "Stone Gallery", "2026-08-10", "SG-7", 0, null, "pending"),
];

[...houseALines, ...houseBLines].forEach(createPurchase);

// ---------------------------------------------------------------- people

const people = [
  { name: "Ram Bahadur", trade: "mason", rate2023: 900, rate2026: 1250 },
  { name: "Suresh", trade: "mason", rate2023: 900, rate2026: 1250 },
  { name: "Kali", trade: "helper", rate2023: 550, rate2026: 780 },
  { name: "Bina", trade: "helper", rate2023: 550, rate2026: 780 },
  { name: "Dinesh", trade: "carpenter", rate2023: 1100, rate2026: 1450 },
  { name: "Anil", trade: "electrician", rate2023: 1200, rate2026: 1500 },
  { name: "Rakesh", trade: "plumber", rate2023: 1200, rate2026: 1450 },
];

const workerIds = new Map<string, number>();
for (const p of people) {
  workerIds.set(
    p.name,
    createWorker({ name: p.name, trade: p.trade, wage_type: "daily", rate: p.rate2026, phone: null, active: 1 })
  );
}

// Prakash is on a monthly salary rather than a day rate.
const prakash = createWorker({
  name: "Prakash",
  trade: "supervisor",
  wage_type: "monthly",
  rate: 36000,
  phone: null,
  active: 1,
});

/** Working days between two dates, Sundays off. */
function workingDays(from: string, to: string): string[] {
  const days: string[] = [];
  const cursor = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  while (cursor <= end) {
    if (cursor.getUTCDay() !== 0) days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

const daysA = workingDays("2023-02-06", "2023-12-15");
const daysB = workingDays("2026-02-02", "2026-08-22");

function putIn(project_id: number, worker_id: number, dates: string[], count: number, day_rate: number, otEvery = 0) {
  const chosen = dates.slice(0, count);
  chosen.forEach((work_date, i) => {
    markAttendance({
      project_id,
      worker_id,
      work_date,
      days: 1,
      ot_hours: otEvery > 0 && i % otEvery === 0 ? 3 : 0,
      day_rate,
      // The last week of the running build has not been confirmed yet.
      status: project_id === houseB && i >= chosen.length - 6 ? "pending" : "approved",
      entered_by: null,
    });
  });
}

// First house, at 2023 wages.
putIn(houseA, workerIds.get("Ram Bahadur")!, daysA, 160, 900, 12);
putIn(houseA, workerIds.get("Suresh")!, daysA, 160, 900, 15);
putIn(houseA, workerIds.get("Kali")!, daysA, 170, 550);
putIn(houseA, workerIds.get("Bina")!, daysA, 170, 550);
putIn(houseA, workerIds.get("Dinesh")!, daysA.slice(120), 60, 1100);
putIn(houseA, workerIds.get("Anil")!, daysA.slice(140), 35, 1200);
putIn(houseA, workerIds.get("Rakesh")!, daysA.slice(130), 30, 1200);
putIn(houseA, prakash, daysA, 200, 26000 / 26);

// Current house, at 2026 wages. Mason rates are ahead of normal wage rise.
putIn(houseB, workerIds.get("Ram Bahadur")!, daysB, 150, 1250, 10);
putIn(houseB, workerIds.get("Suresh")!, daysB, 148, 1250, 12);
putIn(houseB, workerIds.get("Kali")!, daysB, 165, 780);
putIn(houseB, workerIds.get("Bina")!, daysB, 160, 780);
putIn(houseB, workerIds.get("Dinesh")!, daysB.slice(110), 45, 1450);
putIn(houseB, workerIds.get("Anil")!, daysB.slice(120), 28, 1500);
putIn(houseB, workerIds.get("Rakesh")!, daysB.slice(115), 26, 1450);
putIn(houseB, prakash, daysB, 175, 36000 / 26);

// ---------------------------------------------------------------- payments

function pay(
  worker: string,
  project_id: number,
  paid_on: string,
  amount: number,
  kind: PaymentKind,
  note?: string,
  status: RecordStatus = "approved"
) {
  createPayment({
    worker_id: worker === "Prakash" ? prakash : workerIds.get(worker)!,
    project_id,
    paid_on,
    amount,
    kind,
    note: note ?? null,
    status,
    entered_by: null,
  });
}

// The first house is settled in full — those balances should read zero-ish.
pay("Ram Bahadur", houseA, "2023-12-20", 148_500, "wage", "Full settlement, Ram Nagar");
pay("Suresh", houseA, "2023-12-20", 147_600, "wage", "Full settlement, Ram Nagar");
pay("Kali", houseA, "2023-12-20", 93_500, "wage", "Full settlement, Ram Nagar");
pay("Bina", houseA, "2023-12-20", 93_500, "wage", "Full settlement, Ram Nagar");
pay("Dinesh", houseA, "2023-12-10", 66_000, "wage", "Full settlement, Ram Nagar");
pay("Anil", houseA, "2023-12-10", 42_000, "wage", "Full settlement, Ram Nagar");
pay("Rakesh", houseA, "2023-12-10", 36_000, "wage", "Full settlement, Ram Nagar");
pay("Prakash", houseA, "2023-12-20", 200_000, "wage", "Full settlement, Ram Nagar");
pay("Ram Bahadur", houseA, "2023-11-05", 5_000, "bonus", "Dashain");
pay("Suresh", houseA, "2023-11-05", 5_000, "bonus", "Dashain");

// The current house is part-paid — weekly draws and a few advances.
const weeklyB: [string, number][] = [
  ["Ram Bahadur", 150_000],
  ["Suresh", 145_000],
  ["Kali", 110_000],
  ["Bina", 108_000],
  ["Dinesh", 50_000],
  ["Anil", 30_000],
  ["Rakesh", 28_000],
  ["Prakash", 190_000],
];
for (const [name, amount] of weeklyB) {
  pay(name, houseB, "2026-05-30", Math.round(amount * 0.6), "wage", "Wages to end May");
  pay(name, houseB, "2026-07-25", Math.round(amount * 0.4), "wage", "Wages to end July");
}
// Both advances are still waiting on the owner.
pay("Kali", houseB, "2026-08-10", 12_000, "advance", "Advance for medical", "pending");
pay("Ram Bahadur", houseB, "2026-08-14", 20_000, "advance", "Advance against August wages", "pending");

// ------------------------------------------------- what things usually cost
//
// The owner's own yardstick. A bill can be judged against this the day it
// arrives, with no second build needed.

const USUAL: [string, string, number, string][] = [
  ["cement", "bag (50kg)", 950, "Market rate, asked three suppliers in May"],
  ["steel", "kg", 118, "Bharat Steel quotation"],
  ["sand", "cft", 70, "Gopal Suppliers, delivered"],
  ["aggregate", "cft", 70, "Gopal Suppliers, delivered"],
  ["bricks", "1000 nos", 15800, "Lakshmi Bricks, last load"],
  ["timber", "cft", 2650, "Verma Timber, seasoned sal"],
  ["tiles", "sqft", 90, "Ceramic House, mid range"],
  ["paint", "litre", 470, "Colour Point, exterior"],
  ["doors", "nos", 11000, "Flush door with frame"],
  ["windows", "nos", 9000, "Aluminium, glazed"],
  ["marble", "sqft", 185, "Stone Gallery, asked in July"],
];

for (const [material_key, unit, usual_rate, note] of USUAL) {
  savePriceEntry({ material_key, unit, usual_rate, note, updated_by: null });
}

console.log("Seeded:");
console.log(`  ${houseALines.length + houseBLines.length} material purchases across 2 builds`);
console.log(`  ${people.length + 1} workers, attendance for both builds, wages and advances`);
console.log(`  usual prices for ${USUAL.length} materials`);
console.log("");
console.log("Sign in as the owner, then:");
console.log("  /approvals  — the entries waiting to be confirmed before they count");
console.log("  /compare    — the second build measured against the first");
