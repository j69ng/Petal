// SQLite, one file on disk. No cloud account, no monthly bill, and the whole
// ledger is one file you can copy to a pen drive as a backup.

import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import {
  DEFAULT_SETTINGS,
  type Attendance,
  type Draft,
  type Payment,
  type PriceEntry,
  type Project,
  type Purchase,
  type Quote,
  type RecordStatus,
  type Settings,
  type Vendor,
  type Worker,
} from "./types";

const DB_PATH = process.env.BHARGO_DB ?? path.join(process.cwd(), "data", "bhargo.db");

const SCHEMA = `
create table if not exists projects (
  id integer primary key autoincrement,
  name text not null,
  site text,
  area_sqft real not null default 0,
  started_on text not null,
  ended_on text,
  status text not null default 'active' check (status in ('planning','active','done')),
  notes text
);

create table if not exists workers (
  id integer primary key autoincrement,
  name text not null,
  trade text not null,
  wage_type text not null default 'daily' check (wage_type in ('daily','monthly')),
  rate real not null default 0,
  phone text,
  active integer not null default 1
);

create table if not exists attendance (
  id integer primary key autoincrement,
  project_id integer not null references projects (id) on delete cascade,
  worker_id integer not null references workers (id) on delete cascade,
  work_date text not null,
  days real not null default 1,
  ot_hours real not null default 0,
  day_rate real,
  status text not null default 'approved' check (status in ('pending','approved','rejected')),
  entered_by integer references users (id) on delete set null,
  reviewed_by integer references users (id) on delete set null,
  reviewed_at text,
  review_note text,
  unique (project_id, worker_id, work_date)
);

create table if not exists payments (
  id integer primary key autoincrement,
  worker_id integer not null references workers (id) on delete cascade,
  project_id integer references projects (id) on delete set null,
  paid_on text not null,
  amount real not null,
  kind text not null default 'wage' check (kind in ('advance','wage','bonus')),
  note text,
  status text not null default 'approved' check (status in ('pending','approved','rejected')),
  entered_by integer references users (id) on delete set null,
  reviewed_by integer references users (id) on delete set null,
  reviewed_at text,
  review_note text
);

create table if not exists purchases (
  id integer primary key autoincrement,
  project_id integer not null references projects (id) on delete cascade,
  material_key text not null,
  unit text not null,
  qty real not null,
  rate real not null,
  freight real not null default 0,
  vendor text not null default '',
  invoice_no text,
  purchased_on text not null,
  note text,
  status text not null default 'approved' check (status in ('pending','approved','rejected')),
  entered_by integer references users (id) on delete set null,
  reviewed_by integer references users (id) on delete set null,
  reviewed_at text,
  review_note text
);

-- Who sells to the company, and what they said they would charge.
create table if not exists vendors (
  name text primary key collate nocase,
  phone text,
  area text,
  note text
);

create table if not exists quotes (
  id integer primary key autoincrement,
  vendor text not null collate nocase,
  material_key text not null,
  unit text not null,
  rate real not null,
  min_qty real,
  delivery_included integer not null default 0,
  quoted_on text not null,
  valid_until text,
  note text,
  entered_by integer references users (id) on delete set null
);

-- Faults, kept where whoever maintains Bhargo can see them and the company
-- using it never has to. No business data is written here — see monitor.ts.
create table if not exists problems (
  id integer primary key autoincrement,
  ref text not null,
  fingerprint text not null,
  kind text not null,
  route text,
  message text not null,
  stack text,
  user_id integer,
  digest text,
  seen_at text not null,
  count integer not null default 1
);

-- What each material normally costs, so a bill can be judged the day it arrives.
create table if not exists price_book (
  material_key text primary key,
  unit text not null,
  usual_rate real not null,
  note text,
  updated_at text not null,
  updated_by integer references users (id) on delete set null
);

create table if not exists users (
  id integer primary key autoincrement,
  name text not null,
  username text not null unique collate nocase,
  password_hash text not null,
  role text not null default 'staff' check (role in ('owner','staff')),
  active integer not null default 1,
  created_at text not null,
  last_seen_at text
);

create table if not exists sessions (
  token text primary key,
  user_id integer not null references users (id) on delete cascade,
  created_at text not null,
  expires_at text not null
);

create table if not exists settings (
  id integer primary key check (id = 1),
  currency text not null,
  inflation_pct real not null,
  watch_pct real not null,
  alert_pct real not null,
  qty_watch_pct real not null,
  working_days_per_month real not null
);

create index if not exists attendance_project_idx on attendance (project_id, work_date);
create index if not exists attendance_worker_idx on attendance (worker_id, work_date);
create index if not exists payments_worker_idx on payments (worker_id, paid_on);
create index if not exists purchases_project_idx on purchases (project_id, purchased_on);
create index if not exists purchases_material_idx on purchases (material_key);
create index if not exists sessions_user_idx on sessions (user_id);
create index if not exists purchases_status_idx on purchases (status);
create index if not exists payments_status_idx on payments (status);
create index if not exists attendance_status_idx on attendance (status);
create index if not exists quotes_material_idx on quotes (material_key, rate);
create index if not exists problems_seen_idx on problems (seen_at desc);
create unique index if not exists problems_fingerprint_idx on problems (fingerprint);
`;

