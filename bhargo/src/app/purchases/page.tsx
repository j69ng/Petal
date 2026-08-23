import { removePurchase } from "@/lib/actions";
import PurchaseForm from "@/components/PurchaseForm";
import { Card, Empty, Pill } from "@/components/ui";
import { isOwner, requireUser } from "@/lib/auth";
import {
  getSettings,
  listPriceBook,
  listProjects,
  listPurchases,
  listQuotes,
  listVendors,
  ratesPaidByVendor,
} from "@/lib/db";
import { materialLabel } from "@/lib/materials";
import { formatMoney, formatQty, formatRate } from "@/lib/money";
import { checkAgainstUsual } from "@/lib/pricecheck";
import { findAlternative, knownRates } from "@/lib/sourcing";
import { lineAmount, rollupByMaterial } from "@/lib/variance";
import type { Purchase } from "@/lib/types";

export const dynamic = "force-dynamic";

const VERDICT_PILL = { "far-over": "alert", over: "watch", under: "ok", fair: "ok", "no-benchmark": "low" } as const;

export default function PurchasesPage({ searchParams }: { searchParams: { project?: string } }) {
  const user = requireUser();
  const settings = getSettings();
  const projects = listProjects();
  const money = (n: number) => formatMoney(Math.round(n), settings.currency);

  if (projects.length === 0) {
    return (
      <Card title="Materials">
        <Empty action={{ href: "/projects", label: "Add a build" }}>
          Materials are recorded against a build, so add a build first.
        </Empty>
      </Card>
    );
  }

  const selected =
    projects.find((p) => p.id === Number(searchParams.project)) ??
    projects.find((p) => p.status === "active") ??
    projects[0];

  const priceBook = listPriceBook();
  const rates = knownRates(listQuotes(), ratesPaidByVendor());
  const bookByKey = new Map(priceBook.map((entry) => [entry.material_key, entry]));
  const all = listPurchases({ projectId: selected.id, status: "all" });
  const confirmed = all.filter((p) => p.status === "approved");
  const waiting = all.filter((p) => p.status === "pending");
  const sentBack = all.filter((p) => p.status === "rejected");

  const rollups = rollupByMaterial(confirmed);
  const total = rollups.reduce((sum, r) => sum + r.amount, 0);

  const checkOf = (purchase: Purchase) =>
    checkAgainstUsual(
      purchase.material_key,
      lineAmount(purchase) / (purchase.qty || 1),
      purchase.qty,
      bookByKey.get(purchase.material_key),
      settings,
      settings.currency
    );

  function Bill({ purchase }: { purchase: Purchase }) {
    const check = checkOf(purchase);
    return (
      <li className="p-3 sm:p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-medium">
              {materialLabel(purchase.material_key)}
              <span className="text-mute font-normal"> · {formatQty(purchase.qty)} {purchase.unit}</span>
            </div>
            <div className="text-xs text-mute mt-0.5">
              {purchase.purchased_on} · {purchase.vendor || "no vendor"} ·{" "}
              {purchase.invoice_no ? `bill ${purchase.invoice_no}` : <span className="text-alert">no bill number</span>}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="font-semibold tabular-nums">{money(lineAmount(purchase))}</div>
            <div className="text-xs text-mute tabular-nums">{formatRate(purchase.rate)} per {purchase.unit}</div>
          </div>
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
            <p className="text-xs text-ok mt-2">{cheaper.message}</p>
          ) : null;
        })()}

        <div className="mt-2 flex flex-wrap items-center gap-2">
          {purchase.status === "pending" && <Pill kind="watch">waiting for owner</Pill>}
          {purchase.status === "rejected" && <Pill kind="alert">sent back</Pill>}
          {check.usualRate !== null && (
            <Pill kind={VERDICT_PILL[check.verdict]}>{check.verdict.replace("-", " ")}</Pill>
          )}
          <span className="text-xs text-mute">{check.message}</span>
        </div>

        {purchase.review_note && (
          <p className="text-xs text-alert mt-1">Sent back: {purchase.review_note}</p>
        )}
        {purchase.note && <p className="text-xs text-mute mt-1">{purchase.note}</p>}

        {(isOwner(user) || purchase.status !== "approved") && (
          <form action={removePurchase} className="mt-2 no-print">
            <input type="hidden" name="id" value={purchase.id} />
            <button className="btn-quiet">Delete</button>
          </form>
        )}
      </li>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold">Materials</h1>
          <p className="text-mute text-sm mt-1">
            {money(total)} confirmed on {selected.name} — {money(total / (selected.area_sqft || 1))} per sq.ft.
            {waiting.length > 0 && ` ${waiting.length} bill${waiting.length === 1 ? "" : "s"} still waiting.`}
          </p>
        </div>
        <form method="get" className="w-full sm:w-auto flex flex-wrap items-end gap-2 no-print">
          <label className="text-xs text-mute flex-1 min-w-[10rem]">
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

      <Card title="Record a bill" subtitle="The rate is checked against your usual price as you type.">
        <PurchaseForm
          projects={projects}
          defaultProjectId={selected.id}
          vendors={listVendors()}
          priceBook={priceBook}
          knownRates={rates}
          settings={settings}
          needsApproval={!isOwner(user)}
        />
      </Card>

      {waiting.length > 0 && (
        <Card
          title={`Waiting to be confirmed (${waiting.length})`}
          subtitle="Out of every total until the owner confirms them"
          right={
            isOwner(user) ? (
              <a href="/approvals" className="btn-quiet">
                Review
              </a>
            ) : undefined
          }
        >
          <ul className="divide-y divide-line">
            {waiting.map((purchase) => (
              <Bill key={purchase.id} purchase={purchase} />
            ))}
          </ul>
        </Card>
      )}

      <Card title="Confirmed, by material" subtitle={selected.name}>
        {rollups.length === 0 ? (
          <Empty>No confirmed bills on this build yet.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[36rem]">
              <thead>
                <tr>
                  <th className="th">Material</th>
                  <th className="th num">Quantity</th>
                  <th className="th num">Average rate</th>
                  <th className="th num">Usual</th>
                  <th className="th num">Spent</th>
                </tr>
              </thead>
              <tbody>
                {rollups.map((r) => {
                  const entry = bookByKey.get(r.materialKey);
                  const gapPct = entry && entry.usual_rate > 0 ? ((r.avgRate - entry.usual_rate) / entry.usual_rate) * 100 : null;
                  return (
                    <tr key={r.materialKey}>
                      <td className="td font-medium">{materialLabel(r.materialKey)}</td>
                      <td className="td num">
                        {formatQty(r.qty)} <span className="text-mute text-xs">{r.unit}</span>
                      </td>
                      <td className="td num">{formatRate(r.avgRate)}</td>
                      <td className={`td num ${gapPct != null && gapPct > settings.watch_pct ? "text-alert" : "text-mute"}`}>
                        {entry ? `${formatRate(entry.usual_rate)}${gapPct != null ? ` (${gapPct > 0 ? "+" : ""}${gapPct.toFixed(0)}%)` : ""}` : "—"}
                      </td>
                      <td className="td num">{money(r.amount)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-paper font-medium">
                  <td className="td" colSpan={4}>Total</td>
                  <td className="td num">{money(total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      <Card title="Every bill" subtitle={`${all.length} on this build`}>
        {all.length === 0 ? (
          <Empty>Nothing recorded yet.</Empty>
        ) : (
          <ul className="divide-y divide-line">
            {[...waiting, ...confirmed, ...sentBack].map((purchase) => (
              <Bill key={purchase.id} purchase={purchase} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
