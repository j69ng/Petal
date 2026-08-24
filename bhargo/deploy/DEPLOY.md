# Putting Bhargo in front of the company

Three ways to hand it over. Pick the narrowest one that suits how they work —
the fewer places it can be reached from, the less there is to protect.

| | Who can use it | Cost | Set-up |
| --- | --- | --- | --- |
| **A. One office computer** | Whoever sits at that desk | nothing | 20 minutes |
| **B. The office network** | Anyone on the office wifi | nothing | 30 minutes |
| **C. A server with HTTPS** | Site staff too, from any phone | ~$6/month + domain | 1 hour |
| **D. Hosted, from a browser** | Same as C | ~$7/month | 15 minutes, no terminal |

Most contractors want **C** once they see the phone screens — a supervisor
records the delivery at the gate, the owner confirms it from wherever they are.

---

## A. One office computer

```bash
# Install Node 20 or newer, then:
git clone <your-repo> bhargo && cd bhargo
npm ci
npm run build
npm run start          # http://localhost:3000
```

Open it, create the owner account, and that is the whole job. To make it start
with the computer, use Task Scheduler on Windows or the systemd unit below.

## B. The office network

Same as A, but bind it to the network so other machines can reach it:

```bash
npx next start -H 0.0.0.0 -p 3000
```

Others open `http://<that-computer-ip>:3000`. Find the address with `ip addr` or
`ipconfig`. **Do not forward that port on the router** — that is what turns a
private tool into a public one by accident.

---

## D. A public address without a terminal

If there is no computer with Node and Git on it — and there usually is not on a
building site — this is the shortest way to a working address. Everything
happens in a browser.

You need a GitHub account with this repository, and an account with a host that
builds from GitHub and offers a **persistent disk**. Render, Railway and Fly all
do. The settings below are Render's names; the others ask for the same things
under slightly different labels.

1. **New → Blueprint**, point it at this repository. It reads `bhargo/render.yaml`
   and fills in everything below. If you would rather do it by hand, use **New →
   Web Service** and enter:

   | Setting | Value |
   | --- | --- |
   | Root directory | `bhargo` |
   | Build command | `npm ci && npm run build` |
   | Start command | `npm run start` |
   | Health check path | `/api/health` |
   | Disk mount path | `/var/lib/bhargo`, 1 GB |
   | `BHARGO_DB` | `/var/lib/bhargo/bhargo.db` |
   | `BHARGO_SECURE_COOKIES` | `1` |
   | `BHARGO_SETUP_KEY` | a long random string you choose |
   | `BHARGO_OPS_KEY` | another long random string |

2. **The disk is not optional.** Without it the books are wiped on every deploy —
   these hosts give each container a fresh filesystem. A disk is also what puts
   these plans on the paid tier, around $7 a month.

3. When it says live, open `https://your-app.onrender.com/setup`, type the setup
   key, and create the owner account. Then **remove `BHARGO_SETUP_KEY`** and
   redeploy — the page closes for good once an owner exists, but there is no
   reason to leave the key lying around.

4. Add your own domain if you want one — the host does the certificate.

5. Set up backups the same day. The disk is theirs, not yours: use the host's
   snapshot feature if it has one, and either way have someone download
   `/var/lib/bhargo/bhargo.db` weekly through the host's shell. A company's books
   living only inside a hosting account is a bad place for them to be.

### Or as a container

`Dockerfile` builds a self-contained image for anything that takes one — Fly,
Railway, a Docker host, a NAS at the office:

```bash
docker build -t bhargo .
docker run -d --name bhargo -p 3000:3000 \
  -v bhargo-data:/data \
  -e BHARGO_SECURE_COOKIES=1 \
  -e BHARGO_SETUP_KEY=change-me \
  bhargo
```

The books live on the `/data` volume, never inside the image, so a new version
cannot touch them.

---

## C. A server with HTTPS (the one to sell)

A $6/month VPS (Hetzner, DigitalOcean, Vultr) is plenty: this is one small Node
process and a file. Ubuntu 24.04 assumed below.

### 1. A user and somewhere for the books to live

```bash
sudo adduser --system --group --home /srv/bhargo bhargo
sudo mkdir -p /var/lib/bhargo /var/backups/bhargo
sudo chown bhargo:bhargo /var/lib/bhargo /var/backups/bhargo
```

The database sits in `/var/lib/bhargo`, away from the code, so deploying a new
version can never overwrite the company's records.

### 2. Node and the app

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs sqlite3

