// A demo deployment: somewhere to click around before anyone commits to
// hosting. It carries the sample builds and a ready-made account, and it
// forgets everything — the host it runs on has no permanent disk, so the file
// is rebuilt whenever the server restarts.
//
// That is stated on every screen rather than buried here. A demo mistaken for
// the real thing is how a company loses a month of records.

import { createUser, userCount } from "./auth";
import { db } from "./db";
import { seedSampleData } from "./seed";

export const DEMO_USERNAME = "demo";
export const DEMO_PASSWORD = "bhargo-demo";

export function isDemo(): boolean {
  if (process.env.BHARGO_DEMO === "1") return true;
  // A serverless host with nowhere permanent to write can only ever be a demo.
  // Better it announces that than pretends to keep a company's records.
  return !!process.env.VERCEL && !process.env.BHARGO_DB;
}

let prepared = false;

/**
 * Fills an empty demo database on first use. Cheap to call on every render:
 * after the first one it is a flag check.
 */
export async function prepareDemo(): Promise<void> {
  if (!isDemo() || prepared) return;
  prepared = true;

  try {
    const projects = (db().prepare(`select count(*) as n from projects`).get() as { n: number }).n;
    if (projects === 0) seedSampleData();

    if (userCount() === 0) {
      await createUser({
        name: "Demo owner",
        username: DEMO_USERNAME,
        password: DEMO_PASSWORD,
        role: "owner",
      });
    }
  } catch (error) {
    // A demo that cannot set itself up should still show its sign-in page.
    console.error("[bhargo] demo setup failed:", error);
  }
}