type Db = InstanceType<typeof Database>;

declare global {
  // eslint-disable-next-line no-var
  var __bhargoDb: Db | undefined;
}

/**
 * Brings an older database up to date. `create table if not exists` cannot add
 * a column to a table that already exists, so anything added after the first
 * release is applied here. Existing rows count as already confirmed — they were
 * entered before there was anything to confirm.
 */
function migrate(db: Db): void {
  const REVIEW_COLUMNS: Record<string, string> = {
    status: "text not null default 'approved'",
    entered_by: "integer",
    reviewed_by: "integer",
    reviewed_at: "text",
    review_note: "text",
  };

  for (const table of ["purchases", "payments", "attendance"]) {
    const existing = new Set(
      (db.prepare(`pragma table_info(${table})`).all() as { name: string }[]).map((c) => c.name)
    );
    for (const [column, definition] of Object.entries(REVIEW_COLUMNS)) {
      if (!existing.has(column)) db.exec(`alter table ${table} add column ${column} ${definition}`);
    }
  }
}

function open(): Db {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  migrate(db);
  db.prepare(
    `insert or ignore into settings (id, currency, inflation_pct, watch_pct, alert_pct, qty_watch_pct, working_days_per_month)
     values (1, @currency, @inflation_pct, @watch_pct, @alert_pct, @qty_watch_pct, @working_days_per_month)`
  ).run(DEFAULT_SETTINGS);
  return db;
}

/** One connection per process, kept across dev-server hot reloads. */
export function db(): Db {
  if (!globalThis.__bhargoDb) globalThis.__bhargoDb = open();
  return globalThis.__bhargoDb;
}

// ---------- settings ----------

export function getSettings(): Settings {
  const row = db().prepare(`select * from settings where id = 1`).get() as (Settings & { id: number }) | undefined;
  if (!row) return DEFAULT_SETTINGS;
  const { id, ...settings } = row;
  return settings;
}

export function saveSettings(settings: Settings): void {
  db()
    .prepare(
      `update settings set currency = @currency, inflation_pct = @inflation_pct, watch_pct = @watch_pct,
       alert_pct = @alert_pct, qty_watch_pct = @qty_watch_pct, working_days_per_month = @working_days_per_month
       where id = 1`
    )
    .run(settings);
}

// ---------- projects ----------

export function listProjects(): Project[] {
  return db().prepare(`select * from projects order by started_on desc, id desc`).all() as Project[];
}

export function getProject(id: number): Project | undefined {
  return db().prepare(`select * from projects where id = ?`).get(id) as Project | undefined;
}

export function createProject(p: Omit<Project, "id">): number {
  const info = db()
    .prepare(
      `insert into projects (name, site, area_sqft, started_on, ended_on, status, notes)
       values (@name, @site, @area_sqft, @started_on, @ended_on, @status, @notes)`
    )
    .run(p);
  return Number(info.lastInsertRowid);
}

