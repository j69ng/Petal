import { approveAll, approveRecord, rejectRecord } from "@/lib/actions";
import { Card, Empty, Pill, Stat } from "@/components/ui";
import { requireOwner } from "@/lib/auth";
import {
  getPriceEntry,
  getSettings,
  listAttendance,
  listPayments,
  listProjects,
  listPurchases,
  listQuotes,
  listWorkers,
  ratesPaidByVendor,
} from "@/lib/db";
import { materialLabel } from "@/lib/materials";
import { formatMoney, formatQty, formatRate } from "@/lib/money";
import { checkAgainstUsual } from "@/lib/pricecheck";
import { findAlternative, knownRates } from "@/lib/sourcing";
import { lineAmount } from "@/lib/variance";

export const dynamic = "force-dynamic";

const VERDICT_PILL = { "far-over": "alert", over: "watch", under: "ok", fair: "ok", "no-benchmark": "low" } as const;

/** Everything waiting on the owner. Nothing here counts as history until it is confirmed. */
export default function ApprovalsPage() {
  requireOwner();

  const settings = getSettings();
  const money = (n: number) => formatMoney(Math.round(n), settings.currency);
  const projectName = new Map(listProjects().map((p) => [p.id, p.name]));
  const workerName = new Map(listWorkers().map((w) => [w.id, w.name]));

  const purchases = listPurchases({ status: "pending" });
  const rates = knownRates(listQuotes(), ratesPaidByVendor());
  const payments = listPayments({ status: "pending" });
  const attendance = listAttendance({ status: "pending" });

  const purchaseValue = purchases.reduce((sum, p) => sum + lineAmount(p), 0);
  const paymentValue = payments.reduce((sum, p) => sum + p.amount, 0);
  const attendanceValue = attendance.reduce((sum, a) => sum + a.days * (a.day_rate ?? 0), 0);
  const nothingWaiting = purchases.length + payments.length + attendance.length === 0;

  // Attendance is confirmed a day at a time — that is how it is recorded.
  const musterDays = new Map<string, typeof attendance>();
  for (const row of attendance) {
    const key = `${row.project_id}|${row.work_date}`;
    const list = musterDays.get(key);
    if (list) list.push(row);
    else musterDays.set(key, [row]);
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl sm:text-2xl font-semibold">Waiting for you</h1>
        <p className="text-mute text-sm mt-1 max-w-2xl">
          Nothing on this page counts yet. Until you confirm it, it stays out of every total, every
          comparison and every wage balance. Confirm what is right, send back what is not — with a
          reason, so whoever entered it knows why.
        </p>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Bills" value={String(purchases.length)} note={money(purchaseValue)} tone={purchases.length ? "warn" : "ok"} />
        <Stat label="Payments" value={String(payments.length)} note={money(paymentValue)} tone={payments.length ? "warn" : "ok"} />
        <Stat label="Days of attendance" value={String(musterDays.size)} note={`${attendance.length} entries · ${money(attendanceValue)}`} tone={attendance.length ? "warn" : "ok"} />
        <Stat label="Total held back" value={money(purchaseValue + paymentValue + attendanceValue)} tone={nothingWaiting ? "ok" : "warn"} />
      </div>

      {nothingWaiting && (
        <Card>
          <Empty>Nothing is waiting. Everything recorded so far has your confirmation.</Empty>
        </Card>
      )}

      {purchases.length > 0 && (
        <Card
          title="Material bills"
          subtitle="Checked against your usual prices"
          right={
            <form action={approveAll}>
              <input type="hidden" name="table" value="purchases" />
              <input type="hidden" name="ids" value={purchases.map((p) => p.id).join(",")} />
              <button className="btn-quiet">Confirm all {purchases.length}</button>
            </form>
          }
        >
          <ul className="divide-y divide-line">
            {purchases.map((purchase) => {
              const check = checkAgainstUsual(
                purchase.material_key,
                lineAmount(purchase) / (purchase.qty || 1),
                purchase.qty,
                getPriceEntry(purchase.material_key),
                settings,
                settings.currency
              );

              return (
                <li key={purchase.id} className="p-3 sm:p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="font-medium">
                        {materialLabel(purchase.material_key)} — {formatQty(purchase.qty)} {purchase.unit}
                      </div>
                      <div className="text-xs text-mute mt-0.5">
                        {purchase.vendor || "no vendor"} · {purchase.purchased_on} ·{" "}
                        {projectName.get(purchase.project_id) ?? "unknown build"} ·{" "}
                        {purchase.invoice_no ? `bill ${purchase.invoice_no}` : (
                          <span className="text-alert">no bill number</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold tabular-nums">{money(lineAmount(purchase))}</div>
                      <div className="text-xs text-mute tabular-nums">
                        {formatRate(purchase.rate)} per {purchase.unit}
                        {purchase.freight ? ` + ${money(purchase.freight)} freight` : ""}
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Pill kind={VERDICT_PILL[check.verdict]}>
                      {check.verdict === "no-benchmark" ? "no usual price" : check.verdict.replace("-", " ")}
                    </Pill>
                    <span className="text-sm text-mute">{check.message}</span>
                  </div>
                  {(() => {
                    const cheaper = findAlternative(
                      {
                        materialKey: purchase.material_key,
                        rate: lineAmount(purchase) / (purchase.qty || 1),
                        qty: purchase.qty,
                        vendor: purchase.vendor,
                        onDate: purchase.purchased_on,
                      },
                      rates,
                      settings,
                      settings.currency
                    );
                    return cheaper ? (
                      <p className="text-sm text-ok mt-1">{cheaper.message}</p>
                    ) : null;
                  })()}
                  {purchase.note && <p className="text-xs text-mute mt-1">Note: {purchase.note}</p>}

                  <Decide table="purchases" id={purchase.id} />
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {payments.length > 0 && (
        <Card
          title="Money paid out"
          right={
            <form action={approveAll}>
              <input type="hidden" name="table" value="payments" />
              <input type="hidden" name="ids" value={payments.map((p) => p.id).join(",")} />
              <button className="btn-quiet">Confirm all {payments.length}</button>
            </form>
          }
        >
          <ul className="divide-y divide-line">
            {payments.map((payment) => (
              <li key={payment.id} className="p-3 sm:p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="font-medium">
                      {workerName.get(payment.worker_id) ?? "unknown worker"}{" "}
                      <span className="text-mute font-normal">· {payment.kind}</span>
                    </div>
                    <div className="text-xs text-mute mt-0.5">
                      {payment.paid_on}
                      {payment.project_id ? ` · ${projectName.get(payment.project_id) ?? ""}` : ""}
                      {payment.note ? ` · ${payment.note}` : ""}
                    </div>
                  </div>
                  <div className="font-semibold tabular-nums">{money(payment.amount)}</div>
                </div>
                <Decide table="payments" id={payment.id} />
              </li>
            ))}
          </ul>
        </Card>
      )}

      {musterDays.size > 0 && (
        <Card
          title="Attendance"
          subtitle="Who was on site, and what the day cost"
          right={
            <form action={approveAll}>
              <input type="hidden" name="table" value="attendance" />
              <input type="hidden" name="ids" value={attendance.map((a) => a.id).join(",")} />
              <button className="btn-quiet">Confirm all {attendance.length}</button>
            </form>
          }
        >
          <ul className="divide-y divide-line">
            {Array.from(musterDays.entries()).map(([key, rows]) => {
              const [projectId, workDate] = key.split("|");
              const dayCost = rows.reduce(
                (sum, r) => sum + r.days * (r.day_rate ?? 0) + (r.ot_hours ?? 0) * ((r.day_rate ?? 0) / 8) * 1.5,
                0
              );

              return (
                <li key={key} className="p-3 sm:p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="font-medium">
                        {workDate} · {projectName.get(Number(projectId)) ?? "unknown build"}
                      </div>
                      <div className="text-xs text-mute mt-0.5">
                        {rows
                          .map(
                            (r) =>
                              `${workerName.get(r.worker_id) ?? "?"} ${r.days}d${r.ot_hours ? ` +${r.ot_hours}h` : ""}`
                          )
                          .join(", ")}
                      </div>
                    </div>
                    <div className="font-semibold tabular-nums">{money(dayCost)}</div>
                  </div>

                  <form action={approveAll} className="mt-3 flex flex-wrap gap-2">
                    <input type="hidden" name="table" value="attendance" />
                    <input type="hidden" name="ids" value={rows.map((r) => r.id).join(",")} />
                    <button className="btn">Confirm this day</button>
                  </form>
                  <div className="mt-2 space-y-2">
                    {rows.map((row) => (
                      <div key={row.id} className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="text-mute min-w-[8rem]">{workerName.get(row.worker_id) ?? "?"}</span>
                        <span className="tabular-nums text-xs text-mute">
                          {row.days} day{row.days === 1 ? "" : "s"} at {formatRate(row.day_rate ?? 0)}
                        </span>
                        <Decide table="attendance" id={row.id} compact />
                      </div>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}

/** Confirm, or send back with a reason. */
function Decide({ table, id, compact = false }: { table: string; id: number; compact?: boolean }) {
  return (
    <div className={`flex flex-wrap items-center gap-2 ${compact ? "" : "mt-3"}`}>
      <form action={approveRecord}>
        <input type="hidden" name="table" value={table} />
        <input type="hidden" name="id" value={id} />
        <button className={compact ? "btn-quiet" : "btn"}>Confirm</button>
      </form>
      <form action={rejectRecord} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="table" value={table} />
        <input type="hidden" name="id" value={id} />
        <input name="note" placeholder="Reason for sending back" className="input w-48 sm:w-56" />
        <button className="btn-quiet text-alert border-alert/30">Send back</button>
      </form>
    </div>
  );
}
