// auth.js — PIN hashing + in-memory sessions for lazy-pos RBAC (v0.4)
//
// NOTE: this is a PASSWORD/AUTH hash (scrypt) for user PINs. It has NOTHING to
// do with any idempotency/dedup hash. Do not conflate the two.
//
// PIN storage format: "salt:hashHex"
//   - salt: 16 random bytes, hex
//   - hashHex: scrypt(pin, salt, 64) hex
// Uses only node's built-in crypto — no external deps, no native build.

import { scryptSync, randomBytes, timingSafeEqual, randomUUID } from 'node:crypto';

const KEYLEN = 64;

// Hash a PIN → "salt:hashHex"
export function hashPin(pin) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(String(pin), salt, KEYLEN).toString('hex');
  return `${salt}:${hash}`;
}

// Verify a PIN against a stored "salt:hashHex". Constant-time compare.
export function verifyPin(pin, stored) {
  if (typeof stored !== 'string' || !stored.includes(':')) return false;
  const [salt, hashHex] = stored.split(':');
  if (!salt || !hashHex) return false;
  let expected;
  try {
    expected = Buffer.from(hashHex, 'hex');
  } catch {
    return false;
  }
  const actual = scryptSync(String(pin), salt, expected.length);
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

// ---- Login throttle (PIN brute-force guard) ----
//
// Keyed by canonical integer userId, not IP: behind Coolify's proxy every
// request shares one req.ip, so a per-IP limit would throttle the whole salon.
// Each login RESERVES an attempt synchronously before any await, so concurrent
// requests cannot all slip past the check; a successful login (or an id with
// no user) releases it. LOGIN_MAX_ATTEMPTS unreleased attempts inside
// LOGIN_WINDOW_MS → 429 until the window rolls over. Short window on purpose —
// user ids are public (/api/auth/users), so a long lockout would let anyone
// lock staff out.
// ponytail: in-memory Map, single process only; move to a DB table if the app
// ever runs >1 replica.
export const LOGIN_MAX_ATTEMPTS = 5;
export const LOGIN_WINDOW_MS = 5 * 60 * 1000;
const SWEEP_AT = 1000;
const loginAttempts = new Map(); // userId(int) -> { count, since }

// Public JSON userId → positive safe integer, or null. "01", " 1", "+1" all
// become 1 so aliases share one counter (Postgres casts them to the same id).
export function canonicalUserId(raw) {
  if (raw == null || raw === '' || typeof raw === 'boolean') return null;
  const id = Number(raw);
  // app_user.id is int4 — larger values make the pg query throw.
  return Number.isInteger(id) && id > 0 && id <= 2147483647 ? id : null;
}

// Reserve one attempt for `id`. Returns false (→ 429) when the cap is reached.
export function takeLoginAttempt(id, now = Date.now()) {
  if (loginAttempts.size >= SWEEP_AT) {
    for (const [k, e] of loginAttempts) {
      if (now - e.since >= LOGIN_WINDOW_MS) loginAttempts.delete(k);
    }
  }
  const e = loginAttempts.get(id);
  if (!e || now - e.since >= LOGIN_WINDOW_MS) {
    loginAttempts.set(id, { count: 1, since: now });
    return true;
  }
  if (e.count >= LOGIN_MAX_ATTEMPTS) return false;
  e.count++;
  return true;
}

export function clearLoginAttempts(id) {
  loginAttempts.delete(id);
}

export function loginAttemptsSize() {
  return loginAttempts.size;
}

// ---- DB-backed session store (durable across restart / deploy) ----
//
// Sessions live in the app_session table so a deploy no longer logs everyone
// out (the old store was an in-memory Map wiped on every restart). Each row is
// token → { user_id, name, role, store_id, expires_at }. All three helpers take
// the query function `q` (text, params) → { rows } so auth.js stays decoupled
// from the pg pool that index.js owns.

// Token lifetime before re-login is required. 30 days — owners rarely switch
// shops, so this keeps the cashier logged in across normal use and deploys.
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export async function createSession(q, user) {
  const token = randomUUID();
  const expires = new Date(Date.now() + SESSION_TTL_MS);
  await q(
    `INSERT INTO app_session (token, user_id, name, role, store_id, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [token, user.id, user.name, user.role, user.store_id, expires],
  );
  return token;
}

// Resolve a token using the current active user, or null. Expired/inactive
// rows are deleted lazily on lookup so the table self-prunes.
export async function getSession(q, token) {
  if (!token) return null;
  const row = (await q(
    `SELECT s.token, s.user_id, u.name, u.role, u.store_id, s.expires_at, u.active
       FROM app_session s LEFT JOIN app_user u ON u.id=s.user_id WHERE s.token=$1`,
    [token],
  )).rows[0];
  if (!row) return null;
  if (!row.active || new Date(row.expires_at).getTime() <= Date.now()) {
    await q('DELETE FROM app_session WHERE token=$1', [token]);
    return null;
  }
  return {
    userId: row.user_id,
    name: row.name,
    role: row.role,
    storeId: row.store_id,
  };
}

export async function destroySession(q, token) {
  if (!token) return false;
  const r = await q('DELETE FROM app_session WHERE token=$1', [token]);
  return r.rowCount > 0;
}
