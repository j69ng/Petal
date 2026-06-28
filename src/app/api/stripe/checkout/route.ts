import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe, PRO_PRICE_IDS, BillingInterval } from "@/lib/stripe";

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const interval: BillingInterval = body.interval === "year" ? "year" : "month";
  const priceId = PRO_PRICE_IDS[interval];
  if (!priceId) {
    return NextResponse.json({ error: "Pricing isn't configured yet" }, { status: 500 });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  // payment_method_types is intentionally omitted — Stripe Checkout automatically
  // offers every method you've turned on in Dashboard > Settings > Payment methods
  // (card, Apple Pay, Google Pay, Link, regional bank debits, etc.) based on the
  // customer's currency and location. Nothing to hard-code here.
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: user.email,
    client_reference_id: user.id,
    line_items: [{ price: priceId, quantity: 1 }],
    allow_promotion_codes: true,
    success_url: `${siteUrl}/dashboard/settings?upgraded=1`,
    cancel_url: `${siteUrl}/dashboard/settings`,
  });

  return NextResponse.json({ url: session.url });
}
