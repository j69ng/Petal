import { addWorker, editWorker, markDay, removeAttendance, removeWorker } from "@/lib/actions";
import { requireUser } from "@/lib/auth";
import { Card, Empty, Field } from "@/components/ui";
import { getSettings, listAttendance, listProjects, listWorkers } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { dailyRateOf } from "@/lib/payroll";

export const dynamic = "force-dynamic";

const TRADES = ["mason", "helper", "carpenter", "electrician", "plumber", "painter", "bar-bender", "supervisor", "driver"];

export default function PeoplePage({ searchParams }: { searchParams: { project?: string; date?: string } }) {
  requireUser();
  const settings = getSettings();
  const projects = listProjects();
  const workers = listWorkers();
  const money = (n: number) => formatMoney(Math.round(n), settings.currency);
  const today = new Date().toISOString().slice(0, 10);

  const selected =
    projects.find((p) => p.id === Number(searchParams.project)) ??
    projects.find((p) => p.status === "active") ??
    projects[0];
  const date = searchParams.date || today;

  const existing = selected
    ? new Map(listAttendance({ projectId: selected.id, from: date, to: date }).map((a) => [a.worker_id, a]))
    : new Map();
  const recent = selected ? listAttendance({ projectId: selected.id }).slice(0, 25) : [];
  const workerName = new Map(workers.map((w) => [w.id, w.name]));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">People</h1>
        <p className="text-mute text-sm mt-1 max-w-2xl">
          The day rate is saved onto each day&rsquo;s attendance, so raising someone&rsquo;s rate
          tomorrow never rewrites what last year&rsquo;s work cost.
        </p>
      </header>

      {projects.length > 0 && (
        <Card title="Mark today's muster" subtitle="1 for a full day, 0.5 for half. Leave a row blank if they were not on site.">
          <form method="get" className="px-4 pt-4 flex items-end gap-2 no-print">
            <label className="text-xs text-mute">
              <span className="block mb-1">Build</span>
              <select name="project" defaultValue={selected?.id} className="input">
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-mute">
              <span className="block mb-1">Date</span>
              <input name="date" type="date" defaultValue={date} className="input" />
            </label>
            <button className="btn-quiet mb-0.5">Load day</button>
          </form>

          <form action={markDay} className="p-4">
            <input type="hidden" name="project_id" value={selected?.id} />
            <input type="hidden" name="work_date" value={date} />
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="th">Worker</th>
                    <th className="th num">Day rate</th>
                    <th className="th num w-28">Days</th>
                    <th className="th num w-28">OT hours</th>
                  </tr>
                </thead>
                <tbody>
                  {workers
                    .filter((w) => w.active === 1)
                    .map((w) => {
                      const marked = existing.get(w.id);
                      return (
                        <tr key={w.id}>
                          <td className="td">
                            <div className="font-medium">{w.name}</div>
                            <div className="text-xs text-mute capitalize">{w.trade}</div>
                          </td>
                          <td className="td num text-mute">{money(dailyRateOf(w, settings))}</td>
                          <td className="td">
                            <select name={`days_${w.id}`} defaultValue={marked ? String(marked.days) : "0"} className="input">
                              <option value="0">—</option>
                              <option value="0.5">Half</option>
                              <option value="1">Full</option>
                            </select>
                          </td>
                          <td className="td">
                            <input
                              name={`ot_${w.id}`}
                              type="number"
                              step="0.5"
                              min="0"
                              defaultValue={marked?.ot_hours ?? 0}
                              className="input"
                            />
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
            <button className="btn mt-4">Save {date}</button>
          </form>
        </Card>
      )}

      <Card title="Add someone">
        <form action={addWorker} className="p-4 grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <Field label="Name">
            <input name="name" required className="input" />
          </Field>
          <Field label="Trade">
            <select name="trade" className="input">
              {TRADES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Paid">
            <select name="wage_type" className="input">
              <option value="daily">By the day</option>
              <option value="monthly">Monthly salary</option>
            </select>
          </Field>
          <Field label="Rate" hint={`Per day, or per month for a salary (÷ ${settings.working_days_per_month} for a day)`}>
            <input name="rate" type="number" step="any" min="0" required className="input" />
          </Field>
          <div className="flex items-end">
            <button className="btn w-full">Add</button>
          </div>
        </form>
      </Card>

      <Card title="Everyone on the books">
        {workers.length === 0 ? (
          <Empty>Nobody added yet.</Empty>
        ) : (
          <div className="divide-y divide-line">
            {workers.map((w) => (
              <form key={w.id} action={editWorker} className="p-4 grid sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
                <input type="hidden" name="id" value={w.id} />
                <Field label="Name">
                  <input name="name" defaultValue={w.name} className="input" />
                </Field>
                <Field label="Trade">
                  <select name="trade" defaultValue={w.trade} className="input">
                    {[...new Set([...TRADES, w.trade])].map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Paid">
                  <select name="wage_type" defaultValue={w.wage_type} className="input">
                    <option value="daily">By the day</option>
                    <option value="monthly">Monthly salary</option>
                  </select>
                </Field>
                <Field label="Rate" hint={w.wage_type === "monthly" ? `${money(dailyRateOf(w, settings))} a day` : undefined}>
                  <input name="rate" type="number" step="any" defaultValue={w.rate} className="input" />
                </Field>
                <Field label="Phone">
                  <input name="phone" defaultValue={w.phone ?? ""} className="input" />
                </Field>
                <div className="flex gap-2">
                  <button className="btn">Save</button>
                  <button name="active" value={w.active === 1 ? "0" : "1"} className="btn-quiet">
                    {w.active === 1 ? "Mark left" : "Bring back"}
                  </button>
                </div>
              </form>
            ))}
          </div>
        )}
        <div className="px-4 py-3 border-t border-line text-xs text-mute no-print">
          Someone who has left keeps their history — marking them left only takes them off the daily
          muster. Deleting removes their attendance and payments too.
        </div>
      </Card>

      {recent.length > 0 && (
        <Card title="Recent attendance" subtitle={selected?.name}>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="th">Date</th>
                  <th className="th">Worker</th>
                  <th className="th num">Days</th>
                  <th className="th num">OT</th>
                  <th className="th num">Rate that day</th>
                  <th className="th no-print" />
                </tr>
              </thead>
              <tbody>
                {recent.map((a) => (
                  <tr key={a.id}>
                    <td className="td whitespace-nowrap">{a.work_date}</td>
                    <td className="td">{workerName.get(a.worker_id) ?? "—"}</td>
                    <td className="td num">{a.days}</td>
                    <td className="td num text-mute">{a.ot_hours || "—"}</td>
                    <td className="td num text-mute">{a.day_rate ? money(a.day_rate) : "—"}</td>
                    <td className="td no-print">
                      <form action={removeAttendance}>
                        <input type="hidden" name="id" value={a.id} />
                        <button className="btn-quiet">Remove</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card title="Remove someone permanently" className="border-alert/30">
        <form action={removeWorker} className="p-4 flex flex-wrap items-end gap-3">
          <Field label="Worker">
            <select name="id" className="input">
              {workers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </Field>
          <button className="btn-quiet text-alert border-alert/30">
            Delete worker, attendance and payments
          </button>
        </form>
      </Card>
    </div>
  );
}
