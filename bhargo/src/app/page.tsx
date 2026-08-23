import Link from "next/link";

import { Card, Empty, Pill, Stat } from "@/components/ui";
import { getSettings, listAttendance, listPayments, listProjects, listPurchases, listWorkers } from "@/lib/db";
import { formatMoney, formatShort } from "@/lib/money";
import { labourSummary, payrollLedger } from "@/lib/payroll";
import { detectRedFlags } from "@/lib/redflags";
import { compareProjects, rollupByMaterial } from "@/lib/variance";

export const dynamic = "force-dynamic";

export default function OverviewPage() {
  const settings = getSettings();
  const projects = listProjects();
  const money = (n: number) => formatMoney(Math.round(n), settings.currency);

  if (projects.length === 0) {
    return (
      <Card title="Nothing here yet">
        <Empty action={{ href: "/projects", label: "Add your first build" }}>
          Add a build, then record what you buy for it and who works on it. Once a second build
          starts, Bhargo can measure it against the first.
        </Empty>
      </Card>
    );
  }

  const current = projects.find((p) => p.status === "active") ?? projects[0];
  const baseline = projects.find((p) => p.id !== current.id && p.status === "done");

  const purchases = listPurchases({ projectId: current.id });
  const attendance = listAttendance({ projectId: current.id });
  const workers = listWorkers();
  const payments = listPayments({ projectId: current.id });

  const materialSpend = rollupByMaterial(purchases).reduce((sum, r) => sum + r.amount, 0);
  const labour = labourSummary(current, workers, attendance, settings);
  const ledger = payrollLedger(workers, attendance, payments, settings);
  const owed = ledger.reduce((sum, l) => sum + Math.max(l.balance, 0), 0);
  const flags = detectRedFlags(purchases);

  const comparison = baseline
    ? compareProjects(baseline, listPurchases({ projectId: baseline.id }), current, purchases, settings)
    : null;
  const excess = comparison
    ? comparison.totals.excessFromRatePositive + comparison.totals.excessFromQtyPositive
    : 0;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">{current.name}</h1>
        <p className="text-mute text-sm mt-1">
          {current.site ? `${current.site} · ` : ""}
          {current.area_sqft.toLocaleString("en-IN")} sq.ft · started {current.started_on} ·{" "}
          {current.status === "done" ? "finished" : "in progress"}
        </p>
      </header>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat
          label="Materials bought"
          value={formatShort(materialSpend, settings.currency)}
          note={`${money(materialSpend / (current.area_sqft || 1))} per sq.ft so far`}
        />
        <Stat
          label="Labour so far"
          value={formatShort(labour.totalCost, settings.currency)}
          note={`${labour.totalDays.toLocaleString("en-IN")} man-days · ${money(labour.costPerSqft)} per sq.ft`}
        />
        <Stat
          label="Wages still owed"
          value={formatShort(owed, settings.currency)}
          tone={owed > 0 ? "warn" : "ok"}
          note={owed > 0 ? `${ledger.filter((l) => l.balance > 0.5).length} people waiting to be paid` : "Everyone is settled."}
        />
        <Stat
          label={baseline ? `Above ${baseline.name}` : "No baseline build"}
          value={baseline ? formatShort(excess, settings.currency) : "—"}
          tone={excess > 0 ? "alert" : "ok"}
          note={
            baseline
              ? "Rates and quantities past what size and inflation explain."
              : "Mark an older build as finished to compare against it."
          }
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card
          title="Worth asking about"
          subtitle="The bills on this build that stand out"
          right={
            <Link href="/compare" className="btn-quiet no-print">
              Full comparison
            </Link>
          }
        >
          {flags.length === 0 ? (
            <Empty>Nothing odd in the bills so far.</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {flags.slice(0, 5).map((flag, i) => (
                <li key={i} className="px-4 py-3 flex items-start gap-3">
                  <Pill kind={flag.severity}>{flag.severity}</Pill>
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{flag.title}</div>
                    <p className="text-xs text-mute mt-0.5">{flag.detail}</p>
                  </div>
                  {flag.impact != null && (
                    <div className="ml-auto text-sm tabular-nums whitespace-nowrap">{money(flag.impact)}</div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title="Who is owed money"
          right={
            <Link href="/payroll" className="btn-quiet no-print">
              Wage sheet
            </Link>
          }
        >
          {ledger.length === 0 ? (
            <Empty action={{ href: "/people", label: "Mark attendance" }}>
              No attendance recorded on this build yet.
            </Empty>
          ) : (
            <table className="w-full border-collapse">
              <tbody>
                {ledger.slice(0, 8).map((l) => (
                  <tr key={l.worker.id}>
                    <td className="td">
                      <div className="font-medium">{l.worker.name}</div>
                      <div className="text-xs text-mute">
                        <span className="capitalize">{l.worker.trade}</span> · {l.daysWorked} days
                      </div>
                    </td>
                    <td className={`td num font-medium ${l.balance > 0.5 ? "text-warn" : "text-mute"}`}>
                      {money(l.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      {comparison && (
        <Card title={`Against ${baseline!.name}`} subtitle="The three materials costing you the most extra">
          <table className="w-full border-collapse">
            <tbody>
              {comparison.rows
                .filter((r) => r.verdict !== "new" && r.excessTotal > 0)
                .slice(0, 3)
                .map((row) => (
                  <tr key={row.materialKey}>
                    <td className="td">
                      <div className="font-medium">{row.label}</div>
                      <p className="text-xs text-mute mt-0.5 max-w-xl">{row.reasons[0]}</p>
                    </td>
                    <td className="td">
                      <Pill kind={row.verdict} />
                    </td>
                    <td className="td num font-medium text-alert">{money(row.excessTotal)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
          {comparison.rows.filter((r) => r.excessTotal > 0).length === 0 && (
            <Empty>Nothing above what house size and normal price rises explain.</Empty>
          )}
        </Card>
      )}
    </div>
  );
}
