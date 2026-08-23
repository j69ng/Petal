// Password hashing, kept apart from the session code so it can be tested on
// its own — and so nothing here depends on a request being in flight.

import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;

/**
 * Returns `scrypt$<salt>$<hash>`. The salt is random per password and travels
 * with the hash, so two people choosing the same password still store
 * different values, and a stolen database cannot be attacked with a lookup
 * table. scrypt is deliberately slow and memory-hungry, which is the point.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = (await scrypt(password.normalize("NFKC"), salt, KEY_LENGTH)) as Buffer;
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

/** Constant-time comparison, so a wrong guess reveals nothing by how long it took. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltHex, hashHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;

  const expected = Buffer.from(hashHex, "hex");
  if (expected.length === 0) return false;

  const actual = (await scrypt(password.normalize("NFKC"), Buffer.from(saltHex, "hex"), expected.length)) as Buffer;
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
