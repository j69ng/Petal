# Petal 🌸

A gentle daily symptom tracker for PCOS, endometriosis, fibromyalgia, and autoimmune
conditions — built around a "bloom calendar" that turns each day into a petal, sized
and colored by severity, instead of another spreadsheet row.

Live demo of the signature visual is on the landing page. The real product sits behind
login: pick your condition(s), log symptoms (including *where* on your body, via an
interactive body map), and watch patterns surface over weeks — clearly marked as
something to bring to a doctor, never a diagnosis.

This is a real, runnable SaaS codebase: Next.js + Supabase (auth & database) + Stripe
(billing). It's MIT-licensed — fork it, self-host it, rebrand it, sell it.

## Stack

- **Next.js 14** (App Router, TypeScript) — frontend + API routes
- **Supabase** — Postgres database + auth, free tier
- **Stripe** — subscription billing, free to integrate (they take a % per transaction)
- **Tailwind CSS** + **Recharts** — styling and charts
- **Vercel** — hosting, free tier

Total cost to run this for real, before you have paying users: **$0/month**. A custom
domain (optional) is the only thing that typically costs money — around $10–15/year.

## 1. Get the code on GitHub

```bash
cd petal
git init
git add .
git commit -m "Initial commit"
```

Create a new repo on [github.com/new](https://github.com/new), then:

```bash
git remote add origin https://github.com/YOUR_USERNAME/petal.git
git branch -M main
git push -u origin main
```

This *is* "open sourcing it" — the MIT license in this repo means anyone can view, fork,
and self-host the code. You still own and run your own hosted version, and that's what
you charge for (this is sometimes called the "open core" model).

## 2. Set up Supabase (free)

1. Go to [supabase.com](https://supabase.com) → New Project (free tier).
2. Once it's created, go to **SQL Editor** → paste the contents of `supabase/schema.sql`
   from this repo → Run. This creates all tables and locks them down with row-level
   security, so users can only ever see their own data.
3. Go to **Authentication → Providers** and make sure Email is enabled. For quick local
   testing you can turn off "Confirm email" under **Authentication → Settings**; turn it
   back on before you launch publicly.
4. Go to **Settings → API** and copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (keep this one secret — never put
     it in client-side code)

## 3. Set up Stripe (free to integrate)

1. Create an account at [stripe.com](https://stripe.com) (test mode is fine to start —
   switch to live mode later by flipping the toggle in the Dashboard and swapping in
   live API keys).
2. **Products** → add one product called "Petal Pro" with **two prices** on it:
   - Recurring, $7.00, billed monthly
   - Recurring, $60.00, billed yearly (this is the ~29% annual discount shown on the
     pricing page — change either number in `src/app/page.tsx` and `SettingsForm.tsx`
     if you want different prices)
   Copy each price's ID (starts with `price_...`):
   - Monthly → `NEXT_PUBLIC_STRIPE_PRICE_ID_MONTHLY`
   - Yearly → `NEXT_PUBLIC_STRIPE_PRICE_ID_YEARLY`
3. **Developers → API keys** → copy the secret key → `STRIPE_SECRET_KEY`.
4. **Developers → Webhooks** → add an endpoint pointing at
   `https://YOUR_DOMAIN/api/stripe/webhook` once you've deployed (step 5), listening for:
   `checkout.session.completed`, `customer.subscription.updated`,
   `customer.subscription.deleted`. Copy the signing secret → `STRIPE_WEBHOOK_SECRET`.

You can skip Stripe entirely at first — the app works fine without it, it just won't
gate the Pro features.

### More payment methods (Apple Pay, Google Pay, bank debits, etc.)

The checkout code doesn't hard-code a list of payment methods — Stripe Checkout
automatically shows whatever you've turned on. Go to **Settings → Payment methods** in
the Stripe Dashboard and enable the ones you want (Apple Pay and Google Pay enable
themselves automatically once your domain is verified, which Stripe walks you through;
card is on by default; bank debits and "buy now, pay later" options vary by region).
Nothing in the codebase needs to change.

### Getting paid — connecting your bank account

This part happens entirely in Stripe's dashboard, not in code, because it requires your
real identity and banking details:

1. In the Stripe Dashboard, go to **Settings → Bank accounts and scheduling**.
2. Add your bank account (routing/account number, or your country's equivalent).
3. Stripe will ask for identity/business verification before paying out live funds —
   this is standard KYC required of every Stripe account, not something specific to
   this app.
4. Once verified, payouts run automatically on Stripe's default schedule (rolling daily
   or weekly depending on your country and account age) straight to that bank account.
   No webhook or extra code is involved — Stripe moves the money on its own schedule
   after it settles a charge.

Stripe takes a small percentage + fixed fee per transaction (varies by country/card
type); everything after that is yours.


## 4. Run it locally

```bash
npm install
cp .env.example .env.local   # fill in the values from steps 2–3
npm run dev
```

Open `http://localhost:3000`.

## 5. Deploy for free

1. Push your code to GitHub (step 1).
2. Go to [vercel.com](https://vercel.com) → New Project → import your GitHub repo.
3. Add the same environment variables from `.env.local` in Vercel's project settings.
4. Deploy. You'll get a free `your-project.vercel.app` URL immediately — no domain or
   credit card required.
5. Go back to Stripe's webhook settings and update the endpoint URL to your real Vercel
   URL.

When you're ready for a custom domain, buy one (Namecheap, Cloudflare, etc., ~$10–15/yr)
and add it under Vercel's **Domains** tab — that's the only step in this whole flow that
typically costs money.

## How the money works

There's no revenue share or investment from anyone else built into this — it's your
code, your Supabase project, your Stripe account. 100% of subscription revenue is yours,
minus whatever Stripe and (eventually) infrastructure take. Free tiers on Vercel and
Supabase comfortably support a real early user base before you'd need to pay for either.

## Project structure

```
src/
  app/                  routes (App Router) — pages and API handlers
    dashboard/          the logged-in product
    api/                logs CRUD + Stripe checkout/portal/webhook
  components/           BloomCalendar, BodyMap, LogForm, charts, etc.
  lib/                  Supabase clients, Stripe client, condition presets, insight logic
supabase/schema.sql     full database schema + row-level security policies
```

## Not medical software

Petal tracks self-reported data and shows the user their own patterns. It never
diagnoses, predicts, or recommends treatment — every insights view says so explicitly.
Keep it that way if you build on this.
