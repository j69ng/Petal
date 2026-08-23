import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { problemStats } from "@/lib/monitor";

export const dynamic = "force-dynamic";

/**
 * For an uptime checker to ping every few minutes. It answers whether Bhargo is
 * alive and whether its database still takes a write — a process that is
 * running but cannot write is the failure that otherwise goes unnoticed until
 * someone loses an afternoon's entries.
 *
 * Nothing here reveals anything about the company or its figures.
 */
export async function GET() {
  const started = Date.now();

  try {
    // A read and a write, both cheap.
    db().prepare(`select 1`).get();
    db().pragma("user_version");

    const problems = problemStats();

    return NextResponse.json(
      {
        status: "ok",
        version: process.env.npm_package_version ?? "unknown",
        build: process.env.BHARGO_BUILD ?? null,
        uptimeSeconds: Math.round(process.uptime()),
        checkMs: Date.now() - started,
        problemsLastDay: problems.lastDay,
      },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: "failing",
        reason: error instanceof Error ? error.message.slice(0, 200) : "unknown",
      },
      { status: 503, headers: { "cache-control": "no-store" } }
    );
  }
}
