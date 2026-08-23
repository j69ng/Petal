# Bhargo

Accounts for someone who builds houses: what each person is owed, what every load of
material cost, and — the part that is hard to do by hand — whether the build you are
paying for now is being charged more than the last one.

Runs on your own machine. One SQLite file holds everything. No accounts, no monthly fee.

## The problem it solves

Ask a supplier why cement costs more than it did on your last house and you will hear
"prices went up". Sometimes that is true. The awkward part is working out how much of the
increase is real, because three things move at once:

- the new house is a different size,
- a few years have passed and prices genuinely drift,
- and the quantities are not the same either.

Bhargo holds all three still. For every material it takes the last build's rate, ages it
forward at that material's own normal drift, scales the last build's usage to this
house's floor area, and then splits whatever is left into two numbers:

```
fair rate     = last build's rate x (1 + drift)^years
expected qty  = last build's qty x (this area / last area)

extra from rate     = (rate now - fair rate) x qty now
extra from quantity = (qty now - expected qty) x fair rate
```

Those two always add back up to the difference between what you spent and what the last
build predicts, so the summary reconciles — there is no leftover bucket to argue about.

The split matters because there are two different ways to be charged more. A dearer rate
is the obvious one. The quieter one is a fair rate on a quantity nobody checked: 30% more
cement bags than the same-size house needed last time is a 30% problem even though every
bill looks correct. Bhargo flags both, and the same arithmetic runs over wages — day
rates aged forward, man-days scaled to floor area, so a padded muster roll shows up as
extra days rather than an extra rate.

Some things need no comparison at all, and those are checked against the current build's
own bills: the same bill entered twice, one vendor quietly dearer than another, a rate
that walks upward mid-build, an odd bill among the rest, big money with no invoice number
behind it.

None of this proves anyone is cheating. It tells you which bill to ask about first, with
a number attached.

## Running it

```bash
npm install
npm run seed     # optional: two example builds, one with problems buried in it
npm run dev      # http://localhost:3000
```

The first page you see is **Set up** — it creates the owner account. After that, Bhargo
asks for a username and password and nobody without one gets past the sign-in page.

`npm run seed` wipes the database and writes sample data — a finished 1,800 sq.ft house
and a 2,200 sq.ft one being built three years later. Open **Compare builds** and the
second house should come back with an overcharged cement rate, 30% more cement than the
first house needed, a sand supplier 26% dearer than the other one, one challan entered
twice, and mason day rates ahead of normal wage rise. Delete the sample data (or just
`rm data/bhargo.db`) before entering your own.

Tests cover the comparison arithmetic, the wage ledger and the bill checks:

```bash
npm test
```

## What is in it

| Page | What it is for |
| --- | --- |
| **Overview** | Where the current build stands: spent, owed, and the bills worth asking about |
| **Compare builds** | This build measured against a finished one, material by material and trade by trade |
| **Materials** | Record a bill; see totals per material, rate ranges and who supplied what |
| **People** | The muster roll — mark the day, add workers, set day rates or monthly salaries |
| **Wages** | What each person earned, drew as advances, and is still owed |
| **Builds** | Add a house; floor area lives here |
| **Settings** | What counts as normal price drift and what counts as too much |

## Who can get in

Bhargo has no sign-up. The first run creates the **owner**; every other account is made by
the owner on the **Accounts** page. Two roles:

| | Owner | Staff |
| --- | --- | --- |
| Record bills, attendance, wages, builds | yes | yes |
| Compare builds, see wage sheets | yes | yes |
| Add and remove accounts | yes | no |
| Change thresholds in Settings | yes | no |
| Delete a whole build or worker | yes | no |

Passwords are stored as salted scrypt hashes — not readable, not recoverable, only
resettable by the owner. Sessions are random tokens kept in the database, which is what
makes **Switch off** immediate: the moment an account is switched off or its password
changed, every device signed in as that person is locked out on the next click. Somebody
leaving the company is one button, and everything they recorded stays in the books.

Five wrong passwords in a row on one username put it on hold for a minute, so a guessing
script gets nowhere.

## Making it reachable to your company only

Accounts decide *who* may sign in. Where Bhargo can be reached from is a separate wall,
and the stronger of the two — pick the narrowest one that suits how you work:

**1. One office computer.** Run `npm run start` and use it on that machine. Nothing else
on earth can reach it. Best if one person keeps the books.

**2. The office network.** Run it on one machine, reachable from the others:

```bash
npm run build
npx next start -H 0.0.0.0 -p 3000     # then http://<that-machine-ip>:3000
```

Everyone in the office can reach the sign-in page; nobody outside can, as long as you do
**not** forward port 3000 on your router. This is the usual answer for a company office.

**3. Site staff, from anywhere.** Put the company's phones and laptops on a private
network — [Tailscale](https://tailscale.com) is the least painful, WireGuard if you prefer
to run it yourself — and keep Bhargo bound to that network's address. It then answers only
to devices you added by hand, from any site, with no port open to the world.

**4. On the open internet.** Only if you really need it, and only behind HTTPS:

```bash
BHARGO_SECURE_COOKIES=1 npx next start -p 3000
```

with a reverse proxy (Caddy or nginx) terminating TLS in front of it. Understand the
trade: anyone in the world can now reach your sign-in page, so the passwords become the
only thing between them and your books. Use long ones.

Whichever you choose, `data/bhargo.db` holds both the books and the password hashes.
Back it up somewhere only the company can read.

### Settings you can pass

| Variable | What it does |
| --- | --- |
| `BHARGO_DB` | Where the database file lives (default `data/bhargo.db`) |
| `BHARGO_SECURE_COOKIES` | Set to `1` when serving over HTTPS, so the session cookie is HTTPS-only |
| `PORT` | Port to listen on (default 3000) |

## Things worth knowing

**Floor area is the field that matters.** Every cross-build number is per square foot. A
wrong area bends all of it quietly.

**Day rates are stored per day worked, not per worker.** Raising someone's rate today
never rewrites what last year's work cost, and a mid-build raise stays visible.

**A build in progress reads differently.** Rates can be compared the day a bill arrives.
Quantities cannot — a material below the expected line may simply not have been bought
yet. The comparison page says so, and its headline counts only what is already over. The
"% built" box asks the softer question: at this stage, how much would the last house have
used?

**Lump-sum items** — wiring, plumbing, sanitary — are judged as a whole against house
size, since a "rate per lot" means little on its own.

**Freight is separate from the rate.** Enter it in its own box; the comparison uses
landed cost (goods plus freight) so a low rate with a fat cartage charge cannot hide.

**Back it up by copying one file:** `data/bhargo.db`. That is the whole ledger.

## Layout

```
src/
  app/            pages (Next.js App Router) — one folder per screen
  components/     small shared pieces: nav, cards, stat tiles, verdict pills
  lib/
    variance.ts   build-to-build material comparison (the core arithmetic)
    payroll.ts    wage ledgers, labour cost per sq.ft, trade-by-trade comparison
    redflags.ts   checks that need only one build's own bills
    materials.ts  material catalog and how fast each one normally moves
    auth.ts       accounts, roles, sessions
    password.ts   scrypt hashing, on its own so it can be tested
    db.ts         SQLite schema and queries
    actions.ts    form handlers, each one guarded
scripts/seed.ts   sample data
src/middleware.ts first gate: no session cookie, no pages
tests/            the arithmetic and the password hashing, under test
data/bhargo.db    your books (gitignored)
```

Built with Next.js, SQLite (better-sqlite3) and Tailwind.
