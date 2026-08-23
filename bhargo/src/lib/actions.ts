"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import * as store from "./db";
import * as auth from "./auth";
import { material } from "./materials";
import type { PaymentKind, ProjectStatus, UserRole, WageType } from "./types";

function str(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

function num(form: FormData, key: string, fallback = 0): number {
  const value = Number(str(form, key));
  return Number.isFinite(value) ? value : fallback;
}

function nullable(form: FormData, key: string): string | null {
  const value = str(form, key);
  return value === "" ? null : value;
}

function refresh(...paths: string[]) {
  for (const path of ["/", ...paths, "/approvals"]) revalidatePath(path);
}

/**
 * The owner confirming their own entry would be theatre, so what they record is
 * already confirmed. Everyone else's work waits for them.
 */
function entryStatus(user: { id: number; role: string }): { status: "approved" | "pending"; entered_by: number } {
  return { status: user.role === "owner" ? "approved" : "pending", entered_by: user.id };
}

// ---------------------------------------------------------------- projects

export async function addProject(form: FormData) {
  auth.requireUser();
  const name = str(form, "name");
  if (!name) return;

  const id = store.createProject({
    name,
    site: nullable(form, "site"),
    area_sqft: num(form, "area_sqft"),
    started_on: str(form, "started_on") || new Date().toISOString().slice(0, 10),
    ended_on: nullable(form, "ended_on"),
    status: (str(form, "status") || "active") as ProjectStatus,
    notes: nullable(form, "notes"),
  });

  refresh("/projects", "/compare");
  redirect(`/projects?highlight=${id}`);
}

export async function editProject(form: FormData) {
  auth.requireUser();
  const id = num(form, "id");
  const existing = store.getProject(id);
  if (!existing) return;

  store.updateProject(id, {
    name: str(form, "name") || existing.name,
    site: nullable(form, "site"),
    area_sqft: num(form, "area_sqft", existing.area_sqft),
    started_on: str(form, "started_on") || existing.started_on,
    ended_on: nullable(form, "ended_on"),
    status: (str(form, "status") || existing.status) as ProjectStatus,
    notes: nullable(form, "notes"),
  });

  refresh("/projects", "/compare");
}

export async function removeProject(form: FormData) {
  auth.requireOwner();
  store.deleteProject(num(form, "id"));
  refresh("/projects", "/compare", "/purchases", "/payroll");
}

// ---------------------------------------------------------------- workers

export async function addWorker(form: FormData) {
  auth.requireUser();
  const name = str(form, "name");
  if (!name) return;

  store.createWorker({
    name,
    trade: str(form, "trade") || "helper",
    wage_type: (str(form, "wage_type") || "daily") as WageType,
    rate: num(form, "rate"),
    phone: nullable(form, "phone"),
    active: 1,
  });

  refresh("/people", "/payroll");
}

export async function editWorker(form: FormData) {
  auth.requireUser();
  const id = num(form, "id");
  const existing = store.getWorker(id);
  if (!existing) return;

  store.updateWorker(id, {
    name: str(form, "name") || existing.name,
    trade: str(form, "trade") || existing.trade,
    wage_type: (str(form, "wage_type") || existing.wage_type) as WageType,
    rate: num(form, "rate", existing.rate),
    phone: nullable(form, "phone"),
    active: str(form, "active") === "0" ? 0 : 1,
  });

  refresh("/people", "/payroll");
}

export async function removeWorker(form: FormData) {
  auth.requireOwner();
  store.deleteWorker(num(form, "id"));
  refresh("/people", "/payroll");
}

// ---------------------------------------------------------------- attendance

/**
 * Marks a whole day's muster in one go. The day rate is snapshotted onto each
 * row, so a later raise never rewrites what an old day cost.
 */
export async function markDay(form: FormData) {
  const user = auth.requireUser();
  const project_id = num(form, "project_id");
  const work_date = str(form, "work_date");
  if (!project_id || !work_date) return;

  const settings = store.getSettings();
  const workers = store.listWorkers(false);

  for (const worker of workers) {
    const days = num(form, `days_${worker.id}`, 0);
    const ot_hours = num(form, `ot_${worker.id}`, 0);
    if (days <= 0 && ot_hours <= 0) continue;

    const dayRate =
      worker.wage_type === "monthly"
        ? worker.rate / (settings.working_days_per_month || 26)
        : worker.rate;

    store.markAttendance({
      project_id,
      worker_id: worker.id,
      work_date,
      days,
      ot_hours,
      day_rate: dayRate,
      ...entryStatus(user),
    });
  }

  refresh("/people", "/payroll", "/compare");
}

export async function removeAttendance(form: FormData) {
  auth.requireUser();
  store.deleteAttendance(num(form, "id"));
  refresh("/people", "/payroll", "/compare");
}

// ---------------------------------------------------------------- payments

export async function addPayment(form: FormData) {
  const user = auth.requireUser();
  const worker_id = num(form, "worker_id");
  const amount = num(form, "amount");
  if (!worker_id || amount <= 0) return;

  store.createPayment({
    worker_id,
    project_id: num(form, "project_id") || null,
    paid_on: str(form, "paid_on") || new Date().toISOString().slice(0, 10),
    amount,
    kind: (str(form, "kind") || "wage") as PaymentKind,
    note: nullable(form, "note"),
    ...entryStatus(user),
  });

  refresh("/payroll", "/people");
}

export async function removePayment(form: FormData) {
  auth.requireUser();
  store.deletePayment(num(form, "id"));
  refresh("/payroll", "/people");
}

// ---------------------------------------------------------------- purchases

export async function addPurchase(form: FormData) {
  const user = auth.requireUser();
  const project_id = num(form, "project_id");
  const material_key = str(form, "material_key");
  const qty = num(form, "qty");
  if (!project_id || !material_key || qty <= 0) return;

  store.createPurchase({
    project_id,
    material_key,
    unit: str(form, "unit") || material(material_key).unit,
    qty,
    rate: num(form, "rate"),
    freight: num(form, "freight"),
    vendor: str(form, "vendor"),
    invoice_no: nullable(form, "invoice_no"),
    purchased_on: str(form, "purchased_on") || new Date().toISOString().slice(0, 10),
    note: nullable(form, "note"),
    ...entryStatus(user),
  });

  refresh("/purchases", "/compare");
}

export async function removePurchase(form: FormData) {
  auth.requireUser();
  store.deletePurchase(num(form, "id"));
  refresh("/purchases", "/compare");
}

// ---------------------------------------------------------------- settings

export async function saveSettingsAction(form: FormData) {
  auth.requireOwner();
  const current = store.getSettings();

  store.saveSettings({
    currency: str(form, "currency") || current.currency,
    inflation_pct: num(form, "inflation_pct", current.inflation_pct),
    watch_pct: num(form, "watch_pct", current.watch_pct),
    alert_pct: num(form, "alert_pct", current.alert_pct),
    qty_watch_pct: num(form, "qty_watch_pct", current.qty_watch_pct),
    working_days_per_month: num(form, "working_days_per_month", current.working_days_per_month),
  });

  refresh("/settings", "/compare", "/payroll");
}

// ---------------------------------------------------------------- accounts

/** First run: the owner account. Nobody can reach the books before this exists. */
export async function createFirstOwner(form: FormData) {
  if (auth.userCount() > 0) redirect("/login");

  if (!auth.setupKeyMatches(str(form, "setup_key"))) {
    redirect(`/setup?error=${encodeURIComponent("Wrong setup key.")}`);
  }

  const result = await auth.createUser({
    name: str(form, "name"),
    username: str(form, "username"),
    password: String(form.get("password") ?? ""),
    role: "owner",
  });

  if (!result.ok) redirect(`/setup?error=${encodeURIComponent(result.error)}`);

  await auth.signIn(str(form, "username"), String(form.get("password") ?? ""));
  redirect("/");
}

export async function signInAction(form: FormData) {
  const username = str(form, "username");
  const next = str(form, "next");
  const result = await auth.signIn(username, String(form.get("password") ?? ""));

  if (!result.ok) {
    const params = new URLSearchParams({ error: result.error });
    if (next) params.set("next", next);
    redirect(`/login?${params}`);
  }

  redirect(next && next.startsWith("/") ? next : "/");
}

export async function signOutAction() {
  auth.signOut();
  redirect("/login");
}

export async function createStaffUser(form: FormData) {
  auth.requireOwner();

  const result = await auth.createUser({
    name: str(form, "name"),
    username: str(form, "username"),
    password: String(form.get("password") ?? ""),
    role: (str(form, "role") || "staff") as UserRole,
  });

  refresh("/users");
  redirect(
    result.ok
      ? `/users?ok=${encodeURIComponent(`${str(form, "name")} can now sign in.`)}`
      : `/users?error=${encodeURIComponent(result.error)}`
  );
}

export async function changePassword(form: FormData) {
  auth.requireOwner();

  const password = String(form.get("password") ?? "");
  if (!password) redirect("/users");

  const result = await auth.setPassword(num(form, "id"), password);
  refresh("/users");
  redirect(
    result.ok
      ? `/users?ok=${encodeURIComponent("Password changed. They will need to sign in again.")}`
      : `/users?error=${encodeURIComponent(result.error ?? "Could not change the password.")}`
  );
}

export async function toggleUser(form: FormData) {
  const owner = auth.requireOwner();
  const id = num(form, "id");
  if (id === owner.id) redirect(`/users?error=${encodeURIComponent("You cannot switch off your own account.")}`);

  auth.setUserActive(id, str(form, "active") === "1");
  refresh("/users");
  redirect("/users");
}

export async function removeUser(form: FormData) {
  const owner = auth.requireOwner();
  const id = num(form, "id");
  if (id === owner.id) redirect(`/users?error=${encodeURIComponent("You cannot delete your own account.")}`);

  auth.deleteUser(id);
  refresh("/users");
  redirect("/users");
}

// ------------------------------------------------------- the owner's confirmation

export async function approveRecord(form: FormData) {
  const owner = auth.requireOwner();
  store.approveRecord(str(form, "table"), num(form, "id"), owner.id);
  refresh("/approvals", "/purchases", "/payroll", "/people", "/compare");
}

export async function rejectRecord(form: FormData) {
  const owner = auth.requireOwner();
  store.rejectRecord(str(form, "table"), num(form, "id"), owner.id, nullable(form, "note"));
  refresh("/approvals", "/purchases", "/payroll", "/people", "/compare");
}

/** Confirm everything on the list in one go, for a day of routine entries. */
export async function approveAll(form: FormData) {
  const owner = auth.requireOwner();
  const table = str(form, "table");
  const ids = String(form.get("ids") ?? "")
    .split(",")
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id) && id > 0);

  for (const id of ids) store.approveRecord(table, id, owner.id);
  refresh("/approvals", "/purchases", "/payroll", "/people", "/compare");
}

// ---------------------------------------------------------------- price book

export async function savePrice(form: FormData) {
  // The yardstick is the owner's to set — if staff could move it, an overcharge
  // could be made to look normal.
  const user = auth.requireOwner();
  const material_key = str(form, "material_key");
  const usual_rate = num(form, "usual_rate");
  if (!material_key || usual_rate <= 0) return;

  store.savePriceEntry({
    material_key,
    unit: str(form, "unit") || material(material_key).unit,
    usual_rate,
    note: nullable(form, "note"),
    updated_by: user.id,
  });

  refresh("/prices", "/purchases");
}

export async function removePrice(form: FormData) {
  auth.requireOwner();
  store.deletePriceEntry(str(form, "material_key"));
  refresh("/prices", "/purchases");
}
