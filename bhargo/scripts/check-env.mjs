// Runs before dev, demo, build and test. A missing or elderly Node prints a
// sentence someone can act on, rather than a stack trace about an unknown flag.

const REQUIRED = [20, 6, 0]; // node --import needs 20.6

const [major, minor, patch] = process.versions.node.split(".").map(Number);
const tooOld =
  major < REQUIRED[0] ||
  (major === REQUIRED[0] && minor < REQUIRED[1]) ||
  (major === REQUIRED[0] && minor === REQUIRED[1] && patch < REQUIRED[2]);

if (tooOld) {
  console.error(`
  Bhargo needs Node 20.6 or newer. This machine has ${process.versions.node}.

  Install the LTS version from https://nodejs.org, then CLOSE this window and
  open a new one — an already-open terminal keeps the old settings and will
  still say the old version.

  Check it worked:   node -v
`);
  process.exit(1);
}
