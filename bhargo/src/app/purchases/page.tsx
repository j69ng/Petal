import { addPurchase, removePurchase } from "@/lib/actions";
import MaterialSelect from "@/components/MaterialSelect";
import { requireUser } from "@/lib/auth";
import { Card, Empty, Field } from "@/components/ui";
import { getSettings, listProjects, listPurchases, listVendors } from "@/lib/db";
import { formatMoney, formatQty, formatRate } from "@/lib/money";
import { materialLabel } from "@/lib/materials";
import { lineAmount, rollupByMaterial } from "@/lib/variance";

export const dynamic = "force-dynamic";

export default function PurchasesPage({ searchParams }: { searchParams: { project?: string } }) {
  requireUser();
  const settings = getSettings();
  const projects = listProjects();
  const money = (n: number) => formatMoney(Math.round(n), settings.currency);
  const today = new Date().toISOString().slice(0, 10);

  if (projects.length === 0) {
    return (
      <Card title="Materials">
        <Empty action={{ href: "/projects", label: "Add a build" }}>
          Materials are recorded against a build, so add a build first.
        </Empty>
      </Card>
    );
  }

  const selected = projects.find((p) => p.id === Number(searchParams.project)) ?? projects.find((p) => p.status === "active") ?? projects[0];
  const purchases = listPurchases({ projectId: selected.id });
  const rollups = rollupByMaterial(purchases);
  const total = rollups.reduce((sum, r) => sum + r.amount, 0);
  const vendors = listVendors();

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Materials</h1>
          <p className="text-mute text-sm mt-1">
            {money(total)} on {selected.name} — {money(total / (selected.area_sqft || 1))} per sq.ft.
          </p>
        </div>
        <form method="get" className="flex items-end gap-2 no-print">
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
          <button className="btn">Show</button>
        </form>
      </header>

      <Card title="Record a bill" subtitle="Freight goes in its own box so the rate stays the rate.">
        <form action={addPurchase} className="p-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Field label="Build">
            <select name="project_id" defaultValue={selected.id} className="input">
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <MaterialSelect />
          <Field label="Quantity">
            <input name="qty" type="number" step="any" min="0" required className="input" />
          </Field>
          <Field label="Rate per unit">
            <input name="rate" type="number" step="any" min="0" required className="input" />
          </Field>
          <Field label="Freight / cartage">
            <input name="freight" type="number" step="any" min="0" defaultValue={0} className="input" />
          </Field>
          <Field label="Vendor">
            <input name="vendor" list="vendors" placeholder="Shree Traders" className="input" />
            <datalist id="vendors">
              {vendors.map((v) => (
                <option key={v} value={v} />
              ))}
            </datalist>
          </Field>
          <Field label="Bill / invoice no." hint="Worth filling in — without it a rate is hard to argue later.">
            <input name="invoice_no" className="input" />
          </Field>
          <Field label="Date">
            <input name="purchased_on" type="date" defaultValue={today} className="input" />
          </Field>
          <Field label="Note" className="lg:col-span-3">
            <input name="note" className="input" />
          </Field>
          <div className="flex items-end">
            <button className="btn w-full">Add bill</button>
          </div>
        </form>
      </Card>

      <Card title="What has been bought" subtitle={`${selected.name}, totalled by material`}>
        {rollups.length === 0 ? (
          <Empty>No bills recorded on this build yet.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="th">Material</th>
                  <th className="th num">Quantity</th>
                  <th className="th num">Average rate</th>
                  <th className="th num">Rate range</th>
                  <th className="th">Vendors</th>
                  <th className="th num">Spent</th>
                  <th className="th num">Per sq.ft</th>
                </tr>
              </thead>
              <tbody>
                {rollups.map((r) => (
                  <tr key={r.materialKey}>
                    <td className="td font-medium">{materialLabel(r.materialKey)}</td>
                    <td className="td num">
                      {formatQty(r.qty)} <span className="text-mute text-xs">{r.unit}</span>
                    </td>
                    <td className="td num">{formatRate(r.avgRate)}</td>
                    <td className={`td num text-xs ${r.minRate > 0 && r.maxRate / r.minRate > 1.15 ? "text-alert" : "text-mute"}`}>
                      {formatRate(r.minRate)} – {formatRate(r.maxRate)}
                    </td>
                    <td className="td text-xs text-mute">{r.vendors.join(", ") || "—"}</td>
                    <td className="td num">{money(r.amount)}</td>
                    <td className="td num text-mute">{(r.qty / (selected.area_sqft || 1)).toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-paper font-medium">
                  <td className="td" colSpan={5}>Total</td>
                  <td className="td num">{money(total)}</td>
                  <td className="td" />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      <Card title="Every bill" subtitle={`${purchases.length} on this build`}>
        {purchases.length === 0 ? (
          <Empty>Nothing recorded yet.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="th">Date</th>
                  <th className="th">Material</th>
                  <th className="th">Vendor</th>
                  <th className="th">Bill no.</th>
                  <th className="th num">Qty</th>
                  <th className="th num">Rate</th>
                  <th className="th num">Freight</th>
                  <th className="th num">Amount</th>
                  <th className="th no-print" />
                </tr>
              </thead>
              <tbody>
                {purchases.map((p) => (
                  <tr key={p.id}>
                    <td className="td whitespace-nowrap">{p.purchased_on}</td>
                    <td className="td">
                      {materialLabel(p.material_key)}
                      {p.note && <div className="text-xs text-mute">{p.note}</div>}
                    </td>
                    <td className="td">{p.vendor || "—"}</td>
                    <td className={`td ${p.invoice_no ? "" : "text-alert"}`}>{p.invoice_no ?? "no bill"}</td>
                    <td className="td num">
                      {formatQty(p.qty)} <span className="text-mute text-xs">{p.unit}</span>
                    </td>
                    <td className="td num">{formatRate(p.rate)}</td>
                    <td className="td num text-mute">{p.freight ? formatQty(p.freight) : "—"}</td>
                    <td className="td num font-medium">{money(lineAmount(p))}</td>
                    <td className="td no-print">
                      <form action={removePurchase}>
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
