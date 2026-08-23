import { addPayment, removePayment } from "@/lib/actions";
import { Card, Empty, Field, Stat } from "@/components/ui";
import { getSettings, listAttendance, listPayments, listProjects, listWorkers } from "@/lib/db";
import { formatMoney, formatShort } from "@/lib/money";
import { payrollLedger } from "@/lib/payroll";

export const dynamic = "force-dynamic";

export default function PayrollPage({
  searchParams,
}: {
  searchParams: { project?: string; from?: string; to?: string };
}) {
  const settings = getSettings();
  const projects = listProjects();
  const workers = listWorkers();
  const money = (n: number) => formatMoney(Math.round(n), settings.currency);
  const today = new Date().toISOString().slice(0, 10);

  const selected = projects.find((p) => p.id === Number(searchParams.project)) ?? projects.find((p) => p.status === "active") ?? projects[0];
  const from = searchParams.from || undefined;
  const to = searchParams.to || undefined;

  const attendance = selected ? listAttendance({ projectId: selected.id, from, to }) : [];
  const payments = selected ? listPayments({ projectId: selected.id, from, to }) : [];
  const ledger = payrollLedger(workers, attendance, payments, settings);

  const earned = ledger.reduce((s, l) => s + l.earned, 0);
  const advances = ledger.reduce((s, l) => s + l.advancePaid, 0);
  const wagesPaid = ledger.reduce((s, l) => s + l.wagePaid, 0);
  const paid = advances + wagesPaid;
  const owed = ledger.reduce((s, l) => s + Math.max(l.balance, 0), 0);
  const drawnAhead = ledger.reduce((s, l) => s + Math.min(l.balance, 0), 0);
  const workerName = new Map(workers.map((w) => [w.id, w.name]));

  if (!selected) {
    return (
      <Card title="Wages">
        <Empty action={{ href: "/projects", label: "Add a build" }}>Wages are tracked per build.</Empty>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Wage sheet</h1>
          <p className="text-mute text-sm mt-1">
            {selected.name}
            {from || to ? ` · ${from ?? "start"} to ${to ?? "today"}` : " · everything so far"}
          </p>
        </div>
        <div className="flex items-end gap-2 no-print">
          <form method="get" className="flex items-end gap-2">
            <label className="text-xs text-mute">
              <span className="block mb-1">Build</span>
              <select name="project" defaultValue={selected.id} className="input">
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-mute">
              <span className="block mb-1">From</span>
              <input name="from" type="date" defaultValue={from ?? ""} className="input" />
            </label>
            <label className="text-xs text-mute">
              <span className="block mb-1">To</span>
              <input name="to" type="date" defaultValue={to ?? ""} className="input" />
            </label>
            <button className="btn">Show</button>
          </form>
        </div>
      </header>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Earned" value={formatShort(earned, settings.currency)} note={`${attendance.reduce((s, a) => s + a.days, 0)} man-days`} />
        <Stat label="Paid out" value={formatShort(paid, settings.currency)} note="Advances and wage payments" />
        <Stat label="Still owed" value={formatShort(owed, settings.currency)} tone={owed > 0 ? "warn" : "ok"} />
        <Stat
          label="Drawn ahead"
          value={formatShort(Math.abs(drawnAhead), settings.currency)}
          note="Advances beyond the work done so far"
        />
      </div>

      <Card title="What each person is owed" subtitle="Earned from attendance, less advances and wage payments.">
        {ledger.length === 0 ? (
          <Empty action={{ href: "/people", label: "Mark attendance" }}>
            No attendance or payments recorded for this build in this period.
          </Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="th">Worker</th>
                  <th className="th num">Days</th>
                  <th className="th num">OT hrs</th>
                  <th className="th num">Day rate</th>
                  <th className="th num">Wages</th>
                  <th className="th num">Overtime</th>
                  <th className="th num">Earned</th>
                  <th className="th num">Advances</th>
                  <th className="th num">Paid</th>
                  <th className="th num">Balance</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((l) => (
                  <tr key={l.worker.id}>
                    <td className="td">
                      <div className="font-medium">{l.worker.name}</div>
                      <div className="text-xs text-mute">
                        <span className="capitalize">{l.worker.trade}</span>
                        {l.worker.wage_type === "monthly" ? " · monthly" : ""}
                      </div>
                    </td>
                    <td className="td num">{l.daysWorked}</td>
                    <td className="td num text-mute">{l.otHours || "—"}</td>
                    <td className="td num text-mute">{money(l.effectiveDailyRate)}</td>
                    <td className="td num">{money(l.wageEarned)}</td>
                    <td className="td num text-mute">{l.otEarned ? money(l.otEarned) : "—"}</td>
                    <td className="td num font-medium">{money(l.earned)}</td>
                    <td className="td num text-mute">{l.advancePaid ? money(l.advancePaid) : "—"}</td>
                    <td className="td num">{money(l.wagePaid)}</td>
                    <td className={`td num font-medium ${l.balance > 0.5 ? "text-warn" : l.balance < -0.5 ? "text-alert" : "text-mute"}`}>
                      {money(l.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-paper font-medium">
                  <td className="td" colSpan={6}>Total</td>
                  <td className="td num">{money(earned)}</td>
                  <td className="td num">{money(advances)}</td>
                  <td className="td num">{money(wagesPaid)}</td>
                  <td className="td num">{money(earned - paid)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        <div className="px-4 py-3 border-t border-line text-xs text-mute">
          A bonus is money paid out but not set against wages, so it never reduces a balance.
        </div>
      </Card>

      <Card title="Pay someone">
        <form action={addPayment} className="p-4 grid sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
          <Field label="Worker">
            <select name="worker_id" className="input">
              {workers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Build">
            <select name="project_id" defaultValue={selected.id} className="input">
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Amount">
            <input name="amount" type="number" step="any" min="0" required className="input" />
          </Field>
          <Field label="Kind">
            <select name="kind" className="input">
              <option value="wage">Wages</option>
              <option value="advance">Advance</option>
              <option value="bonus">Bonus</option>
            </select>
          </Field>
          <Field label="Date">
            <input name="paid_on" type="date" defaultValue={today} className="input" />
          </Field>
          <button className="btn">Record payment</button>
        </form>
      </Card>

      <Card title="Payments" subtitle={`${payments.length} recorded`}>
        {payments.length === 0 ? (
          <Empty>No payments recorded yet.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="th">Date</th>
                  <th className="th">Worker</th>
                  <th className="th">Kind</th>
                  <th className="th">Note</th>
                  <th className="th num">Amount</th>
                  <th className="th no-print" />
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="td whitespace-nowrap">{p.paid_on}</td>
                    <td className="td">{workerName.get(p.worker_id) ?? "—"}</td>
                    <td className="td capitalize">{p.kind}</td>
                    <td className="td text-mute">{p.note ?? "—"}</td>
                    <td className="td num font-medium">{money(p.amount)}</td>
                    <td className="td no-print">
                      <form action={removePayment}>
                        <input type="hidden" name="id" value={p.id} />
                        <button className="btn-quiet">Delete</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