export function updateProject(id: number, p: Omit<Project, "id">): void {
  db()
    .prepare(
      `update projects set name = @name, site = @site, area_sqft = @area_sqft, started_on = @started_on,
       ended_on = @ended_on, status = @status, notes = @notes where id = @id`
    )
    .run({ ...p, id });
}

export function deleteProject(id: number): void {
  db().prepare(`delete from projects where id = ?`).run(id);
}

// ---------- workers ----------

export function listWorkers(includeInactive = true): Worker[] {
  const sql = includeInactive
    ? `select * from workers order by active desc, name`
    : `select * from workers where active = 1 order by name`;
  return db().prepare(sql).all() as Worker[];
}

export function getWorker(id: number): Worker | undefined {
  return db().prepare(`select * from workers where id = ?`).get(id) as Worker | undefined;
}

export function createWorker(w: Omit<Worker, "id">): number {
  const info = db()
    .prepare(
      `insert into workers (name, trade, wage_type, rate, phone, active)
       values (@name, @trade, @wage_type, @rate, @phone, @active)`
    )
    .run(w);
  return Number(info.lastInsertRowid);
}

export function updateWorker(id: number, w: Omit<Worker, "id">): void {
  db()
    .prepare(
      `update workers set name = @name, trade = @trade, wage_type = @wage_type, rate = @rate,
       phone = @phone, active = @active where id = @id`
    )
    .run({ ...w, id });
}

export function deleteWorker(id: number): void {
  db().prepare(`delete from workers where id = ?`).run(id);
}

// ---------- attendance ----------

/**
 * Confirmed rows only, unless asked otherwise — every figure the app reports is
 * meant to be one the owner has stood behind.
 */
export function listAttendance(
  filter: { projectId?: number; workerId?: number; from?: string; to?: string; status?: RecordStatus | "all" } = {}
): Attendance[] {
  const where: string[] = [];
  const params: Record<string, unknown> = {};
  const status = filter.status ?? "approved";
  if (status !== "all") { where.push(`status = @status`); params.status = status; }
  if (filter.projectId) { where.push(`project_id = @projectId`); params.projectId = filter.projectId; }
  if (filter.workerId) { where.push(`worker_id = @workerId`); params.workerId = filter.workerId; }
  if (filter.from) { where.push(`work_date >= @from`); params.from = filter.from; }
  if (filter.to) { where.push(`work_date <= @to`); params.to = filter.to; }
  const sql = `select * from attendance ${where.length ? `where ${where.join(" and ")}` : ""} order by work_date desc, id desc`;
  return db().prepare(sql).all(params) as Attendance[];
}

/**
 * Marking the same worker on the same day twice overwrites rather than
 * double-pays. A correction resets the review: an already-confirmed day that is
 * changed goes back to the owner.
 */
export function markAttendance(a: Draft<Attendance>): void {
  db()
    .prepare(
      `insert into attendance (project_id, worker_id, work_date, days, ot_hours, day_rate, status, entered_by)
       values (@project_id, @worker_id, @work_date, @days, @ot_hours, @day_rate, @status, @entered_by)
       on conflict (project_id, worker_id, work_date)
       do update set days = excluded.days, ot_hours = excluded.ot_hours, day_rate = excluded.day_rate,
                     status = excluded.status, entered_by = excluded.entered_by,
                     reviewed_by = null, reviewed_at = null, review_note = null`
    )
    .run({ ...a, status: a.status ?? "pending" });
}

export function deleteAttendance(id: number): void {
  db().prepare(`delete from attendance where id = ?`).run(id);
}

// ---------- payments ----------

export function listPayments(
  filter: { workerId?: number; projectId?: number; from?: string; to?: string; status?: RecordStatus | "all" } = {}
): Payment[] {
  const where: string[] = [];
  const params: Record<string, unknown> = {};
  const status = filter.status ?? "approved";
  if (status !== "all") { where.push(`status = @status`); params.status = status; }
  if (filter.workerId) { where.push(`worker_id = @workerId`); params.workerId = filter.workerId; }
  if (filter.projectId) { where.push(`project_id = @projectId`); params.projectId = filter.projectId; }
  if (filter.from) { where.push(`paid_on >= @from`); params.from = filter.from; }
  if (filter.to) { where.push(`paid_on <= @to`); params.to = filter.to; }
  const sql = `select * from payments ${where.length ? `where ${where.join(" and ")}` : ""} order by paid_on desc, id desc`;
  return db().prepare(sql).all(params) as Payment[];
}

