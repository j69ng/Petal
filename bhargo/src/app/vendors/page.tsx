import { removeQuote, removeVendorAction, saveQuote, saveVendorAction } from "@/lib/actions";
import { Card, Empty, Field, Pill, Stat } from "@/components/ui";
import { isOwner, requireUser } from "@/lib/auth";
import {
  getSettings,
  listProjects,
  listPurchases,
  listQuotes,
  listVendorRecords,
  ratesPaidByVendor,
} from "@/lib/db";
import { MATERIALS, materialLabel } from "@/lib/materials";
import { formatMoney, formatQty, formatRate, formatShort } from "@/lib/money";
import { knownRates, savingsReport } from "@/lib/sourcing";

export const dynamic = "force-dynamic";

/**
 * The rate book. Every price anyone has been given, in one place, so the next
 * bill can be checked against it — and so a rate collected on a phone call in
 * March is still working for the company in November.
 */
export default function VendorsPage({ searchParams }: { searchParams: { project?: string } }) {
  const user = requireUser();
  const settings = getSettings();
  const money = (n: number) => formatMoney(Math.round(n), settings.currency);
  const today = new Date().toISOString().slice(0, 10);

  const quotes = listQuotes();
  const vendors = listVendorRecords();
  const paid = ratesPaidByVendor();
  const rates = knownRates(quotes, paid);

  const projects = listProjects();
  const selected =
    projects.find((p) => p.id === Number(searchParams.project)) ??
    projects.find((p) => p.status === "active") ??
    projects[0];

  const purchases = selected ? listPurchases({ projectId: selected.id }) : [];
  const report = savingsReport(purchases, rates, settings);

  // Cheapest known rate per material, for the table at the top.
  const cheapest = new Map<string, (typeof rates)[number]>();
  for (const rate of rates) {
    if (rate.validUntil && rate.validUntil < today) continue;
    const held = cheapest.get(rate.materialKey);
    if (!held || rate.rate < held.rate) cheapest.set(rate.materialKey, rate);
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl sm:text-2xl font-semibold">Rates and suppliers</h1>
        <p className="text-mute text-sm mt-1 max-w-2xl">
          Write down what each supplier charges — from a phone call, a rate list, a message. Every
          bill entered is then checked against the cheapest rate on this page, and whoever is about
          to pay more is told who to ring instead.
        </p>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat
          label="Rates on the books"
          value={String(rates.length)}
          note={`${quotes.length} written down, ${paid.length} learned from bills you have paid`}
        />
        <Stat label="Suppliers" value={String(vendors.length)} note="phone numbers kept alongside" />
        <Stat
          label="Materials covered"
          value={`${cheapest.size} of ${MATERIALS.length}`}
          note="a material with no rate cannot be checked"
        />
        <Stat
          label={selected ? `Could be saved on ${selected.name}` : "No build selected"}
          value={formatShort(report.total, settings.currency)}
          tone={report.total > 0 ? "alert" : "ok"}
          note={report.total > 0 ? "buying at the best known rate instead" : "nothing cheaper on the books"}
        />
      </div>

      {report.lines.length > 0 && selected && (
        <Card
          title="Where the money is going"
          subtitle={`${selected.name} — what each material has cost against the best rate you know of`}
        >
          <div className="scroll-x">
            <table className="w-full border-collapse min-w-[44rem]">
              <thead>
                <tr>
                  <th className="th">Material</th>
                  <th className="th num">Bought</th>
                  <th className="th num">Paid</th>
                  <th className="th num">Best known</th>
                  <th className="th">Who has it cheaper</th>
                  <th className="th num">Could have saved</th>
                </tr>
              </thead>
              <tbody>
                {report.lines.map((line) => (
                  <tr key={line.materialKey}>
                    <td className="td font-medium">{materialLabel(line.materialKey)}</td>
                    <td className="td num">
                      {formatQty(line.qty)} <span className="text-mute text-xs">{line.unit}</span>
                    </td>
                    <td className="td num">{formatRate(line.paidRate)}</td>
                    <td className="td num text-ok">{formatRate(line.best.rate)}</td>
                    <td className="td">
                      <div className="font-medium">{line.best.vendor}</div>
                      <div className="text-xs text-mute">
                        {line.best.source === "quoted" ? "quoted" : "you paid this before"} · {line.best.asOf}
                        {vendors.find((v) => v.name.toLowerCase() === line.best.vendor.toLowerCase())?.phone
                          ? ` · ${vendors.find((v) => v.name.toLowerCase() === line.best.vendor.toLowerCase())!.phone}`
                          : ""}
                      </div>
                    </td>
                    <td className="td num font-medium text-alert">
                      {money(line.saving)}
                      <div className="text-xs text-mute font-normal">{line.savingPct.toFixed(0)}% lower</div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-paper font-medium">
                  <td className="td" colSpan={5}>
                    On this build
                  </td>
                  <td className="td num text-alert">{money(report.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="px-4 py-3 border-t border-line text-xs text-mute">
            A cheaper rate is worth a phone call, not an automatic switch — check the grade, the
            delivery and whether they can supply the quantity before moving an order.
          </p>
        </Card>
      )}

      <Card title="Add a rate" subtitle="One line per supplier, per material. Rods per kg, sand per cft, paint per litre.">
        <form action={saveQuote} className="p-3 sm:p-4 space-y-3">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Field label="Supplier" className="col-span-2 lg:col-span-1">
              <input name="vendor" list="known-vendors" required placeholder="Shree Traders" className="input" />
              <datalist id="known-vendors">
                {vendors.map((v) => (
                  <option key={v.name} value={v.name} />
                ))}
              </datalist>
            </Field>
            <Field label="Material">
              <select name="material_key" className="input" defaultValue="cement">
                {MATERIALS.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Unit" hint="kg, bag, cft, litre, sqft, nos">
              <input name="unit" placeholder="bag (50kg)" className="input" />
            </Field>
            <Field label="Rate per unit">
              <input name="rate" type="number" inputMode="decimal" step="any" min="0" required className="input" />
            </Field>
            <Field label="Phone" hint="Saved against the supplier">
              <input name="phone" inputMode="tel" className="input" />
            </Field>
            <Field label="Area">
              <input name="area" placeholder="Hill Road" className="input" />
            </Field>
            <Field label="Least quantity" hint="Leave empty if the rate holds for any load">
              <input name="min_qty" type="number" inputMode="decimal" step="any" min="0" className="input" />
            </Field>
            <Field label="Delivery">
              <select name="delivery_included" className="input" defaultValue="1">
                <option value="1">Included in the rate</option>
                <option value="0">Extra</option>
              </select>
            </Field>
            <Field label="Quoted on">
              <input name="quoted_on" type="date" defaultValue={today} className="input" />
            </Field>
            <Field label="Good until" hint="After this it stops being offered">
              <input name="valid_until" type="date" className="input" />
            </Field>
            <Field label="Note" className="col-span-2">
              <input name="note" placeholder="Grade, brand, who you spoke to" className="input" />
            </Field>
          </div>
          <button className="btn">Save rate</button>
        </form>
      </Card>

      <Card
        title="Every rate you know"
        subtitle="Cheapest first, per material. Rates learned from bills you have already paid are marked."
      >
        {rates.length === 0 ? (
          <Empty>
            Nothing yet. Ring three suppliers for cement, steel and sand, write the rates down here,
            and the next bill gets checked against them.
          </Empty>
        ) : (
          <div className="scroll-x">
            <table className="w-full border-collapse min-w-[40rem]">
              <thead>
                <tr>
                  <th className="th">Material</th>
                  <th className="th">Supplier</th>
                  <th className="th num">Rate</th>
                  <th className="th">Where from</th>
                  <th className="th">Conditions</th>
                  <th className="th no-print" />
                </tr>
              </thead>
              <tbody>
                {rates.map((rate, i) => {
                  const stale = !!rate.validUntil && rate.validUntil < today;
                  const isCheapest = cheapest.get(rate.materialKey)?.vendor === rate.vendor && !stale;
                  const quoteRow = quotes.find(
                    (q) =>
                      q.vendor === rate.vendor &&
                      q.material_key === rate.materialKey &&
                      q.rate === rate.rate &&
                      q.quoted_on === rate.asOf
                  );

                  return (
                    <tr key={`${rate.vendor}-${rate.materialKey}-${i}`} className={stale ? "opacity-50" : undefined}>
                      <td className="td">{materialLabel(rate.materialKey)}</td>
                      <td className="td font-medium">{rate.vendor}</td>
                      <td className="td num">
                        {formatRate(rate.rate)} <span className="text-xs text-mute">/{rate.unit}</span>
                      </td>
                      <td className="td">
                        {rate.source === "quoted" ? (
                          <Pill kind={isCheapest ? "ok" : "low"}>quoted {rate.asOf}</Pill>
                        ) : (
                          <Pill kind="low">paid {rate.asOf}</Pill>
                        )}
                      </td>
                      <td className="td text-xs text-mute">
                        {stale && <span className="text-alert">expired {rate.validUntil} · </span>}
                        {rate.minQty ? `min ${formatQty(rate.minQty)} ${rate.unit}` : "any quantity"}
                        {rate.deliveryIncluded ? " · delivered" : " · delivery extra"}
                        {rate.note ? ` · ${rate.note}` : ""}
                      </td>
                      <td className="td no-print">
                        {quoteRow && (
                          <form action={removeQuote}>
                            <input type="hidden" name="id" value={quoteRow.id} />
                            <button className="btn-quiet">Delete</button>
                          </form>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Suppliers" subtitle="Numbers to ring when a rate looks wrong">
        <div className="divide-y divide-line">
          <form action={saveVendorAction} className="p-3 sm:p-4 grid grid-cols-2 lg:grid-cols-5 gap-3 items-end">
            <Field label="Name">
              <input name="name" required className="input" />
            </Field>
            <Field label="Phone">
              <input name="phone" inputMode="tel" className="input" />
            </Field>
            <Field label="Area">
              <input name="area" className="input" />
            </Field>
            <Field label="Note" className="col-span-2 lg:col-span-1">
              <input name="note" placeholder="Supplies rods and binding wire" className="input" />
            </Field>
            <button className="btn">Save supplier</button>
          </form>

          {vendors.map((vendor) => (
            <details key={vendor.name} className="p-3 sm:p-4">
              <summary className="flex flex-wrap items-center gap-x-3 gap-y-1 cursor-pointer list-none">
                <span className="font-medium">{vendor.name}</span>
                {vendor.phone && (
                  <a href={`tel:${vendor.phone.replace(/[^+\d]/g, "")}`} className="text-brand text-sm underline">
                    {vendor.phone}
                  </a>
                )}
                {vendor.area && <span className="text-xs text-mute">{vendor.area}</span>}
                <span className="ml-auto text-xs text-mute">
                  {rates.filter((r) => r.vendor.toLowerCase() === vendor.name.toLowerCase()).length} rates
                </span>
              </summary>

              <form action={saveVendorAction} className="mt-3 grid grid-cols-2 lg:grid-cols-5 gap-3 items-end">
                <input type="hidden" name="name" value={vendor.name} />
                <Field label="Phone">
                  <input name="phone" inputMode="tel" defaultValue={vendor.phone ?? ""} className="input" />
                </Field>
                <Field label="Area">
                  <input name="area" defaultValue={vendor.area ?? ""} className="input" />
                </Field>
                <Field label="Note" className="col-span-2">
                  <input name="note" defaultValue={vendor.note ?? ""} className="input" />
                </Field>
                <div className="flex gap-2">
                  <button className="btn">Save</button>
                  {isOwner(user) && (
                    <button formAction={removeVendorAction} className="btn-quiet text-alert border-alert/30">
                      Delete
                    </button>
                  )}
                </div>
              </form>
            </details>
          ))}
        </div>
      </Card>

      <Card title="What this can and cannot do">
        <div className="p-4 text-sm text-mute space-y-2">
          <p>
            Bhargo cannot go out and find local suppliers by itself — no service publishes what the
            cement shop down the road charges today. What it does instead is make sure a rate is
            never collected twice: write one down once and it works for you on every bill from then
            on, and every load you buy quietly teaches it what that supplier will accept.
          </p>
          <p>
            The practical way to fill this page: ring three suppliers for the five materials that
            make up most of a build — cement, rods, sand, aggregate, bricks. Half an hour of calls,
            and every bill after it is checked against real local rates.
          </p>
        </div>
      </Card>
    </div>
  );
}
