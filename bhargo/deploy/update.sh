#!/usr/bin/env bash
# Ship a new version. Backs up first, so a bad release is one restore away.
#
#   sudo -u bhargo /srv/bhargo/deploy/update.sh

set -euo pipefail
cd "$(dirname "$0")/.."

/usr/local/bin/bhargo-backup || echo "warning: backup step failed, continuing"

git pull --ff-only
npm ci --omit=dev --no-audit --no-fund
npm run build

sudo systemctl restart bhargo
sleep 3
curl -fsS -o /dev/null http://127.0.0.1:3000/login && echo "Bhargo is up." || {
  echo "Bhargo did not come back — check: journalctl -u bhargo -n 50"
  exit 1
}