export function createPayment(p: Draft<Payment>): number {
  const info = db()
    .prepare(
      `insert into payments (worker_id, project_id, paid_on, amount, kind, note, status, entered_by)
       values (@worker_id, @project_id, @paid_on, @amount, @kind, @note, @status, @entered_by)`
    )
    .run({ ...p, status: p.status ?? "pending" });
  return Number(info.lastInsertRowid);
}

export function deletePayment(id: number): void {
  db().prepare(`delete from payments where id = ?`).run(id);
}

// ---------- purchases ----------

export function listPurchases(
  filter: { projectId?: number; materialKey?: string; status?: RecordStatus | "all" } = {}
): Purchase[] {
  const where: string[] = [];
  const params: Record<string, unknown> = {};
  const status = filter.status ?? "approved";
  if (status !== "all") { where.push(`status = @status`); params.status = status; }
  if (filter.projectId) { where.push(`project_id = @projectId`); params.projectId = filter.projectId; }
  if (filter.materialKey) { where.push(`material_key = @materialKey`); params.materialKey = filter.materialKey; }
  const sql = `select * from purchases ${where.length ? `where ${where.join(" and ")}` : ""} order by purchased_on desc, id desc`;
  return db().prepare(sql).all(params) as Purchase[];
}

export function createPurchase(p: Draft<Purchase>): number {
  const info = db()
    .prepare(
      `insert into purchases (project_id, material_key, unit, qty, rate, freight, vendor, invoice_no,
                              purchased_on, note, status, entered_by)
       values (@project_id, @material_key, @unit, @qty, @rate, @freight, @vendor, @invoice_no,
               @purchased_on, @note, @status, @entered_by)`
    )
    .run({ ...p, status: p.status ?? "pending" });
  return Number(info.lastInsertRowid);
}

export function deletePurchase(id: number): void {
  db().prepare(`delete from purchases where id = ?`).run(id);
}

export function listVendors(): string[] {
  const rows = db()
    .prepare(`select distinct vendor from purchases where vendor <> '' order by vendor`)
    .all() as { vendor: string }[];
  return rows.map((r) => r.vendor);
}

// ---------- the owner's confirmation ----------

export type ReviewableTable = "purchases" | "payments" | "attendance";

const REVIEWABLE_TABLES: ReviewableTable[] = ["purchases", "payments", "attendance"];

function assertTable(table: string): asserts table is ReviewableTable {
  // The table name goes into SQL as a literal, so it can only ever be one of ours.
  if (!REVIEWABLE_TABLES.includes(table as ReviewableTable)) {
    throw new Error(`Not a reviewable table: ${table}`);
  }
}

/** Confirm a record. Once approved it counts as history and shows up in every figure. */
export function approveRecord(table: string, id: number, reviewerId: number): void {
  assertTable(table);
  db()
    .prepare(
      `update ${table} set status = 'approved', reviewed_by = ?, reviewed_at = ?, review_note = null
       where id = ?`
    )
    .run(reviewerId, new Date().toISOString(), id);
}

/** Send a record back. It stays in the file, out of the figures, with the reason attached. */
export function rejectRecord(table: string, id: number, reviewerId: number, note: string | null): void {
  assertTable(table);
  db()
    .prepare(`update ${table} set status = 'rejected', reviewed_by = ?, reviewed_at = ?, review_note = ? where id = ?`)
    .run(reviewerId, new Date().toISOString(), note, id);
}

export function pendingCounts(): { purchases: number; payments: number; attendance: number; total: number } {
  const count = (table: ReviewableTable) =>
    (db().prepare(`select count(*) as n from ${table} where status = 'pending'`).get() as { n: number }).n;

  const purchases = count("purchases");
  const payments = count("payments");
  const attendance = count("attendance");
  return { purchases, payments, attendance, total: purchases + payments + attendance };
}

// ---------- price book ----------

export function listPriceBook(): PriceEntry[] {
  return db().prepare(`select * from price_book order by material_key`).all() as PriceEntry[];
}

