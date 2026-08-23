"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import * as store from "./db";
import { material } from "./materials";
import type { PaymentKind, ProjectStatus, WageType } from "./types";

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
  for (const path of ["/", ...paths]) revalidatePath(path);
}

// ---------------------------------------------------------------- projects

export async function addProject(form: FormData) {
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
  store.deleteProject(num(form, "id"));
  refresh("/projects", "/compare", "/purchases", "/payroll");
}

// ---------------------------------------------------------------- workers

export async function addWorker(form: FormData) {
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
  store.deleteWorker(num(form, "id"));
  refresh("/people", "/payroll");
}

// ---------------------------------------------------------------- attendance

/**
 * Marks a whole day's muster in one go. The day rate is snapshotted onto each
 * row, so a later raise never rewrites what an old day cost.
 */
export async function markDay(form: FormData) {
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

    store.markAttendance({ project_id, worker_id: worker.id, work_date, days, ot_hours, day_rate: dayRate });
  }

  refresh("/people", "/payroll", "/compare");
}

export async function removeAttendance(form: FormData) {
  store.deleteAttendance(num(form, "id"));
  refresh("/people", "/payroll", "/compare");
}

// ---------------------------------------------------------------- payments

export async function addPayment(form: FormData) {
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
  });

  refresh("/payroll", "/people");
}

export async function removePayment(form: FormData) {
  store.deletePayment(num(form, "id"));
  refresh("/payroll", "/people");
}

// ---------------------------------------------------------------- purchases

export async function addPurchase(form: FormData) {
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
  });

  refresh("/purchases", "/compare");
}

export async function removePurchase(form: FormData) {
  store.deletePurchase(num(form, "id"));
  refresh("/purchases", "/compare");
}

// ---------------------------------------------------------------- settings

export async function saveSettingsAction(form: FormData) {
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