sudo -u bhargo git clone <your-repo> /srv/bhargo
cd /srv/bhargo
sudo -u bhargo npm ci
sudo -u bhargo npm run build
```

### 3. Run it as a service

```bash
sudo cp deploy/bhargo.service /etc/systemd/system/
sudo nano /etc/systemd/system/bhargo.service   # set BHARGO_SETUP_KEY, see below
sudo systemctl daemon-reload
sudo systemctl enable --now bhargo
sudo systemctl status bhargo
```

### 4. A domain and a certificate

Point an A record at the server (`bhargo.yourdomain.com`), then:

```bash
sudo apt-get install -y caddy
sudo cp deploy/Caddyfile /etc/caddy/Caddyfile
sudo nano /etc/caddy/Caddyfile      # put your domain in
sudo systemctl reload caddy
```

Caddy fetches and renews the certificate itself. Nothing to remember later.

### 5. Shut the door on everything else

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80,443/tcp
sudo ufw enable
```

Port 3000 stays closed — only Caddy talks to it, from the machine itself.

### 6. Claim the owner account before anyone else does

A fresh install has no accounts, so `/setup` gives the owner account to whoever
opens it first. On a public address, set a key first:

```
Environment=BHARGO_SETUP_KEY=some-long-random-string
```

in the service file, restart, then open `https://bhargo.yourdomain.com/setup`,
type the key, and create the owner account. Remove the line afterwards and
restart — once an owner exists the page is closed for good.

### 7. Know when it breaks, before they tell you

Add to the service file:

```
Environment=BHARGO_OPS_KEY=another-long-random-string
Environment=BHARGO_ALERT_WEBHOOK=https://hooks.slack.com/services/...
Environment=BHARGO_SITE_NAME=Bhargo Construction
```

Then point a free uptime checker (UptimeRobot, BetterStack, Healthchecks.io) at
`https://bhargo.yourdomain.com/api/health` every five minutes, alerting you on
anything other than `ok`. That covers the server being down, and the database
refusing a write while the server looks fine.

Faults themselves land at `https://bhargo.yourdomain.com/diagnostics?key=…`.
Bookmark it. The company never sees it and never needs to — they get a plain
"that did not work" and a reference code, which is all you need to find the exact
fault they hit.

Once a week is enough: open diagnostics, fix anything that keeps coming back,
clear the list.

### 8. Backups, before you hand over the password

```bash
sudo cp deploy/backup.sh /usr/local/bin/bhargo-backup
sudo chmod +x /usr/local/bin/bhargo-backup
sudo crontab -e
# 15 2 * * * /usr/local/bin/bhargo-backup
```

It uses SQLite's own `.backup` (safe while the app is running), gzips it, checks
the copy opens, and keeps 30 days. Copy them off the server as well — a backup
on the same machine does not survive that machine. `rclone` to any cloud storage
is the usual answer.

### 9. Updates later

```bash
sudo -u bhargo /srv/bhargo/deploy/update.sh
```

Backs up, pulls, rebuilds, restarts, and checks the site answers.

---

## Handing it over

What Bhargo needs from you on the day:

1. **The address** — `https://bhargo.yourdomain.com`, and how to add it to a
   phone home screen (Chrome: *Add to Home screen*; Safari: *Share → Add to Home
   Screen*).
2. **The owner account** — created with them, password chosen by them, typed by
   them. Do not hold it yourself. If you set it up in advance, have them change
   it in front of you on the Accounts page.
3. **Their people** — add the site supervisor and anyone else, on the spot, as
   staff. Show what "waiting for you" means and let the owner confirm one entry.
4. **Their usual prices** — sit with them for twenty minutes and fill in the
   Usual prices page for cement, steel, sand, aggregate and bricks at least.
   Nothing else works as well until this is done.
5. **Their first build** — floor area is the number that matters. If they have a
   finished house to use as the baseline, enter its bills too; that is what makes
   the comparison page work on day one.
6. **Where the backups go**, and how to restore one:
   `gunzip -c backup.db.gz > /var/lib/bhargo/bhargo.db` with the service stopped.
7. **Who to call** and what you cover — see below.
8. **That you can see faults but not their figures.** Tell them plainly: when
   something breaks you get the error and the page it happened on, never their
   bills, wages or rates. Better said by you on day one than discovered by them
   later.

## Say plainly what you are and are not responsible for

Put it in writing before the first invoice:

- **Password resets** — only the owner can reset staff passwords. If the owner
  loses theirs, you need server access to reset it. Agree that in advance.
- **Their data is theirs.** The file is `/var/lib/bhargo/bhargo.db`. Say you will
  hand over a copy on request, any time, no argument.
- **The figures are their own records.** Bhargo compares what they entered; it
  does not audit a supplier, and a flag is a question to ask, not proof.
- **What support covers** — how many hours a month, what counts as a new feature
  rather than a fix, and how quickly you answer.

## If they ask "where is our data?"

One SQLite file on their server, in their account, with nightly backups. No third
party holds it, and no part of Bhargo sends it anywhere. That answer closes the
question in one sentence, which is worth a lot in this market.