export function getPriceEntry(materialKey: string): PriceEntry | undefined {
  return db().prepare(`select * from price_book where material_key = ?`).get(materialKey) as PriceEntry | undefined;
}

export function savePriceEntry(entry: Omit<PriceEntry, "updated_at">): void {
  db()
    .prepare(
      `insert into price_book (material_key, unit, usual_rate, note, updated_at, updated_by)
       values (@material_key, @unit, @usual_rate, @note, @updated_at, @updated_by)
       on conflict (material_key) do update set
         unit = excluded.unit, usual_rate = excluded.usual_rate, note = excluded.note,
         updated_at = excluded.updated_at, updated_by = excluded.updated_by`
    )
    .run({ ...entry, updated_at: new Date().toISOString() });
}

export function deletePriceEntry(materialKey: string): void {
  db().prepare(`delete from price_book where material_key = ?`).run(materialKey);
}

/**
 * What this material has actually cost on confirmed bills lately — the honest
 * starting point when filling in a usual price.
 */
export function recentRateFor(materialKey: string, lines = 5): { avgRate: number; lines: number } | null {
  const rows = db()
    .prepare(
      `select qty, rate, freight from purchases
       where material_key = ? and status = 'approved' and qty > 0
       order by purchased_on desc limit ?`
    )
    .all(materialKey, lines) as { qty: number; rate: number; freight: number }[];

  if (rows.length === 0) return null;

  const amount = rows.reduce((sum, r) => sum + r.qty * r.rate + (r.freight ?? 0), 0);
  const qty = rows.reduce((sum, r) => sum + r.qty, 0);
  return qty > 0 ? { avgRate: amount / qty, lines: rows.length } : null;
}

// ---------- vendors and their quotes ----------

export function listVendorRecords(): Vendor[] {
  return db().prepare(`select * from vendors order by name`).all() as Vendor[];
}

export function saveVendor(vendor: Vendor): void {
  db()
    .prepare(
      `insert into vendors (name, phone, area, note) values (@name, @phone, @area, @note)
       on conflict (name) do update set phone = excluded.phone, area = excluded.area, note = excluded.note`
    )
    .run(vendor);
}

export function deleteVendor(name: string): void {
  db().prepare(`delete from vendors where name = ?`).run(name);
}

export function listQuotes(materialKey?: string): Quote[] {
  const sql = materialKey
    ? `select * from quotes where material_key = ? order by rate`
    : `select * from quotes order by material_key, rate`;
  return (materialKey ? db().prepare(sql).all(materialKey) : db().prepare(sql).all()) as Quote[];
}

export function createQuote(quote: Omit<Quote, "id">): number {
  const info = db()
    .prepare(
      `insert into quotes (vendor, material_key, unit, rate, min_qty, delivery_included,
                           quoted_on, valid_until, note, entered_by)
       values (@vendor, @material_key, @unit, @rate, @min_qty, @delivery_included,
               @quoted_on, @valid_until, @note, @entered_by)`
    )
    .run(quote);
  return Number(info.lastInsertRowid);
}

export function deleteQuote(id: number): void {
  db().prepare(`delete from quotes where id = ?`).run(id);
}

/**
 * The cheapest each vendor has actually charged, taken from confirmed bills.
 * The quote book fills itself this way: every load bought is evidence of what
 * that supplier will accept, whether or not anyone wrote a quote down.
 */
export function ratesPaidByVendor(sinceMonths = 12): {
  vendor: string;
  material_key: string;
  unit: string;
  rate: number;
  purchased_on: string;
}[] {
  const since = new Date(Date.now() - sinceMonths * 30 * 86_400_000).toISOString().slice(0, 10);
  return db()
    .prepare(
      `select vendor, material_key, unit,
              min((qty * rate + freight) / qty) as rate,
              max(purchased_on) as purchased_on
       from purchases
       where status = 'approved' and qty > 0 and vendor <> '' and purchased_on >= ?
       group by vendor, material_key, unit
       order by material_key, rate`
    )
    .all(since) as { vendor: string; material_key: string; unit: string; rate: number; purchased_on: string }[];
}
