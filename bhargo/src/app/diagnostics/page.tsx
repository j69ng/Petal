import { clearProblemAction, clearAllProblemsAction } from "@/lib/actions";
import { Card, Empty, Pill, Stat } from "@/components/ui";
import { db, pendingCounts } from "@/lib/db";
import { problemStats, recentProblems } from "@/lib/monitor";

export const dynamic = "force-dynamic";

/**
 * The maintainer's window, not the company's. It is reached by a key rather
 * than an account — whoever keeps Bhargo running should not need a login to the
 * company's books to see that something is broken, and the company should not
 * have to think about any of this.
 *
 * Nothing here is linked from the app. Without BHARGO_OPS_KEY set, the page
 * does not exist at all.
 */
function safelyRead<T>(read: () => T, fallback: T): T {
  try {
    return read();
  } catch {
    return fallback;
  }
}

export default function DiagnosticsPage({ searchParams }: { searchParams: { key?: string } }) {
  const expected = process.env.BHARGO_OPS_KEY?.trim();

  if (!expected || searchParams.key !== expected) {
    return (
      <div className="max-w-md mx-auto mt-16 text-center">
        <h1 className="text-xl font-semibold">Page not found</h1>
        <p className="text-mute text-sm mt-2">Nothing to see here.</p>
      </div>
    );
  }

  const problems = safelyRead(() => recentProblems(100), []);
  const stats = safelyRead(() => problemStats(), { total: 0, distinct: 0, lastDay: 0, newest: null });
  const waiting = safelyRead(() => pendingCounts(), { purchases: 0, payments: 0, attendance: 0, total: 0 });

  // This page has to survive the very breakage it exists to report — a missing
  // table or an unreadable database must still leave the fault list readable.
  const safely = <T,>(read: () => T, fallback: T): T => {
    try {
      return read();
    } catch {
      return fallback;
    }
  };

  const size = safely(
    () =>
      (db().prepare(`pragma page_count`).get() as { page_count: number }).page_count *
      (db().prepare(`pragma page_size`).get() as { page_size: number }).page_size,
    0
  );

  const rows = (table: string) =>
    safely(() => (db().prepare(`select count(*) as n from ${table}`).get() as { n: number }).n, -1);

  const missing = (value: number) => (value < 0 ? "unreadable" : String(value));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl sm:text-2xl font-semibold">Diagnostics</h1>
        <p className="text-mute text-sm mt-1">
          Faults recorded on this installation. Only the maintainer sees this page — it is not linked
          anywhere in the app, and it holds no figures from the books.
        </p>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat
          label="Faults, last 24h"
          value={String(stats.lastDay)}
          tone={stats.lastDay > 0 ? "alert" : "ok"}
          note={stats.newest ? `newest ${stats.newest.slice(0, 16).replace("T", " ")}` : "none recorded"}
        />
        <Stat label="Distinct faults" value={String(stats.distinct)} note={`${stats.total} occurrences in total`} />
        <Stat
          label="Uptime"
          value={`${Math.floor(process.uptime() / 3600)}h ${Math.floor((process.uptime() % 3600) / 60)}m`}
          note={`node ${process.version}`}
        />
        <Stat
          label="Database"
          value={size > 0 ? `${(size / 1_048_576).toFixed(1)} MB` : "unreadable"}
          note={`${missing(rows("purchases"))} bills · ${missing(rows("attendance"))} days · ${missing(rows("payments"))} payments`}
        />
      </div>

      <Card title="How the company is getting on" subtitle="Usage, not contents — enough to know it is being used">
        <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="label">Accounts</div>
            <div className="text-lg font-semibold">{missing(rows("users"))}</div>
          </div>
          <div>
            <div className="label">Builds</div>
            <div className="text-lg font-semibold">{missing(rows("projects"))}</div>
          </div>
          <div>
            <div className="label">Usual prices set</div>
            <div className="text-lg font-semibold">{missing(rows("price_book"))}</div>
          </div>
          <div>
            <div className="label">Waiting on the owner</div>
            <div className="text-lg font-semibold">{waiting.total}</div>
          </div>
        </div>
      </Card>

      <Card
        title="Faults"
        subtitle="Newest first. The same fault counts up rather than repeating."
        right={
          problems.length > 0 ? (
            <form action={clearAllProblemsAction}>
              <input type="hidden" name="key" value={searchParams.key} />
              <button className="btn-quiet">Clear all</button>
            </form>
          ) : undefined
        }
      >
        {problems.length === 0 ? (
          <Empty>Nothing has broken since the last clear-out.</Empty>
        ) : (
          <ul className="divide-y divide-line">
            {problems.map((problem) => (
              <li key={problem.id} className="p-3 sm:p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Pill kind={problem.kind === "browser" ? "watch" : "alert"}>{problem.kind}</Pill>
                      <span className="font-mono text-xs">{problem.ref}</span>
                      {problem.count > 1 && <span className="text-xs text-mute">× {problem.count}</span>}
                    </div>
                    <div className="font-medium mt-1 break-words">{problem.message}</div>
                    <div className="text-xs text-mute mt-0.5">
                      {problem.route ?? "unknown route"} · {problem.seen_at.slice(0, 16).replace("T", " ")}
                      {problem.user_id ? ` · account #${problem.user_id}` : ""}
                      {problem.digest ? ` · digest ${problem.digest}` : ""}
                    </div>
                  </div>
                  <form action={clearProblemAction}>
                    <input type="hidden" name="key" value={searchParams.key} />
                    <input type="hidden" name="id" value={problem.id} />
                    <button className="btn-quiet">Clear</button>
                  </form>
                </div>

                {problem.stack && (
                  <details className="mt-2">
                    <summary className="text-xs text-mute cursor-pointer">Stack</summary>
                    <pre className="text-xs bg-paper border border-line rounded p-2 mt-1 overflow-x-auto whitespace-pre-wrap">
                      {problem.stack}
                    </pre>
                  </details>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Watching it from outside">
        <div className="p-4 text-sm text-mute space-y-2">
          <p>
            Point an uptime checker at <code className="font-mono text-xs">/api/health</code> every
            five minutes. It answers <code className="font-mono text-xs">ok</code> only if the
            database still takes a write — a process that is up but cannot write is the failure that
            otherwise goes unnoticed until someone loses an afternoon of entries.
          </p>
          <p>
            Set <code className="font-mono text-xs">BHARGO_ALERT_WEBHOOK</code> to a Slack or Discord
            webhook and a new fault sends one line: what broke, where, and its reference. Repeats of
            the same fault are held back for fifteen minutes so a loop cannot flood you.
          </p>
        </div>
      </Card>
    </div>
  );
}
