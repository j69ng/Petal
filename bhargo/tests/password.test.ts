import test from "node:test";
import assert from "node:assert/strict";

import { hashPassword, verifyPassword } from "../src/lib/password";

test("a password verifies against its own hash and nothing else", async () => {
  const stored = await hashPassword("site-office-pw");

  assert.equal(await verifyPassword("site-office-pw", stored), true);
  assert.equal(await verifyPassword("site-office-pW", stored), false);
  assert.equal(await verifyPassword("", stored), false);
  assert.equal(await verifyPassword("site-office-pw ", stored), false);
});

test("the same password stored twice produces different hashes", async () => {
  const [a, b] = await Promise.all([hashPassword("same-password"), hashPassword("same-password")]);

  assert.notEqual(a, b); // different salt each time
  assert.equal(await verifyPassword("same-password", a), true);
  assert.equal(await verifyPassword("same-password", b), true);
});

test("the stored form never contains the password", async () => {
  const stored = await hashPassword("bhargo-owner-pw");

  assert.ok(!stored.includes("bhargo-owner-pw"));
  assert.match(stored, /^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
});

test("a damaged or empty hash never lets anyone in", async () => {
  for (const broken of ["", "scrypt", "scrypt$$", "plain$salt$hash", "scrypt$00$", "not-a-hash"]) {
    assert.equal(await verifyPassword("anything", broken), false, `accepted ${JSON.stringify(broken)}`);
  }
});
