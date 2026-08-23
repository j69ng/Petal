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

**There is no login.** Anyone who can reach the port can read and change the books, so
run it on your own machine or your own network, not on a public server. Putting it online
means adding authentication first.

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
    db.ts         SQLite schema and queries
    actions.ts    form handlers
scripts/seed.ts   sample data
tests/            the arithmetic, under test
data/bhargo.db    your books (gitignored)
```

Built with Next.js, SQLite (better-sqlite3) and Tailwind.
