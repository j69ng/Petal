// What breaks, recorded where the person using Bhargo never has to look at it.
//
// Two rules shape this file. First, a problem must never be lost: it is written
// to the company's own database, not held in memory where a restart wipes it.
// Second, a problem report must never carry the company's books off their
// server. What is stored is the route, the error and the stack — never form
// values, never rows. The optional webhook sends less again: a one-line summary
// so whoever maintains Bhargo knows to go and look.

import { randomBytes } from "node:crypto";

import { db } from "./db";

export type ProblemKind = "server" | "browser" | "action" | "startup";

export interface Problem {
  id: number;
  /** Short code shown to the person who hit it, so support can find this exact row. */
  ref: string;
  kind: ProblemKind;
  route: string | null;
  message: string;
  stack: string | null;
  /** Which account hit it — an id, never a name or anything they typed. */
  user_id: number | null;
  /** Next.js digest, which ties a browser report to the server's own log line. */
  digest: string | null;
  seen_at: string;
  /** How many times this same fault has been recorded. */
  count: number;
}

/** Anything that looks like a secret is cut before it is written down. */
function scrub(text: string): string {
  return text
    .replace(/(password|token|secret|key|cookie|session)["'\s:=]+[^\s,;"')]+/gi, "$1=[removed]")
    .replace(/scrypt\$[0-9a-f]+\$[0-9a-f]+/gi, "[password hash]")
    .slice(0, 4000);
}

/** Next attaches a digest to server errors; it ties a browser report to this log line. */
function digestOf(error: unknown): string | null {
  const digest = (error as { digest?: unknown })?.digest;
  return typeof digest === "string" ? digest : null;
}

/** Redirects are how the app navigates, not faults. */
export function isControlFlow(error: unknown): boolean {
  const digest = digestOf(error);
  return !!digest && (digest.startsWith("NEXT_REDIRECT") || digest === "NEXT_NOT_FOUND");
}

function fingerprint(kind: string, route: string | null, message: string): string {
  // Same fault in the same place counts up rather than filling the list.
  return `${kind}|${route ?? "-"}|${message.slice(0, 200)}`;
}

/**
 * Record a problem. Returns a short reference to show the person who hit it —
 * "quote A7F3K2" turns a vague complaint into one row.
 */
export function logProblem(input: {
  kind: ProblemKind;
  message: string;
  route?: string | null;
  stack?: string | null;
  userId?: number | null;
  digest?: string | null;
}): string {
  const message = scrub(String(input.message || "Unknown problem"));
  const route = input.route ? scrub(input.route).slice(0, 200) : null;
  const print = fingerprint(input.kind, route, message);

  try {
    // One fault, one row. A page that fails is reported twice — once from the
    // server with the real message, once from the browser with the message Next
    // redacts — and both carry the same digest, so the digest joins them rather
    // than leaving two rows to read as two problems.
    const existing = (input.digest
      ? (db()
          .prepare(`select id, ref from problems where digest = ? order by id desc limit 1`)
          .get(input.digest) as { id: number; ref: string } | undefined)
      : undefined) ??
      (db()
        .prepare(`select id, ref from problems where fingerprint = ? order by id desc limit 1`)
        .get(print) as { id: number; ref: string } | undefined);

    if (existing) {
      // The server knows what actually went wrong; the browser only has the
      // redacted line. Let the better message replace the poorer one.
      const better = input.kind === "server" && !!input.stack;
      db()
        .prepare(
          better
            ? `update problems set count = count + 1, seen_at = ?, message = ?, stack = ?, kind = 'server' where id = ?`
            : `update problems set count = count + 1, seen_at = ? where id = ?`
        )
        .run(
          ...(better
            ? [new Date().toISOString(), message, input.stack ? scrub(input.stack) : null, existing.id]
            : [new Date().toISOString(), existing.id])
        );
      return existing.ref;
    }

    const ref = randomBytes(3).toString("hex").toUpperCase();
    db()
      .prepare(
        `insert into problems (ref, fingerprint, kind, route, message, stack, user_id, digest, seen_at, count)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
      )
      .run(
        ref,
        print,
        input.kind,
        route,
        message,
        input.stack ? scrub(input.stack) : null,
        input.userId ?? null,
        input.digest ?? null,
        new Date().toISOString()
      );

    void alert(ref, input.kind, route, message);
    return ref;
  } catch (error) {
    // If even the logging fails, the app must still answer the request — but say
    // so on the console, or a broken log looks exactly like a quiet one.
    console.error("[bhargo] could not record a problem:", error);
    return "------";
  }
}

// A new fault is worth a message; the same fault every minute is not.
const lastAlert = new Map<string, number>();
const ALERT_GAP_MS = 15 * 60 * 1000;

/**
 * Optional nudge to whoever maintains Bhargo — a Slack, Discord or generic
 * webhook. Deliberately thin: what broke and where, never the data involved.
 */
async function alert(ref: string, kind: string, route: string | null, message: string): Promise<void> {
  const url = process.env.BHARGO_ALERT_WEBHOOK?.trim();
  if (!url) return;

  const key = `${kind}|${route}`;
  const last = lastAlert.get(key) ?? 0;
  if (Date.now() - last < ALERT_GAP_MS) return;
  lastAlert.set(key, Date.now());

  const site = process.env.BHARGO_SITE_NAME?.trim() || "Bhargo";
  const text = `${site}: ${kind} problem at ${route ?? "unknown route"} — ${message.slice(0, 200)} (ref ${ref})`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      // `text` suits Slack and Discord; `content` is what Discord actually reads.
      body: JSON.stringify({ text, content: text, ref, kind, route }),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) console.error(`[bhargo] alert webhook returned ${response.status}`);
  } catch (error) {
    // A webhook that will not answer must never take the app down with it.
    console.error("[bhargo] alert webhook failed:", error);
  }
}

export function recentProblems(limit = 50): Problem[] {
  return db()
    .prepare(`select * from problems order by seen_at desc limit ?`)
    .all(limit) as Problem[];
}

export function problemStats(): { total: number; distinct: number; lastDay: number; newest: string | null } {
  const row = db()
    .prepare(
      `select coalesce(sum(count), 0) as total,
              count(*) as distinct_count,
              coalesce(sum(case when seen_at > ? then count else 0 end), 0) as last_day,
              max(seen_at) as newest
       from problems`
    )
    .get(new Date(Date.now() - 86_400_000).toISOString()) as {
    total: number;
    distinct_count: number;
    last_day: number;
    newest: string | null;
  };

  return { total: row.total, distinct: row.distinct_count, lastDay: row.last_day, newest: row.newest };
}

export function clearProblem(id: number): void {
  db().prepare(`delete from problems where id = ?`).run(id);
}

export function clearAllProblems(): void {
  db().prepare(`delete from problems`).run();
}

/** Keeps the list from growing forever on a long-running install. */
export function pruneProblems(keepDays = 90): void {
  db()
    .prepare(`delete from problems where seen_at < ?`)
    .run(new Date(Date.now() - keepDays * 86_400_000).toISOString());
}

/**
 * Catches the two failures that otherwise leave no trace: an exception nobody
 * handled, and a promise nobody awaited. Both would go to a console that, on a
 * small server, nobody is watching.
 *
 * Registered here rather than through Next's instrumentation hook, because that
 * file is compiled for the edge runtime too, where a native database module
 * cannot be loaded. This module only ever loads under Node.
 */
let handlersInstalled = false;

export function installCrashHandlers(): void {
  if (handlersInstalled || typeof process === "undefined" || process.env.NEXT_RUNTIME === "edge") return;
  handlersInstalled = true;

  process.on("uncaughtException", (error) => {
    logProblem({ kind: "server", message: `Uncaught: ${error.message}`, stack: error.stack ?? null });
    console.error("[bhargo] uncaught exception:", error);
  });

  process.on("unhandledRejection", (reason) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    logProblem({ kind: "server", message: `Unhandled rejection: ${error.message}`, stack: error.stack ?? null });
    console.error("[bhargo] unhandled rejection:", reason);
  });

  // A page that fails while rendering never passes through a wrapped action, and
  // what reaches the browser is redacted by design — "an error occurred in the
  // Server Components render" and nothing else. The real message goes to the
  // console, so that is where it is picked up. Only genuine thrown errors are
  // taken; framework chatter is left alone.
  const printError = console.error.bind(console);
  let recording = false;

  console.error = (...args: unknown[]) => {
    printError(...args);
    if (recording) return;

    const error = args.find((arg): arg is Error => arg instanceof Error);
    if (!error || isControlFlow(error)) return;
    // Our own notes about a failed log or webhook are not themselves faults.
    if (args.some((arg) => typeof arg === "string" && arg.startsWith("[bhargo]"))) return;

    recording = true;
    try {
      logProblem({
        kind: "server",
        message: error.message,
        stack: error.stack ?? null,
        digest: digestOf(error),
      });
    } finally {
      recording = false;
    }
  };

  // Old faults are noise, not history.
  try {
    pruneProblems();
  } catch {
    // A failed prune must never stop the app from serving.
  }
}

/**
 * Wraps a server action so a failure is recorded with the action's name instead
 * of vanishing into a console nobody reads. The error is re-thrown untouched —
 * the app's own error page still does its job.
 */
export function reportable<Args extends unknown[], Result>(
  name: string,
  fn: (...args: Args) => Promise<Result>
): (...args: Args) => Promise<Result> {
  return async (...args: Args) => {
    try {
      return await fn(...args);
    } catch (error) {
      if (isControlFlow(error)) throw error;
      logProblem({
        kind: "action",
        route: name,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack ?? null : null,
      });
      throw error;
    }
  };
}
