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

// Resolve a token → session snapshot, or null when missing/expired. Expired
// rows are deleted lazily on lookup so the table self-prunes.
export async function getSession(q, token) {
  if (!token) return null;
  const row = (await q(
    `SELECT token, user_id, name, role, store_id, expires_at
       FROM app_session WHERE token=$1`,
    [token],
  )).rows[0];
  if (!row) return null;
  if (new Date(row.expires_at).getTime() <= Date.now()) {
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
