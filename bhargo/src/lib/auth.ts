// Who is allowed in. Accounts live in the same SQLite file as the books, so
// there is no second service to run and no third party holding the company's
// data.
//
// Passwords are stored as scrypt hashes with a per-password salt — never in
// plain text, and never recoverable, only resettable. Sessions are random
// tokens kept server-side so an account can be cut off the moment someone
// leaves, which a self-contained signed cookie could not do.

import { randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "./db";
import { hashPassword, verifyPassword } from "./password";
import type { Session, User, UserRole } from "./types";

export const SESSION_COOKIE = "bhargo_session";
const SESSION_DAYS = 30;

// ---------------------------------------------------------------- accounts

/**
 * Whether the first-run page is protected by a key.
 *
 * A fresh deployment has no accounts, so /setup hands the owner account to
 * whoever opens it first. On a public address that is a race between you and a
 * stranger. Setting BHARGO_SETUP_KEY closes it: the key has to be typed in
 * before the owner account can be created, and once it exists the page is gone
 * for good.
 */
export function setupKeyRequired(): boolean {
  return !!process.env.BHARGO_SETUP_KEY?.trim();
}

export function setupKeyMatches(given: string): boolean {
  const expected = process.env.BHARGO_SETUP_KEY?.trim();
  if (!expected) return true;

  // Constant-time compare — this is a secret like any other.
  const a = Buffer.from(given.trim());
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function userCount(): number {
  const row = db().prepare(`select count(*) as n from users`).get() as { n: number };
  return row.n;
}

export function listUsers(): User[] {
  return db().prepare(`select * from users order by role, name`).all() as User[];
}

export function getUserByUsername(username: string): (User & { password_hash: string }) | undefined {
  return db().prepare(`select * from users where username = ?`).get(username.trim().toLowerCase()) as
    | (User & { password_hash: string })
    | undefined;
}

export async function createUser(input: {
  name: string;
  username: string;
  password: string;
  role: UserRole;
}): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  const username = input.username.trim().toLowerCase();
  const name = input.name.trim();

  if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
    return { ok: false, error: "Username: 3–32 characters, letters, numbers, dot, dash or underscore." };
  }
  if (!name) return { ok: false, error: "Name is required." };
  if (input.password.length < 8) return { ok: false, error: "Password must be at least 8 characters." };
  if (getUserByUsername(username)) return { ok: false, error: "That username is already taken." };

  const info = db()
    .prepare(
      `insert into users (name, username, password_hash, role, active, created_at)
       values (?, ?, ?, ?, 1, ?)`
    )
    .run(name, username, await hashPassword(input.password), input.role, new Date().toISOString());

  return { ok: true, id: Number(info.lastInsertRowid) };
}

export async function setPassword(userId: number, password: string): Promise<{ ok: boolean; error?: string }> {
  if (password.length < 8) return { ok: false, error: "Password must be at least 8 characters." };
  db().prepare(`update users set password_hash = ? where id = ?`).run(await hashPassword(password), userId);
  // Changing a password ends that person's other sessions.
  db().prepare(`delete from sessions where user_id = ?`).run(userId);
  return { ok: true };
}

export function setUserActive(userId: number, active: boolean): void {
  db().prepare(`update users set active = ? where id = ?`).run(active ? 1 : 0, userId);
  if (!active) db().prepare(`delete from sessions where user_id = ?`).run(userId);
}

export function deleteUser(userId: number): void {
  db().prepare(`delete from sessions where user_id = ?`).run(userId);
  db().prepare(`delete from users where id = ?`).run(userId);
}

// ------------------------------------------------------- failed-attempt brake

// Slows down someone guessing passwords. In memory on purpose: it costs
// nothing, and a restart clearing it is not a real weakness at this scale.
const failures = new Map<string, { count: number; until: number }>();
const LOCK_AFTER = 5;
const LOCK_MS = 60_000;

function lockedFor(username: string): number {
  const entry = failures.get(username);
  if (!entry || entry.until < Date.now()) return 0;
  return Math.ceil((entry.until - Date.now()) / 1000);
}

function noteFailure(username: string): void {
  const entry = failures.get(username) ?? { count: 0, until: 0 };
  entry.count += 1;
  if (entry.count >= LOCK_AFTER) {
    entry.until = Date.now() + LOCK_MS;
    entry.count = 0;
  }
  failures.set(username, entry);
}

// ---------------------------------------------------------------- sessions

export async function signIn(
  username: string,
  password: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const key = username.trim().toLowerCase();
  const waitSeconds = lockedFor(key);
  if (waitSeconds > 0) {
    return { ok: false, error: `Too many failed attempts. Try again in ${waitSeconds} seconds.` };
  }

  const user = getUserByUsername(key);
  // Verify even when the user does not exist, so a wrong username and a wrong
  // password take the same time to answer.
  const stored = user?.password_hash ?? "scrypt$00$00";
  const passwordOk = await verifyPassword(password, stored);

  if (!user || !passwordOk || user.active !== 1) {
    noteFailure(key);
    return { ok: false, error: "Wrong username or password." };
  }

  failures.delete(key);

  const token = randomBytes(32).toString("hex");
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_DAYS * 86_400_000);

  db()
    .prepare(`insert into sessions (token, user_id, created_at, expires_at) values (?, ?, ?, ?)`)
    .run(token, user.id, now.toISOString(), expires.toISOString());
  db().prepare(`update users set last_seen_at = ? where id = ?`).run(now.toISOString(), user.id);

  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires,
    // Only over HTTPS when you are actually serving HTTPS — a secure cookie on
    // a plain LAN address would simply never be sent back.
    secure: process.env.BHARGO_SECURE_COOKIES === "1",
  });

  return { ok: true };
}

export function signOut(): void {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (token) db().prepare(`delete from sessions where token = ?`).run(token);
  cookies().delete(SESSION_COOKIE);
}

/** The signed-in user, or null. Expired sessions are cleared as they are met. */
export function currentUser(): User | null {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = db().prepare(`select * from sessions where token = ?`).get(token) as Session | undefined;
  if (!session) return null;

  if (new Date(session.expires_at).getTime() < Date.now()) {
    db().prepare(`delete from sessions where token = ?`).run(token);
    return null;
  }

  const user = db().prepare(`select * from users where id = ?`).get(session.user_id) as User | undefined;
  if (!user || user.active !== 1) return null;

  return user;
}

/**
 * Guard for every page and every form handler. Pages redirect; form handlers
 * get the same treatment, so a stale tab cannot post into the books after an
 * account has been switched off.
 */
export function requireUser(): User {
  const user = currentUser();
  if (!user) redirect(userCount() === 0 ? "/setup" : "/login");
  return user;
}

/** Owner-only ground: accounts, settings, and deleting things. */
export function requireOwner(): User {
  const user = requireUser();
  if (user.role !== "owner") redirect("/?denied=owner");
  return user;
}

export function isOwner(user: User | null): boolean {
  return user?.role === "owner";
}
