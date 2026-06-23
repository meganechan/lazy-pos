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

// ---- in-memory session store: token → { userId, name, role, storeId } ----
const sessions = new Map();

export function createSession(user) {
  const token = randomUUID();
  sessions.set(token, {
    userId: user.id,
    name: user.name,
    role: user.role,
    storeId: user.store_id,
  });
  return token;
}

export function getSession(token) {
  if (!token) return null;
  return sessions.get(token) || null;
}

export function destroySession(token) {
  if (!token) return false;
  return sessions.delete(token);
}
