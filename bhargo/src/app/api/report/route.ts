import { NextRequest, NextResponse } from "next/server";

import { currentUser } from "@/lib/auth";
import { logProblem } from "@/lib/monitor";

export const dynamic = "force-dynamic";

// The browser reports what the error boundary caught. Anyone can post here, so
// nothing is trusted: fields are capped, and the response gives away nothing
// beyond the reference code the person already sees on screen.
export async function POST(request: NextRequest) {
  let body: { message?: unknown; digest?: unknown; route?: unknown; stack?: unknown };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const text = (value: unknown, max: number) => (typeof value === "string" ? value.slice(0, max) : null);
  const message = text(body.message, 500) ?? "Browser reported a problem with no message";

  const ref = logProblem({
    kind: "browser",
    message,
    route: text(body.route, 200),
    stack: text(body.stack, 4000),
    digest: text(body.digest, 100),
    userId: currentUser()?.id ?? null,
  });

  return NextResponse.json({ ok: true, ref });
}
