import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// A throwaway database, so these tests never touch anyone's books.
const dbPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "bhargo-test-")), "test.db");
process.env.BHARGO_DB = dbPath;

// Required rather than imported, so the temporary path above is already set
// when the database module first opens a connection.
const { logProblem, recentProblems, problemStats, reportable, isControlFlow, clearAllProblems } =
  require("../src/lib/monitor") as typeof import("../src/lib/monitor");

test("a fault is recorded with a reference to quote", () => {
  clearAllProblems();
  const ref = logProblem({ kind: "server", message: "Database is locked", route: "/payroll" });

  assert.match(ref, /^[0-9A-F]{6}$/);
  const [problem] = recentProblems();
  assert.equal(problem.message, "Database is locked");
  assert.equal(problem.route, "/payroll");
  assert.equal(problem.count, 1);
  assert.equal(problem.ref, ref);
});

test("the same fault counts up instead of filling the list", () => {
  clearAllProblems();
  const first = logProblem({ kind: "server", message: "Disk full", route: "/purchases" });
  const second = logProblem({ kind: "server", message: "Disk full", route: "/purchases" });
  logProblem({ kind: "server", message: "Disk full", route: "/purchases" });

  assert.equal(first, second, "the reference stays the same across repeats");
  assert.equal(recentProblems().length, 1);
  assert.equal(recentProblems()[0].count, 3);
  assert.equal(problemStats().total, 3);
  assert.equal(problemStats().distinct, 1);
});

test("the same fault in a different place is a different fault", () => {
  clearAllProblems();
  logProblem({ kind: "server", message: "Disk full", route: "/purchases" });
  logProblem({ kind: "server", message: "Disk full", route: "/payroll" });

  assert.equal(recentProblems().length, 2);
});

test("secrets are cut out before anything is written down", () => {
  clearAllProblems();
  logProblem({
    kind: "action",
    message: 'signIn failed for password="hunter2" token=abc123',
    stack: "at verify (scrypt$a1b2c3$d4e5f6)",
  });

  const [problem] = recentProblems();
  assert.doesNotMatch(problem.message, /hunter2/);
  assert.doesNotMatch(problem.message, /abc123/);
  assert.doesNotMatch(problem.stack ?? "", /a1b2c3/);
  assert.match(problem.message, /\[removed\]/);
  assert.match(problem.stack ?? "", /\[password hash\]/);
});

test("a very long stack is trimmed rather than stored whole", () => {
  clearAllProblems();
  logProblem({ kind: "server", message: "x".repeat(9000), stack: "y".repeat(9000) });

  const [problem] = recentProblems();
  assert.ok(problem.message.length <= 4000);
  assert.ok((problem.stack ?? "").length <= 4000);
});

test("a wrapped action records what broke and still throws it on", async () => {
  clearAllProblems();
  const boom = reportable("addPurchase", async () => {
    throw new Error("no such column: qty");
  });

  await assert.rejects(boom, /no such column/);

  const [problem] = recentProblems();
  assert.equal(problem.kind, "action");
  assert.equal(problem.route, "addPurchase");
  assert.match(problem.message, /no such column/);
  assert.ok(problem.stack);
});

test("a redirect is how the app navigates, not a fault", async () => {
  clearAllProblems();
  const redirecting = reportable("addProject", async () => {
    const error = new Error("NEXT_REDIRECT") as Error & { digest: string };
    error.digest = "NEXT_REDIRECT;replace;/projects;307;";
    throw error;
  });

  await assert.rejects(redirecting);
  assert.equal(recentProblems().length, 0, "redirects must not be logged as problems");

  const notFound = { digest: "NEXT_NOT_FOUND" };
  assert.equal(isControlFlow(notFound), true);
  assert.equal(isControlFlow(new Error("real failure")), false);
});

test("a wrapped action that works is left completely alone", async () => {
  clearAllProblems();
  const fine = reportable("savePrice", async (a: number, b: number) => a + b);

  assert.equal(await fine(2, 3), 5);
  assert.equal(recentProblems().length, 0);
});

test("a page failure reported from both sides is one fault, not two", () => {
  clearAllProblems();

  // The browser only ever sees Next's redacted line.
  const fromBrowser = logProblem({
    kind: "browser",
    message: "An error occurred in the Server Components render.",
    route: "/purchases",
    digest: "2948480710",
  });

  // The server knows what actually happened.
  const fromServer = logProblem({
    kind: "server",
    message: "no such table: price_book",
    stack: "at Database.prepare (db.ts:120)",
    digest: "2948480710",
  });

  assert.equal(fromBrowser, fromServer, "the same digest means the same fault");

  const problems = recentProblems();
  assert.equal(problems.length, 1);
  assert.equal(problems[0].message, "no such table: price_book", "the useful message wins");
  assert.equal(problems[0].kind, "server");
  assert.equal(problems[0].count, 2);
});

test("faults without a digest are still told apart normally", () => {
  clearAllProblems();
  logProblem({ kind: "server", message: "Disk full", route: "/a" });
  logProblem({ kind: "server", message: "Out of memory", route: "/b" });

  assert.equal(recentProblems().length, 2);
});
