import Link from "next/link";

import { requireUser } from "@/lib/auth";
import { Card, Empty, Pill, Stat } from "@/components/ui";
import { getSettings, listAttendance, listProjects, listPurchases, listWorkers } from "@/lib/db";
import { formatMoney, formatPct, formatQty, formatRate, formatShort } from "@/lib/money";
import { compareLabour, labourSummary } from "@/lib/payroll";
import { detectRedFlags } from "@/lib/redflags";
import { compareProjects } from "@/lib/variance";

export const dynamic = "force-dynamic";

export default function ComparePage({
  searchParams,
}: {
  searchParams: { base?: string; current?: string; progress?: string };
}) {
  requireUser();
  const settings = getSettings();
  const projects = listProjects();

  if (projects.length < 2) {
    return (
      <Card title="Compare builds">
        <Empty action={{ href: "/projects", label: "Add a build" }}>
          Two builds are needed before anything can be compared — one finished build to measure
          against, and the one you are paying for now.
        </Empty>
      </Card>
    );
  }

  // Default to the newest build measured against the most recent finished one.
  const finished = projects.filter((p) => p.status === "done");
  const defaultCurrent = projects.find((p) => p.status !== "done") ?? projects[0];
  const defaultBase = finished.find((p) => p.id !== defaultCurrent.id) ?? projects[projects.length - 1];

  const current = projects.find((p) => p.id === Number(searchParams.current)) ?? defaultCurrent;
  const base = projects.find((p) => p.id === Number(searchParams.base)) ?? defaultBase;
  const progressPct = Number(searchParams.progress) || 100;

  if (base.id === current.id) {
    return (
      <Card title="Compare builds">
        <Empty>Pick two different builds.</Empty>
      </Card>
    );
  }

  const basePurchases = listPurchases({ projectId: base.id });
  const currentPurchases = listPurchases({ projectId: current.id });
  const result = compareProjects(base, basePurchases, current, currentPurchases, settings, { progressPct });

  const workers = listWorkers();
  const labour = compareLabour(
    labourSummary(base, workers, listAttendance({ projectId: base.id }), settings),
    labourSummary(current, workers, listAttendance({ projectId: current.id }), settings),
    settings
  );

  const flags = detectRedFlags(currentPurchases);
  const inProgress = current.status !== "done";
  const money = (n: number) => formatMoney(Math.round(n), settings.currency);

  // Mid-build, the honest headline counts only what is already over: a material
  // that simply has not been bought yet is not a saving.
  const materialExcess = inProgress
    ? result.totals.excessFromRatePositive + result.totals.excessFromQtyPositive
    : result.totals.excessTotal;
  const labourExcess = inProgress
    ? labour.totals.excessFromRatePositive + labour.totals.excessFromDaysPositive
    : labour.totals.excessTotal;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Is this build costing more than the last one?</h1>
          <p className="text-mute text-sm mt-1 max-w-2xl">
            Every figure below scales <strong>{base.name}</strong> up to {current.name}&rsquo;s floor
            area and ages its prices forward at normal market drift. What is left over is the part
            inflation and house size do not explain.
          </p>
        </div>

        <form className="flex flex-wrap items-end gap-2 no-print" method="get">
          <label className="text-xs text-mute">
            <span className="block mb-1">Measure against</span>
            <select name="base" defaultValue={base.id} className="input">
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.area_sqft} sq.ft)
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-mute">
            <span className="block mb-1">This build</span>
            <select name="current" defaultValue={current.id} className="input">
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.area_sqft} sq.ft)
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-mute">
            <span className="block mb-1">% built</span>
            <input name="progress" type="number" min={1} max={200} defaultValue={progressPct} className="input w-20" />
          </label>
          <button className="btn" type="submit">Show</button>
        </form>
      </header>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat
          label="Extra on materials"
          value={formatShort(materialExcess, settings.currency)}
          tone={materialExcess > 0 ? "alert" : "ok"}
          note={
            materialExcess > 0
              ? `${money(inProgress ? result.totals.excessFromRatePositive : result.totals.excessFromRate)} from higher rates, ${money(inProgress ? result.totals.excessFromQtyPositive : result.totals.excessFromQty)} from extra quantity`
              : "Nothing above what size and inflation explain."
          }
        />
        <Stat
          label="Extra on wages"
          value={formatShort(labourExcess, settings.currency)}
          tone={labourExcess > 0 ? "warn" : "ok"}
          note={
            labourExcess > 0
              ? `${money(inProgress ? labour.totals.excessFromRatePositive : labour.totals.excessFromRate)} from day rates, ${money(inProgress ? labour.totals.excessFromDaysPositive : labour.totals.excessFromDays)} from extra man-days`
              : "Day rates and man-days in line with the last build."
          }
        />
        <Stat
          label="Material cost per sq.ft"
          value={money(result.totals.currentPerSqft)}
          note={`${base.name}: ${money(result.totals.basePerSqft)} per sq.ft${inProgress ? " (that build was finished — this one is not yet)" : ""}`}
        />
        <Stat
          label="Bills worth questioning"
          value={String(flags.length)}
          tone={flags.some((f) => f.severity === "high") ? "alert" : flags.length ? "warn" : "ok"}
          note={flags.length ? "Double bills, dearer vendors, rates that moved mid-build." : "Nothing odd in the bills."}
        />
      </div>

      {inProgress && (
        <p className="text-sm bg-brandsoft border border-line rounded px-4 py-3">
          <strong>{current.name} is still being built.</strong> Quantities below are compared against
          the whole of {base.name}
          {progressPct !== 100 ? `, scaled to ${progressPct}% built` : ""}. A material already{" "}
          <em>above</em> that line is worth asking about today; one below it may simply not be
          finished. Rates, on the other hand, are comparable right now.
        </p>
      )}

      <Card
        title="Material by material"
        subtitle={`Fair rate = ${base.name}'s rate aged forward at each material's own drift. Expected quantity = what ${base.name} used, scaled to ${current.area_sqft} sq.ft${progressPct !== 100 ? ` and ${progressPct}% built` : ""}.`}
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="th">Material</th>
                <th className="th">Verdict</th>
                <th className="th num">Rate paid</th>
                <th className="th num">Fair rate</th>
                <th className="th num">Rate gap</th>
                <th className="th num">Quantity</th>
                <th className="th num">Expected</th>
                <th className="th num">Extra money</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row) => (
                <tr key={row.materialKey} className={row.verdict === "alert" ? "bg-alert/[0.03]" : undefined}>
                  <td className="td">
                    <div className="font-medium">{row.label}</div>
                    <div className="text-xs text-mute">per {row.unit}</div>
                  </td>
                  <td className="td">
                    <Pill kind={row.verdict} />
                    {row.reasons.length > 0 && (
                      <ul className="mt-1.5 space-y-1 text-xs text-mute max-w-sm">
                        {row.reasons.map((reason, i) => (
                          <li key={i}>{reason}</li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td className="td num">{formatRate(row.current.avgRate)}</td>
                  <td className="td num">{formatRate(row.fairRate)}</td>
                  <td className={`td num ${row.ratePremiumPct > settings.watch_pct ? "text-alert" : "text-mute"}`}>
                    {row.verdict === "new" ? "—" : formatPct(row.ratePremiumPct, 0)}
                  </td>
                  <td className="td num">{formatQty(row.current.qty)}</td>
                  <td className={`td num ${row.qtyOverrunPct > settings.qty_watch_pct ? "text-alert" : "text-mute"}`}>
                    {row.verdict === "new"
                      ? "—"
                      : `${formatQty(Math.round(row.expectedQty))} (${formatPct(row.qtyOverrunPct, 0)})`}
                  </td>
                  <td className={`td num font-medium ${row.excessTotal > 0 ? "text-alert" : "text-mute"}`}>
                    {row.verdict === "new" ? "—" : money(row.excessTotal)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-paper font-medium">
                <td className="td" colSpan={5}>Comparable materials</td>
                <td className="td num" colSpan={2}>
                  {money(result.totals.comparableSpend)} spent vs {money(result.totals.expectedSpend)} expected
                </td>
                <td className={`td num ${result.totals.excessTotal > 0 ? "text-alert" : ""}`}>
                  {money(result.totals.excessTotal)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {(result.totals.uncomparableSpend > 0 || result.notBoughtYet.length > 0) && (
          <div className="px-4 py-3 text-xs text-mute border-t border-line space-y-1">
            {result.totals.uncomparableSpend > 0 && (
              <p>
                {money(result.totals.uncomparableSpend)} went on materials the last build never used, so
                there is no baseline price for them.
              </p>
            )}
            {result.notBoughtYet.length > 0 && (
              <p>Bought last time, not yet on this build: {result.notBoughtYet.map((r) => r.materialKey).join(", ")}.</p>
            )}
          </div>
        )}
      </Card>

      <Card title="Bills worth questioning" subtitle="These come from this build's own bills — no comparison needed.">
        {flags.length === 0 ? (
          <Empty>Nothing odd: no repeated bills, no rate jumps, no vendor charging more than another.</Empty>
        ) : (
          <ul className="divide-y divide-line">
            {flags.map((flag, i) => (
              <li key={i} className="px-4 py-3 flex items-start gap-3">
                <Pill kind={flag.severity}>{flag.severity}</Pill>
                <div className="min-w-0">
                  <div className="font-medium text-sm">{flag.title}</div>
                  <p className="text-sm text-mute mt-0.5">{flag.detail}</p>
                </div>
                {flag.impact != null && (
                  <div className="ml-auto text-sm font-medium tabular-nums whitespace-nowrap">{money(flag.impact)}</div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card
        title="Wages, trade by trade"
        subtitle={`Day rates aged forward at ${settings.inflation_pct}%/yr, man-days scaled to floor area. Overtime is kept out of the day rate so the comparison stays like-for-like.`}
      >
        {labour.rows.length === 0 ? (
          <Empty action={{ href: "/people", label: "Mark attendance" }}>
            No attendance recorded on this build yet.
          </Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="th">Trade</th>
                  <th className="th">Verdict</th>
                  <th className="th num">Day rate now</th>
                  <th className="th num">Fair day rate</th>
                  <th className="th num">Gap</th>
                  <th className="th num">Man-days</th>
                  <th className="th num">Expected</th>
                  <th className="th num">Extra money</th>
                </tr>
              </thead>
              <tbody>
                {labour.rows.map((row) => (
                  <tr key={row.trade}>
                    <td className="td capitalize font-medium">{row.trade}</td>
                    <td className="td">
                      <Pill kind={row.verdict} />
                      {row.reasons.length > 0 && (
                        <ul className="mt-1.5 space-y-1 text-xs text-mute max-w-sm">
                          {row.reasons.map((reason, i) => (
                            <li key={i}>{reason}</li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className="td num">{formatRate(row.currentDayRate)}</td>
                    <td className="td num">{formatRate(row.fairDayRate)}</td>
                    <td className={`td num ${row.ratePremiumPct > settings.watch_pct ? "text-alert" : "text-mute"}`}>
                      {row.verdict === "new" ? "—" : formatPct(row.ratePremiumPct, 0)}
                    </td>
                    <td className="td num">{formatQty(row.currentDays)}</td>
                    <td className={`td num ${row.daysOverrunPct > settings.qty_watch_pct ? "text-alert" : "text-mute"}`}>
                      {row.verdict === "new"
                        ? "—"
                        : `${formatQty(Math.round(row.expectedDays))} (${formatPct(row.daysOverrunPct, 0)})`}
                    </td>
                    <td className={`td num font-medium ${row.excessTotal > 0 ? "text-alert" : "text-mute"}`}>
                      {row.verdict === "new" ? "—" : money(row.excessTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="px-4 py-3 text-xs text-mute border-t border-line">
          {inProgress && (
            <p className="mb-1">
              {current.name} is not finished, so man-days below the expected line usually just mean
              work still to come. The day rates are the part to read today.
            </p>
          )}
          Overtime: {money(labour.totals.currentOtCost)} on this build against {money(labour.totals.baseOtCost)} on{" "}
          {base.name}.{" "}
          <Link href="/payroll" className="underline">See what each person is owed</Link>.
        </div>
      </Card>

      <p className="text-xs text-mute">
        How to read this: a fair rate is what the last build&rsquo;s price becomes after normal yearly
        drift, so anything above it is a real increase, not inflation. Extra money is split into the
        part caused by the rate and the part caused by quantity — the two always add back up to the
        difference between what you spent and what the last build predicts. None of this proves
        dishonesty on its own; it tells you which bill to ask about first.
      </p>
    </div>
  );
}
