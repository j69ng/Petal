# Try Bhargo in five minutes

Everything below runs on your own computer. Nothing is uploaded anywhere.

## No computer set up for this? Skip to a hosted address

If `git` or `npm` is "not recognised", they are not installed — and you may not
want to install them at all. [deploy/DEPLOY.md](deploy/DEPLOY.md) has a path
that needs nothing but a browser: a host builds it from GitHub and gives you a
public HTTPS address, about fifteen minutes and roughly $7 a month.

Two things to know if you do install them:

- **Node.js gives you `npm`** — one installer from https://nodejs.org (take the
  LTS one) covers both `node` and `npm`.
- **Close the terminal and open a new one afterwards.** An already-open window
  keeps the old settings and will still say "not recognised" even after a
  successful install. This catches nearly everyone once.
- **You do not need Git.** On GitHub, switch to the branch, press the green
  **Code** button and choose **Download ZIP**. Unzip it and use the `bhargo`
  folder inside.

## Start it

You need [Node.js 20 or newer](https://nodejs.org) — the LTS installer, whatever
your machine is. Then:

```bash
git clone https://github.com/j69ng/Petal.git
cd Petal
git checkout claude/bhargo-accounting-software-tidvt7
cd bhargo

npm ci        # installs dependencies, about a minute
npm run demo  # loads the sample builds and starts it
```

Downloaded the ZIP instead? Open a terminal in the unzipped `bhargo` folder and
run the last two lines only. On Windows: open the folder in File Explorer, type
`cmd` in the address bar and press Enter. On a Mac: right-click the folder →
Services → New Terminal at Folder.

If anything is missing, the app says which and what to do — it checks before it
starts rather than failing halfway.

Open **http://localhost:3000**.

`npm run demo` fills the database with two example houses so there is something
to look at. When you want to start clean, delete `data/bhargo.db` and run
`npm run dev` instead — you will get an empty set of books.

## The first screen

You will land on **Set up**. Make yourself the owner:

- Name: your name
- Username: `pradil`
- Password: anything at least 8 characters

That account is now the only way in. There is no sign-up — every other account
is made by you.

## What to look at, in order

**1. Overview.** The current build, what has been spent, who is owed money, and
a red banner: *54 entries are waiting to be confirmed*. That is the sample data
pretending a site supervisor has been busy.

**2. Compare builds.** The centrepiece. The 2,200 sq.ft house being built now,
measured against the finished 1,800 sq.ft one from three years ago — scaled for
size, aged for inflation. Cement comes back **overcharged**: the rate is 19%
above what the old rate becomes after normal drift, *and* 30% more bags than the
last house of that size needed. Read the sentences under each verdict; they are
the argument you would make to a supplier.

**3. Materials → Record a bill.** Pick cement, quantity `344`, rate `1150`,
vendor `Shree Traders`. Before you save anything, two things appear:

- *21% over your usual price — Rs. 68,800 more on this load.*
- *Bharat Supply is 21% cheaper on cement — quoted Rs. 950 per bag on
  2026-08-05. Buying this load there instead would save Rs. 68,800.*

Change the vendor to `Bharat Supply` and the second line disappears. Change the
rate to `960` and the first one does too.

**4. Save that bill, then open Waiting for you.** It is sitting there
unconfirmed, with its price check attached, and it is in no total anywhere until
you press Confirm. Try **Send back** with a reason instead, then look at the
bill list — the reason is on it.

**5. Rates and suppliers.** The rate book. Note the line at the top: what buying
everything at the best rate you know of would have saved on this build.

**6. Wages.** What each person earned from attendance, less advances, and what
is still owed. Prakash is on a monthly salary; the rest are on day rates.

**7. Accounts.** Add a second person as *staff*, sign in as them in a private
window, and see the difference: no Accounts, no Settings, no Waiting for you,
and everything they enter waits for your confirmation.

## On your phone

With the app running, find your computer's address on the network:

```bash
ipconfig            # Windows — look for IPv4 Address
ifconfig | grep inet   # Mac or Linux
```

Then on your phone, on the same wifi, open `http://<that-address>:3000` — for
example `http://192.168.1.14:3000`. You will get the thumb bar along the bottom
and the full app. Add it to your home screen and it opens without a browser bar.

If the phone cannot reach it, start the app with `npx next dev -H 0.0.0.0`
instead; some machines only listen on localhost otherwise.

## Checking it yourself

```bash
npm test     # 54 tests over the arithmetic, wages, price checks and fault log
npm run build
```

## When you demo this to Bhargo

Steps 2, 3 and 4 are the demo. In that order they tell one story: *here is what
your last house cost, here is what you are being charged now, here is who sells
it cheaper, and nothing goes in the books until you say so.* It takes four
minutes and needs no explanation of how any of it works.
