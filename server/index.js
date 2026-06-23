import express from 'express';
import pg from 'pg';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createBeamAdapter } from './adapters/beam.js';
import { createBeamBoltAdapter } from './adapters/beamBolt.js';
import { createLineAdapter } from './adapters/line.js';
import {
  hashPin,
  verifyPin,
  createSession,
  getSession,
  destroySession,
} from './auth.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 8080;

// Swappable integration adapters — instantiated once from env at startup.
// Mock now, real later, WITHOUT changing core endpoint logic.
const beamAdapter = createBeamAdapter(process.env);
const beamBoltAdapter = createBeamBoltAdapter(process.env);
const lineAdapter = createLineAdapter(process.env);

// §4 INVARIANT 2: idempotency key may only be reused for retries within this
// window. Beyond it, the key is considered expired → no retry, manual reconcile.
const IDEMPOTENCY_REUSE_WINDOW_MS = 12 * 60 * 60 * 1000; // 12 hours
const { Pool } = pg;
const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    'postgres://lazy:lazy@localhost:5432/lazypos',
});

const q = (text, params) => pool.query(text, params);

// ---- bootstrap: schema + seed (idempotent) ----
async function bootstrap() {
  const schema = readFileSync(join(__dirname, '../db/schema.sql'), 'utf8');
  await q(schema);
  const { rows } = await q('SELECT count(*)::int AS n FROM store');
  if (rows[0].n === 0) {
    const seed = readFileSync(join(__dirname, '../db/seed.sql'), 'utf8');
    await q(seed);
    console.log('[bootstrap] seeded demo data');
  }
  // §v0.8 — keep store #1 as the demo tenant. Give it a stable shop code so the
  // shop-login picker can find it. Only set if it exists with a NULL code.
  await q(
    "UPDATE store SET code='LAZY01' WHERE id=1 AND code IS NULL");
  // Demo users seeded from JS (not seed.sql) because PIN hashing lives in JS.
  // PINs are stored scrypt-hashed — never log the raw PINs.
  const { rows: userRows } = await q('SELECT count(*)::int AS n FROM app_user');
  if (userRows[0].n === 0) {
    await q(
      `INSERT INTO app_user (store_id, name, role, pin_hash)
       VALUES (1,$1,'owner',$2),(1,$3,'staff',$4)`,
      [
        'เจ้าของร้าน (Owner)', hashPin('1234'),
        'พนักงาน (Staff)', hashPin('5678'),
      ]);
    console.log('[bootstrap] seeded demo users (owner + staff) with hashed PINs');
  }
  console.log('[bootstrap] schema ready');
}

async function withRetry(fn, tries = 30) {
  for (let i = 0; i < tries; i++) {
    try { return await fn(); }
    catch (e) {
      console.log(`[bootstrap] db not ready (${i + 1}/${tries}): ${e.code || e.message}`);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  throw new Error('database never became ready');
}

// ---- audit helper ----
// Inserts an audit_log row. Wrapped so an audit failure NEVER breaks the
// main request (best-effort logging).
async function audit(actorUserId, storeId, action, entity, entityId, detail) {
  try {
    await q(
      `INSERT INTO audit_log (store_id, actor_user_id, action, entity, entity_id, detail)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [
        storeId ?? null,
        actorUserId ?? null,
        action,
        entity ?? null,
        entityId == null ? null : String(entityId),
        detail == null ? null : JSON.stringify(detail),
      ]);
  } catch (e) {
    console.error('[audit] failed to write audit row:', e.message);
  }
}

// ---- helpers ----

// PIN policy: numeric, 4–6 digits. Shared by signup + user create/update so the
// rule is defined once (DRY). Returns true if the PIN is acceptable.
const isValidPin = (p) => /^\d{4,6}$/.test(p == null ? '' : String(p).trim());
const PIN_RULE_MSG = 'PIN ต้องเป็นตัวเลข 4–6 หลัก';

// §v0.6 — derived "busy until" for a ticket. A ticket locks its technician only
// while in_progress with both started_at and est_minutes set. Returns a Date or
// null. busy_until = started_at + est_minutes*60000ms.
function busyUntil(t) {
  if (!t || t.status !== 'in_progress' || !t.started_at || t.est_minutes == null)
    return null;
  return new Date(new Date(t.started_at).getTime() + Number(t.est_minutes) * 60000);
}

// §v0.6 — effective minutes for a ticket_item: explicit minutes, else fall back
// to the service's duration_min. Row must carry minutes + duration_min columns.
function itemMinutes(row) {
  return row.minutes == null ? Number(row.duration_min) || 0 : Number(row.minutes);
}

// §v0.6 — recompute ticket.est_minutes = Σ(effective minutes × qty) from live
// items (per-item minutes, falling back to service.duration_min). Persists and
// returns the new total.
// §v0.8 — store-scoped: only recompute over items belonging to this store's
// ticket. The UPDATE is constrained to the ticket id (already store-scoped by
// the caller that resolved it).
async function recomputeEstMinutes(ticketId) {
  const rows = (await q(
    `SELECT ti.minutes, ti.qty, s.duration_min
       FROM ticket_item ti LEFT JOIN service s ON s.id = ti.service_id
      WHERE ti.ticket_id=$1`, [ticketId])).rows;
  const est = rows.reduce((sum, r) => sum + itemMinutes(r) * Number(r.qty), 0);
  await q('UPDATE ticket SET est_minutes=$2 WHERE id=$1', [ticketId, est]);
  return est;
}

// §v1.2 — discount + staff-pricing helpers.
// round2: money rounding to 2 decimals (Math.round avoids float drift).
const round2 = (x) => Math.round(Number(x) * 100) / 100;
const clamp = (x, lo, hi) => Math.min(Math.max(Number(x), lo), hi);

// discountAmount: pure. percent → gross * clamp(value,0,100)/100; baht →
// min(max(value,0), gross). Never exceeds gross, never negative. Anything else
// (null/unknown type) → 0.
function discountAmount(gross, type, value) {
  const g = Number(gross) || 0;
  const v = Number(value);
  if (!Number.isFinite(v)) return 0;
  if (type === 'percent') return round2(g * clamp(v, 0, 100) / 100);
  if (type === 'baht') return round2(Math.min(Math.max(v, 0), g));
  return 0;
}

// getSettings: store_settings row, or the all-zero defaults if none. Read-only —
// never inserts a row (PUT /api/settings owns creation).
async function getSettings(storeId) {
  const row = (await q('SELECT * FROM store_settings WHERE store_id=$1', [storeId])).rows[0];
  return row || {
    max_discount_percent: 0,
    max_discount_baht: 0,
    daily_discount_quota: 0,
    daily_staff_price_quota: 0,
  };
}

// getEffectiveSettings: the discount/quota limits that actually apply to a user.
// §v1.3 — a per-staff override (staff_settings) wins field-by-field when set;
// any NULL field falls back to the store default (store_settings).
async function getEffectiveSettings(storeId, userId) {
  const store = await getSettings(storeId);
  const ov = (await q(
    'SELECT * FROM staff_settings WHERE store_id=$1 AND user_id=$2',
    [storeId, userId])).rows[0];
  const pick = (f) => (ov && ov[f] != null ? Number(ov[f]) : Number(store[f]));
  return {
    max_discount_percent: pick('max_discount_percent'),
    max_discount_baht: pick('max_discount_baht'),
    daily_discount_quota: pick('daily_discount_quota'),
    daily_staff_price_quota: pick('daily_staff_price_quota'),
  };
}

// verifyOwnerPin: true if `pin` matches ANY active owner's PIN for this store.
// Reuses verifyPin from ./auth.js (hashing untouched). Empty pin → false.
async function verifyOwnerPin(storeId, pin) {
  if (!pin) return false;
  const owners = (await q(
    "SELECT pin_hash FROM app_user WHERE store_id=$1 AND role='owner' AND active",
    [storeId])).rows;
  return owners.some((o) => verifyPin(pin, o.pin_hash));
}

// todayUsage: how many `kind` actions this user has logged today (0 if none).
async function todayUsage(storeId, userId, kind) {
  const row = (await q(
    `SELECT count FROM staff_daily_usage
      WHERE store_id=$1 AND user_id=$2 AND day=CURRENT_DATE AND kind=$3`,
    [storeId, userId, kind])).rows[0];
  return row ? Number(row.count) : 0;
}

// bumpUsage: increment today's counter for (store,user,kind), upserting the row.
async function bumpUsage(storeId, userId, kind) {
  await q(
    `INSERT INTO staff_daily_usage (store_id, user_id, day, kind, count)
     VALUES ($1,$2,CURRENT_DATE,$3,1)
     ON CONFLICT (store_id, user_id, day, kind)
     DO UPDATE SET count = staff_daily_usage.count + 1`,
    [storeId, userId, kind]);
}

// §v0.8 — store-scoped ticket detail. storeId constrains the parent ticket
// lookup; if the ticket is not in this store (or absent) → null (caller 404s).
// All child rows (member, items, payments, quote) hang off this scoped ticket.
async function ticketDetail(id, storeId) {
  const t = (await q(
    'SELECT * FROM ticket WHERE id=$1 AND store_id=$2', [id, storeId])).rows[0];
  if (!t) return null;
  const member = t.member_id
    ? (await q('SELECT * FROM member WHERE id=$1', [t.member_id])).rows[0]
    : null;
  const assigned = t.assigned_user_id
    ? (await q('SELECT id, name, role FROM app_user WHERE id=$1', [t.assigned_user_id])).rows[0]
    : null;
  const items = (await q(
    `SELECT ti.*, COALESCE(s.name, ti.custom_name) AS service_name, s.category, s.duration_min
       FROM ticket_item ti LEFT JOIN service s ON s.id = ti.service_id
      WHERE ti.ticket_id=$1 ORDER BY ti.id`, [id])).rows
    .map(r => {
      // §v1.2 — per-item discount: gross = price×qty, net = gross − discount.
      const gross = Number(r.quoted_price) * r.qty;
      const discount_amount = discountAmount(gross, r.discount_type, r.discount_value);
      return {
        ...r,
        minutes: itemMinutes(r),
        is_custom: r.service_id == null,
        discount_type: r.discount_type ?? null,
        discount_value: r.discount_value == null ? null : Number(r.discount_value),
        discount_amount,
        net: round2(gross - discount_amount),
      };
    });
  const payments = (await q(
    'SELECT * FROM payment WHERE ticket_id=$1 ORDER BY payment_seq', [id])).rows;
  const quote = (await q(
    'SELECT * FROM quote_confirm WHERE ticket_id=$1 ORDER BY id DESC LIMIT 1', [id])).rows[0] || null;
  // §v1.2 — totals after discounts. items_gross = Σ gross; subtotal = Σ net
  // (after per-item discounts); then the bill-level discount on the subtotal.
  // `total` stays the NET total so the existing payment flow charges the
  // discounted amount. discount_total = total savings (for the receipt).
  const items_gross = round2(items.reduce((s, i) => s + Number(i.quoted_price) * i.qty, 0));
  const subtotal = round2(items.reduce((s, i) => s + i.net, 0));
  const bill_discount_amount = discountAmount(subtotal, t.discount_type, t.discount_value);
  const total = round2(subtotal - bill_discount_amount);
  const discount_total = round2((items_gross - subtotal) + bill_discount_amount);
  const paid = payments.filter(p => p.status === 'success')
    .reduce((s, p) => s + Number(p.amount), 0);
  const bu = busyUntil(t);
  return {
    ...t,
    member,
    assigned_name: assigned ? assigned.name : null,
    busy_until: bu ? bu.toISOString() : null,
    discount_type: t.discount_type ?? null,
    discount_value: t.discount_value == null ? null : Number(t.discount_value),
    items, payments, quote,
    items_gross, subtotal, bill_discount_amount, discount_total,
    total, paid,
  };
}

const app = express();
// Capture the raw request body so the Beam webhook receiver can verify the
// HMAC signature over the exact bytes (express.json() otherwise discards them).
app.use(express.json({ verify: (req, _res, buf) => { req.rawBody = buf; } }));

// ---- auth middleware ----
// requireAuth: resolve Bearer token → req.user. Missing/invalid → 401.
// async now — sessions are looked up in the DB (durable across restart).
async function requireAuth(req, res, next) {
  const header = req.headers['authorization'] || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
  let session;
  try {
    session = await getSession(q, token);
  } catch (e) {
    console.error('[requireAuth]', e);
    return res.status(500).json({ error: 'session_lookup_failed' });
  }
  if (!session) return res.status(401).json({ error: 'unauthorized' });
  req.user = {
    id: session.userId,
    name: session.name,
    role: session.role,
    storeId: session.storeId,
    token,
  };
  next();
}

// requireOwner: must already be authed; owner role only, else 403.
function requireOwner(req, res, next) {
  if (!req.user || req.user.role !== 'owner')
    return res.status(403).json({ error: 'forbidden' });
  next();
}

// §v0.8 — generate a short, unique, uppercased alphanumeric shop code. Avoids
// ambiguous chars (0/O, 1/I). Retries on the (unlikely) unique-index collision.
function randomShopCode(len = 6) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < len; i++)
    s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}

// §v0.8 — standard starter service catalog copied into every new store on signup
// so the shop is usable immediately. (Mirrors the demo seed set.)
const DEFAULT_SERVICES = [
  ['Classic Manicure', 'Manicure', 350, 40],
  ['Gel Manicure', 'Manicure', 650, 60],
  ['Classic Pedicure', 'Pedicure', 450, 50],
  ['Gel Pedicure', 'Pedicure', 750, 70],
  ['Nail Art (per nail)', 'Art', 80, 15],
  ['Gel Removal', 'Care', 150, 20],
  ['Hand Spa & Paraffin', 'Spa', 500, 45],
  ['Acrylic Extension', 'Extension', 1200, 120],
];

// ---- PUBLIC API (no token) ----
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// §v0.8 — list shops for the login picker. Shop name/code are NOT sensitive;
// user lists are (see /api/auth/users which now requires a store filter).
app.get('/api/auth/shops', async (_req, res) => {
  const rows = (await q(
    'SELECT id, code, name FROM store WHERE code IS NOT NULL ORDER BY name')).rows;
  res.json(rows);
});

// §v0.8 — shop-scoped login picker. REQUIRES ?store_id=<id> or ?code=<code>;
// returns ONLY that store's active users. Without a store filter → [] (no
// cross-shop user-list leakage).
app.get('/api/auth/users', async (req, res) => {
  const { store_id, code } = req.query;
  let storeId = null;
  if (store_id != null && String(store_id).trim() !== '') {
    storeId = Number(store_id);
    if (!Number.isInteger(storeId)) return res.json([]);
  } else if (code != null && String(code).trim() !== '') {
    const s = (await q(
      'SELECT id FROM store WHERE code=$1', [String(code).trim()])).rows[0];
    if (!s) return res.json([]);
    storeId = s.id;
  } else {
    return res.json([]);
  }
  const rows = (await q(
    'SELECT id, name, role FROM app_user WHERE store_id=$1 AND active ORDER BY role, name',
    [storeId])).rows;
  res.json(rows);
});

// Login — verify PIN, issue session token. Audits 'login' on success.
// §v0.8 — userId already implies a store; the issued session carries that
// store_id and the response user includes store_id.
app.post('/api/auth/login', async (req, res) => {
  const { userId, pin } = req.body || {};
  if (userId == null || pin == null)
    return res.status(401).json({ error: 'invalid_credentials' });
  const user = (await q(
    'SELECT * FROM app_user WHERE id=$1 AND active', [userId])).rows[0];
  if (!user || !verifyPin(pin, user.pin_hash))
    return res.status(401).json({ error: 'invalid_credentials' });
  const token = await createSession(q, user);
  await audit(user.id, user.store_id, 'login', 'app_user', user.id, null);
  res.json({
    token,
    user: { id: user.id, name: user.name, role: user.role, store_id: user.store_id },
  });
});

// §v0.8 — shop signup (onboarding). Creates a new tenant store (with a unique
// shop code), an owner app_user with a scrypt-hashed PIN, and seeds the default
// service catalog into the new store. Audits 'shop_signup' scoped to the new
// store. Public — anyone can create a shop.
app.post('/api/auth/signup', async (req, res) => {
  const { shop_name, owner_name, owner_pin } = req.body || {};
  const shopName = typeof shop_name === 'string' ? shop_name.trim() : '';
  const ownerName = typeof owner_name === 'string' ? owner_name.trim() : '';
  const pinStr = owner_pin == null ? '' : String(owner_pin).trim();
  if (!shopName || !ownerName || !isValidPin(pinStr))
    return res.status(400).json({
      error: 'shop_name, owner_name and a 4-6 digit owner_pin are required',
    });

  // Create the store with a unique shop code (retry on rare code collision).
  let store = null;
  for (let attempt = 0; attempt < 5 && !store; attempt++) {
    const code = randomShopCode();
    try {
      store = (await q(
        'INSERT INTO store (name, code) VALUES ($1,$2) RETURNING id, code, name',
        [shopName, code])).rows[0];
    } catch (e) {
      if (e.code === '23505') continue; // unique_violation on store_code_uniq
      throw e;
    }
  }
  if (!store)
    return res.status(500).json({ error: 'could not allocate a unique shop code' });

  // Owner user for the new store (scrypt-hashed PIN).
  const owner = (await q(
    `INSERT INTO app_user (store_id, name, role, pin_hash)
     VALUES ($1,$2,'owner',$3) RETURNING id`,
    [store.id, ownerName, hashPin(pinStr)])).rows[0];

  // Seed the default service catalog into the new store (usable immediately).
  for (const [name, category, base_price, duration_min] of DEFAULT_SERVICES) {
    await q(
      `INSERT INTO service (store_id, name, category, base_price, duration_min)
       VALUES ($1,$2,$3,$4,$5)`,
      [store.id, name, category, base_price, duration_min]);
  }

  await audit(owner.id, store.id, 'shop_signup', 'store', store.id,
    { shop_name: store.name, code: store.code, owner_name: ownerName });
  res.json({ ok: true, store: { id: store.id, code: store.code, name: store.name } });
});

// ---- Beam Bolt webhook receiver (PUBLIC — no session) ----
// MUST be registered BEFORE the `app.use('/api', requireAuth)` gate below, since
// Beam calls this server-to-server with no app session. Authenticity is enforced
// via the HMAC signature (X-Beam-Signature) instead. PoC with no webhook secret
// configured -> signature check is skipped (warn + proceed).
app.post('/api/webhooks/beam', async (req, res) => {
  const event = req.headers['x-beam-event'];
  const sig = req.headers['x-beam-signature'];

  const { verified, skipped } = beamBoltAdapter.verifyWebhookSignature(
    req.rawBody, sig);
  if (verified === false && !skipped) {
    return res.status(401).json({ error: 'invalid signature' });
  }
  if (skipped) {
    console.warn('[beam webhook] BEAM_WEBHOOK_SECRET not set — signature NOT verified (PoC)');
  }

  const body = req.body || {};

  // Classify the terminal outcome from event name + body fields. Beam may send
  // any of: a typed event (X-Beam-Event), a `result` enum, or a `status` field.
  const PAID =
    event === 'bolt_intent.paid' ||
    body.result === 'CH_SUCCEEDED' ||
    body.status === 'PAID';
  const FAILED =
    event === 'bolt_intent.canceled' ||
    event === 'bolt_intent.expired' ||
    body.status === 'CANCELED' ||
    body.status === 'EXPIRED';

  // Locate the payment row: primary key is beam_charge_id (the Bolt Intent id we
  // stored at creation). Fallback: parse referenceId 'tkt-<id>-pay-<pid>'.
  let p = null;
  if (body.id) {
    p = (await q(
      `SELECT p.*, t.store_id AS store_id
         FROM payment p JOIN ticket t ON t.id = p.ticket_id
        WHERE p.beam_charge_id=$1`,
      [body.id])).rows[0] || null;
  }
  if (!p && typeof body.referenceId === 'string') {
    const m = body.referenceId.match(/^tkt-(\d+)-pay-(\d+)$/);
    if (m) {
      p = (await q(
        `SELECT p.*, t.store_id AS store_id
           FROM payment p JOIN ticket t ON t.id = p.ticket_id
          WHERE p.id=$1 AND p.ticket_id=$2`,
        [m[2], m[1]])).rows[0] || null;
    }
  }

  let newStatus = null;
  if (p) {
    if (PAID) newStatus = 'success';
    else if (FAILED) newStatus = 'failed';
    if (newStatus) {
      await q(`UPDATE payment SET status=$2 WHERE id=$1`, [p.id, newStatus]);
    }
    await audit(null, p.store_id, 'bolt_webhook', 'payment', p.id,
      { event: event || null, result: body.result || null, status: body.status || null,
        new_status: newStatus, skipped: !!skipped });
  } else {
    await audit(null, null, 'bolt_webhook', 'payment', body.id || null,
      { event: event || null, result: body.result || null, status: body.status || null,
        matched: false, skipped: !!skipped });
  }

  res.status(200).json({ received: true });
});

// ---- AUTH GATE: everything below /api/* requires a valid session ----
app.use('/api', requireAuth);

// Logout — destroy current session.
app.post('/api/auth/logout', async (req, res) => {
  await destroySession(q, req.user.token);
  res.json({ ok: true });
});

// ---- Beam Bolt device pairing (PAIRING mode setup) ----
// Pair a physical EDC terminal to this store. Owner-only. Stores the returned
// Bolt connection + device ids on the store row; reused as boltConnectionId on
// every PAIRING bolt-intent. Audits 'bolt_pair'.
app.post('/api/bolt/pair', requireOwner, async (req, res) => {
  const pairingCode =
    typeof req.body?.pairingCode === 'string' ? req.body.pairingCode.trim() : '';
  if (!pairingCode)
    return res.status(400).json({ error: 'pairingCode is required' });

  let result;
  try {
    result = await beamBoltAdapter.pairDevice({ pairingCode });
  } catch (e) {
    return res.status(502).json({ error: String(e.message || e) });
  }

  await q(
    `UPDATE store SET bolt_connection_id=$2, bolt_device_id=$3 WHERE id=$1`,
    [req.user.storeId, result.boltConnectionId, result.deviceId]);

  await audit(req.user.id, req.user.storeId, 'bolt_pair', 'store', req.user.storeId,
    { boltConnectionId: result.boltConnectionId, deviceId: result.deviceId,
      mock: !!result.mock });

  res.json({
    paired: true,
    boltConnectionId: result.boltConnectionId,
    deviceId: result.deviceId,
    mock: !!result.mock,
  });
});

// Report this store's Bolt pairing status (any authed user).
app.get('/api/bolt/connection', async (req, res) => {
  const s = (await q(
    'SELECT bolt_connection_id, bolt_device_id FROM store WHERE id=$1',
    [req.user.storeId])).rows[0] || {};
  res.json({
    paired: !!s.bolt_connection_id,
    boltConnectionId: s.bolt_connection_id || null,
    deviceId: s.bolt_device_id || null,
  });
});

// ---- OWNER-ONLY: user management ----
app.get('/api/users', requireOwner, async (req, res) => {
  const rows = (await q(
    `SELECT id, name, role, active, created_at FROM app_user
      WHERE store_id=$1
      ORDER BY created_at, id`, [req.user.storeId])).rows;
  res.json(rows);
});

app.post('/api/users', requireOwner, async (req, res) => {
  const { name, role, pin } = req.body || {};
  if (!name || !role)
    return res.status(400).json({ error: 'name and role required' });
  if (!['owner', 'staff'].includes(role))
    return res.status(400).json({ error: 'bad role' });
  if (!isValidPin(pin))
    return res.status(400).json({ error: PIN_RULE_MSG });
  const u = (await q(
    `INSERT INTO app_user (store_id, name, role, pin_hash)
     VALUES ($1,$2,$3,$4)
     RETURNING id, name, role, active, created_at`,
    [req.user.storeId, name, role, hashPin(String(pin).trim())])).rows[0];
  await audit(req.user.id, req.user.storeId, 'user_create', 'app_user', u.id,
    { name: u.name, role: u.role });
  res.json(u);
});

app.put('/api/users/:id', requireOwner, async (req, res) => {
  const existing = (await q(
    'SELECT * FROM app_user WHERE id=$1 AND store_id=$2',
    [req.params.id, req.user.storeId])).rows[0];
  if (!existing) return res.status(404).json({ error: 'user not found' });
  const { name, role, pin, active } = req.body || {};
  if (role !== undefined && !['owner', 'staff'].includes(role))
    return res.status(400).json({ error: 'bad role' });
  // validate PIN only when one is being set/changed; omitting pin = keep current.
  if (pin !== undefined && pin !== null && !isValidPin(pin))
    return res.status(400).json({ error: PIN_RULE_MSG });
  const next = {
    name: name === undefined ? existing.name : name,
    role: role === undefined ? existing.role : role,
    active: active === undefined ? existing.active : !!active,
    pin_hash: pin === undefined || pin === null ? existing.pin_hash : hashPin(String(pin).trim()),
  };
  const u = (await q(
    `UPDATE app_user SET name=$2, role=$3, active=$4, pin_hash=$5
      WHERE id=$1 AND store_id=$6
      RETURNING id, name, role, active, created_at`,
    [req.params.id, next.name, next.role, next.active, next.pin_hash,
     req.user.storeId])).rows[0];
  // Deactivation is a distinct, security-relevant action.
  const deactivated = existing.active === true && next.active === false;
  await audit(
    req.user.id, req.user.storeId,
    deactivated ? 'user_deactivate' : 'user_update',
    'app_user', u.id,
    { name: u.name, role: u.role, active: u.active, pin_changed: pin !== undefined && pin !== null });
  res.json(u);
});

// ---- OWNER-ONLY: audit log ----
app.get('/api/audit', requireOwner, async (req, res) => {
  const action = (req.query.action || '').trim();
  // §v0.8 — scope to this store. store_id is always $1.
  const params = [req.user.storeId];
  let where = 'WHERE a.store_id = $1';
  if (action) { where += ' AND a.action = $2'; params.push(action); }
  const rows = (await q(
    `SELECT a.id, a.actor_user_id, u.name AS actor_name, a.action,
            a.entity, a.entity_id, a.detail, a.created_at
       FROM audit_log a
       LEFT JOIN app_user u ON u.id = a.actor_user_id
       ${where}
      ORDER BY a.created_at DESC, a.id DESC
      LIMIT 200`, params)).rows;
  res.json(rows);
});

app.get('/api/summary', async (req, res) => {
  const storeId = req.user.storeId;
  // §v0.8 — payment has no store_id of its own here; scope via its parent ticket.
  const sales = (await q(
    `SELECT COALESCE(SUM(p.amount),0)::float AS revenue, COUNT(*)::int AS txns
       FROM payment p JOIN ticket t ON t.id = p.ticket_id
      WHERE p.status='success' AND p.created_at::date = now()::date
        AND t.store_id=$1`, [storeId])).rows[0];
  const members = (await q(
    'SELECT COUNT(*)::int n FROM member WHERE store_id=$1', [storeId])).rows[0].n;
  const openTickets = (await q(
    "SELECT COUNT(*)::int n FROM ticket WHERE status IN ('open','in_progress','done') AND store_id=$1",
    [storeId])).rows[0].n;
  const services = (await q(
    'SELECT COUNT(*)::int n FROM service WHERE active AND store_id=$1', [storeId])).rows[0].n;
  res.json({ revenue: sales.revenue, txns: sales.txns, members, openTickets, services });
});

// §v0.7 — list services. Default = ACTIVE services with their ACTIVE options
// (the ticket picker). ?all=1 = ALL services with ALL options (owner management
// table). Each service includes `description` + an `options` array.
app.get('/api/services', async (req, res) => {
  const all = req.query.all === '1' || req.query.all === 'true';
  // §v0.8 — scope catalog to this store. Options inherit scope via service ids.
  const services = (await q(
    all
      ? 'SELECT * FROM service WHERE store_id=$1 ORDER BY category, name'
      : 'SELECT * FROM service WHERE store_id=$1 AND active ORDER BY category, name',
    [req.user.storeId])).rows;
  if (services.length === 0) return res.json([]);
  const ids = services.map(s => s.id);
  // Active-only picker exposes a slim option shape; ?all exposes full rows.
  const opts = (await q(
    all
      ? 'SELECT * FROM service_option WHERE service_id = ANY($1) ORDER BY id'
      : `SELECT id, service_id, name, price_delta, minute_delta
           FROM service_option WHERE service_id = ANY($1) AND active ORDER BY id`,
    [ids])).rows;
  const byService = new Map(ids.map(id => [id, []]));
  for (const o of opts) byService.get(o.service_id)?.push(o);
  res.json(services.map(s => ({ ...s, options: byService.get(s.id) || [] })));
});

// §v0.7 — one service (incl description) + ALL its options (active+inactive).
app.get('/api/services/:id', async (req, res) => {
  const s = (await q(
    'SELECT * FROM service WHERE id=$1 AND store_id=$2',
    [req.params.id, req.user.storeId])).rows[0];
  if (!s) return res.status(404).json({ error: 'service not found' });
  const options = (await q(
    'SELECT * FROM service_option WHERE service_id=$1 ORDER BY id', [req.params.id])).rows;
  res.json({ ...s, options });
});

// §v0.7 — create a service. Owner only. name + base_price required.
app.post('/api/services', requireOwner, async (req, res) => {
  const { name, category, base_price, duration_min, description, active, staff_price } = req.body || {};
  if (!name || base_price == null)
    return res.status(400).json({ error: 'name and base_price required' });
  // §v1.2 — staff_price is optional (null = no staff price, use base_price).
  const s = (await q(
    `INSERT INTO service (store_id, name, category, base_price, duration_min, description, active, staff_price)
     VALUES ($1,$2,$3,$4, COALESCE($5,30), $6, COALESCE($7, TRUE), $8)
     RETURNING *`,
    [req.user.storeId, name, category || null, base_price,
     duration_min == null ? null : duration_min, description || null,
     active === undefined ? null : !!active,
     staff_price == null || staff_price === '' ? null : staff_price])).rows[0];
  await audit(req.user.id, req.user.storeId, 'service_create', 'service', s.id,
    { name: s.name, base_price: Number(s.base_price) });
  res.json(s);
});

// §v0.7 — Service catalog edit — owner only. Extends earlier price-only edit to
// also cover category / duration_min / description. Audits 'service_price_change'
// when base_price changes, else 'service_update'.
app.put('/api/services/:id', requireOwner, async (req, res) => {
  const existing = (await q(
    'SELECT * FROM service WHERE id=$1 AND store_id=$2',
    [req.params.id, req.user.storeId])).rows[0];
  if (!existing) return res.status(404).json({ error: 'service not found' });
  const { name, category, base_price, duration_min, description, active, staff_price } = req.body || {};
  const next = {
    name: name === undefined ? existing.name : name,
    category: category === undefined ? existing.category : category,
    base_price: base_price === undefined ? existing.base_price : base_price,
    duration_min: duration_min === undefined ? existing.duration_min : duration_min,
    description: description === undefined ? existing.description : description,
    active: active === undefined ? existing.active : !!active,
    // §v1.2 — staff_price: undefined = leave as-is; '' / null = clear to NULL.
    staff_price: staff_price === undefined ? existing.staff_price
      : (staff_price === '' || staff_price === null ? null : staff_price),
  };
  const s = (await q(
    `UPDATE service SET name=$2, category=$3, base_price=$4,
        duration_min=$5, description=$6, active=$7, staff_price=$9
      WHERE id=$1 AND store_id=$8 RETURNING *`,
    [req.params.id, next.name, next.category, next.base_price,
     next.duration_min, next.description, next.active, req.user.storeId,
     next.staff_price])).rows[0];
  if (base_price !== undefined && Number(base_price) !== Number(existing.base_price)) {
    await audit(req.user.id, req.user.storeId, 'service_price_change', 'service', s.id,
      { old_price: Number(existing.base_price), new_price: Number(s.base_price) });
  } else {
    await audit(req.user.id, req.user.storeId, 'service_update', 'service', s.id,
      { name: s.name });
  }
  res.json(s);
});

// §v1.1 — service delete with migrate-on-delete (Nothing is Deleted, safely).
// Owner only. Behaviour depends on whether the service is referenced by any
// ticket_item and on the request body:
//  - not referenced → HARD delete (options + service). {mode:'hard'}.
//  - referenced + body.migrate_to → reassign every referencing ticket_item to
//    the target service (same store, active, != :id), then HARD delete the old
//    service (its refs are now safely moved). {mode:'migrate', migrated, migrate_to}.
//  - referenced + body.archive → SOFT archive (active=false) to keep bill
//    history. {mode:'soft', service}.
//  - referenced + neither → 409 {error:'in_use', needs_migrate:true, count}.
// Audits 'service_delete' with the matching {mode}.
app.delete('/api/services/:id', requireOwner, async (req, res) => {
  const existing = (await q(
    'SELECT * FROM service WHERE id=$1 AND store_id=$2',
    [req.params.id, req.user.storeId])).rows[0];
  if (!existing) return res.status(404).json({ error: 'service not found' });
  const { migrate_to, archive } = req.body || {};
  const count = (await q(
    'SELECT count(*)::int AS n FROM ticket_item WHERE service_id=$1',
    [req.params.id])).rows[0].n;
  // Not referenced anywhere → safe to remove the row and its options outright.
  if (count === 0) {
    await q('DELETE FROM service_option WHERE service_id=$1', [req.params.id]);
    await q('DELETE FROM service WHERE id=$1', [req.params.id]);
    await audit(req.user.id, req.user.storeId, 'service_delete', 'service', req.params.id,
      { mode: 'hard' });
    return res.json({ mode: 'hard' });
  }
  // Referenced + a migrate target → move the references, then hard delete.
  if (migrate_to != null && migrate_to !== '') {
    if (String(migrate_to) === String(req.params.id))
      return res.status(400).json({ error: 'migrate_to must differ from the service being deleted' });
    const target = (await q(
      'SELECT id FROM service WHERE id=$1 AND store_id=$2 AND active=true',
      [migrate_to, req.user.storeId])).rows[0];
    if (!target)
      return res.status(400).json({ error: 'invalid migrate_to (must be an active service in this store)' });
    const migrated = (await q(
      'UPDATE ticket_item SET service_id=$1 WHERE service_id=$2',
      [migrate_to, req.params.id])).rowCount;
    await q('DELETE FROM service_option WHERE service_id=$1', [req.params.id]);
    await q('DELETE FROM service WHERE id=$1', [req.params.id]);
    await audit(req.user.id, req.user.storeId, 'service_delete', 'service', req.params.id,
      { mode: 'migrate', migrate_to, migrated });
    return res.json({ mode: 'migrate', migrated, migrate_to });
  }
  // Referenced + explicit archive → soft delete (active=false), keep history.
  if (archive) {
    const s = (await q(
      'UPDATE service SET active=false WHERE id=$1 AND store_id=$2 RETURNING *',
      [req.params.id, req.user.storeId])).rows[0];
    await audit(req.user.id, req.user.storeId, 'service_delete', 'service', s.id,
      { mode: 'soft' });
    return res.json({ mode: 'soft', service: s });
  }
  // Referenced but the caller gave no instruction → ask them to choose.
  return res.status(409).json({ error: 'in_use', needs_migrate: true, count });
});

// §v0.7 — add an option (add-on) to a service. Owner only. store_id inherited
// from the service. Audits 'service_option_add' (best-effort).
app.post('/api/services/:id/options', requireOwner, async (req, res) => {
  const svc = (await q(
    'SELECT * FROM service WHERE id=$1 AND store_id=$2',
    [req.params.id, req.user.storeId])).rows[0];
  if (!svc) return res.status(404).json({ error: 'service not found' });
  const { name, price_delta, minute_delta } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name required' });
  // §v0.8 — option inherits the (verified) parent service's store_id.
  const o = (await q(
    `INSERT INTO service_option (store_id, service_id, name, price_delta, minute_delta)
     VALUES ($1,$2,$3, COALESCE($4,0), COALESCE($5,0))
     RETURNING *`,
    [svc.store_id ?? req.user.storeId, svc.id, name,
     price_delta == null ? null : price_delta,
     minute_delta == null ? null : minute_delta])).rows[0];
  await audit(req.user.id, req.user.storeId, 'service_option_add', 'service_option', o.id,
    { service_id: svc.id, name: o.name });
  res.json(o);
});

// §v0.7 — partial update of an option. Owner only.
app.put('/api/services/:id/options/:oid', requireOwner, async (req, res) => {
  // §v0.8 — confirm the parent service is in this store before touching options.
  const svc = (await q(
    'SELECT id FROM service WHERE id=$1 AND store_id=$2',
    [req.params.id, req.user.storeId])).rows[0];
  if (!svc) return res.status(404).json({ error: 'service not found' });
  const existing = (await q(
    'SELECT * FROM service_option WHERE id=$1 AND service_id=$2',
    [req.params.oid, req.params.id])).rows[0];
  if (!existing) return res.status(404).json({ error: 'option not found' });
  const { name, price_delta, minute_delta, active } = req.body || {};
  const next = {
    name: name === undefined ? existing.name : name,
    price_delta: price_delta === undefined ? existing.price_delta : price_delta,
    minute_delta: minute_delta === undefined ? existing.minute_delta : minute_delta,
    active: active === undefined ? existing.active : !!active,
  };
  const o = (await q(
    `UPDATE service_option SET name=$3, price_delta=$4, minute_delta=$5, active=$6
      WHERE id=$1 AND service_id=$2 RETURNING *`,
    [req.params.oid, req.params.id, next.name, next.price_delta,
     next.minute_delta, next.active])).rows[0];
  res.json(o);
});

// §v0.7 — hard delete an option (config only, no ticket history). Owner only.
app.delete('/api/services/:id/options/:oid', requireOwner, async (req, res) => {
  // §v0.8 — confirm the parent service is in this store before deleting options.
  const svc = (await q(
    'SELECT id FROM service WHERE id=$1 AND store_id=$2',
    [req.params.id, req.user.storeId])).rows[0];
  if (!svc) return res.status(404).json({ error: 'service not found' });
  await q('DELETE FROM service_option WHERE id=$1 AND service_id=$2',
    [req.params.oid, req.params.id]);
  res.json({ ok: true });
});

app.get('/api/members', async (req, res) => {
  const term = (req.query.q || '').trim();
  if (term) {
    // §v0.8 — store-scoped search.
    const rows = (await q(
      `SELECT * FROM member
        WHERE store_id=$2 AND (name ILIKE $1 OR phone ILIKE $1)
        ORDER BY joined_at DESC`, [`%${term}%`, req.user.storeId])).rows;
    return res.json(rows);
  }
  res.json((await q(
    'SELECT * FROM member WHERE store_id=$1 ORDER BY joined_at DESC',
    [req.user.storeId])).rows);
});

app.post('/api/members', async (req, res) => {
  const { name, phone, line_user_id, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  // §v0.8 — store_id derived from session (was hardcoded 1).
  const m = (await q(
    `INSERT INTO member (store_id, name, phone, line_user_id, notes)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [req.user.storeId, name, phone || null, line_user_id || null, notes || null])).rows[0];
  res.json(m);
});

app.put('/api/members/:id', async (req, res) => {
  const existing = (await q(
    'SELECT * FROM member WHERE id=$1 AND store_id=$2',
    [req.params.id, req.user.storeId])).rows[0];
  if (!existing) return res.status(400).json({ error: 'member not found' });
  const { name, phone, line_user_id, notes } = req.body;
  const next = {
    name: name === undefined ? existing.name : name,
    phone: phone === undefined ? existing.phone : phone,
    line_user_id: line_user_id === undefined ? existing.line_user_id : line_user_id,
    notes: notes === undefined ? existing.notes : notes,
  };
  const m = (await q(
    `UPDATE member SET name=$2, phone=$3, line_user_id=$4, notes=$5
      WHERE id=$1 AND store_id=$6 RETURNING *`,
    [req.params.id, next.name, next.phone, next.line_user_id, next.notes,
     req.user.storeId])).rows[0];
  res.json(m);
});

app.get('/api/members/:id', async (req, res) => {
  const m = (await q(
    'SELECT * FROM member WHERE id=$1 AND store_id=$2',
    [req.params.id, req.user.storeId])).rows[0];
  if (!m) return res.status(404).json({ error: 'not found' });
  // §v0.8 — member is store-verified above; its tickets are scoped to the same
  // store too (defense-in-depth).
  const history = (await q(
    `SELECT t.id, t.status, t.created_at, t.closed_at,
            COALESCE(SUM(p.amount) FILTER (WHERE p.status='success'),0)::float AS spent
       FROM ticket t LEFT JOIN payment p ON p.ticket_id = t.id
      WHERE t.member_id=$1 AND t.store_id=$2
      GROUP BY t.id ORDER BY t.created_at DESC`,
    [req.params.id, req.user.storeId])).rows;
  res.json({ ...m, history });
});

app.get('/api/tickets', async (req, res) => {
  // §v0.8 — store-scoped list.
  const rows = (await q(
    `SELECT t.*, m.name AS member_name,
            COALESCE(SUM(ti.quoted_price*ti.qty),0)::float AS total
       FROM ticket t
       LEFT JOIN member m ON m.id = t.member_id
       LEFT JOIN ticket_item ti ON ti.ticket_id = t.id
      WHERE t.status IN ('open','in_progress','done') AND t.store_id=$1
      GROUP BY t.id, m.name ORDER BY t.created_at DESC`, [req.user.storeId])).rows;
  res.json(rows);
});

app.post('/api/tickets', async (req, res) => {
  const { member_id, staff_name, assigned_user_id } = req.body;
  // §v0.8 — store_id derived from session (was hardcoded 1).
  const t = (await q(
    `INSERT INTO ticket (store_id, member_id, staff_name, assigned_user_id, status)
     VALUES ($1,$2,$3,$4,'open') RETURNING *`,
    [req.user.storeId, member_id || null, staff_name || 'Front desk',
     assigned_user_id || null])).rows[0];
  res.json(await ticketDetail(t.id, req.user.storeId));
});

app.get('/api/tickets/:id', async (req, res) => {
  const d = await ticketDetail(req.params.id, req.user.storeId);
  if (!d) return res.status(404).json({ error: 'not found' });
  res.json(d);
});

app.post('/api/tickets/:id/items', async (req, res) => {
  // §v0.8 — verify the ticket is in this store before adding items.
  const ticket = (await q(
    'SELECT id FROM ticket WHERE id=$1 AND store_id=$2',
    [req.params.id, req.user.storeId])).rows[0];
  if (!ticket) return res.status(404).json({ error: 'not found' });
  const { service_id, qty, quoted_price, note, minutes, is_staff_price, override_pin } = req.body;
  if (!service_id || quoted_price == null)
    return res.status(400).json({ error: 'service_id and quoted_price required' });
  // §v0.8 — the chosen service must belong to this store too (no cross-tenant
  // service references). Doubles as the duration_min + staff_price lookup.
  const svc = (await q(
    'SELECT duration_min, staff_price FROM service WHERE id=$1 AND store_id=$2',
    [service_id, req.user.storeId])).rows[0];
  if (!svc) return res.status(404).json({ error: 'service not found' });
  // §v1.2 — staff pricing. Only takes effect if the service actually has a
  // staff_price; otherwise the flag is ignored (normal price, is_staff_price
  // false). When a non-owner actually uses staff price, it costs a daily quota
  // slot; over quota requires an owner-PIN override (same 403 contract).
  let price = quoted_price;
  let useStaffPrice = false;
  if (is_staff_price && svc.staff_price != null) {
    useStaffPrice = true;
    price = svc.staff_price;
    if (req.user.role !== 'owner') {
      const { daily_staff_price_quota } = await getEffectiveSettings(req.user.storeId, req.user.id);
      const used = await todayUsage(req.user.storeId, req.user.id, 'staff_price');
      if (used < daily_staff_price_quota) {
        await bumpUsage(req.user.storeId, req.user.id, 'staff_price');
      } else if (!override_pin) {
        return res.status(403).json({ error: 'override_required', need_override: true, reason: 'quota' });
      } else if (!(await verifyOwnerPin(req.user.storeId, override_pin))) {
        return res.status(403).json({ error: 'override_failed', need_override: true });
      } else {
        await bumpUsage(req.user.storeId, req.user.id, 'override');
      }
    }
  }
  // §v0.6 — per-item minutes defaults to the service's duration_min when omitted,
  // so est_minutes is always meaningful even if the client never sends minutes.
  const mins = minutes == null ? svc.duration_min : minutes;
  await q(
    `INSERT INTO ticket_item (ticket_id, service_id, qty, quoted_price, note, minutes, is_staff_price)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [req.params.id, service_id, qty || 1, price, note || null, mins, useStaffPrice]);
  await q("UPDATE ticket SET status='in_progress' WHERE id=$1 AND status='open'", [req.params.id]);
  await recomputeEstMinutes(req.params.id);
  res.json(await ticketDetail(req.params.id, req.user.storeId));
});

// §v1.1 — free-style ("ตามสั่ง") line item: no service catalog entry. The
// cashier supplies the name + price (+ optional minutes). Stored with
// service_id NULL and the label in custom_name; rolls into the bill total and
// est_minutes exactly like a normal item.
app.post('/api/tickets/:id/custom-item', async (req, res) => {
  const ticket = (await q(
    'SELECT id FROM ticket WHERE id=$1 AND store_id=$2',
    [req.params.id, req.user.storeId])).rows[0];
  if (!ticket) return res.status(404).json({ error: 'not found' });
  const { name, quoted_price, qty, minutes } = req.body || {};
  if (!name || !String(name).trim() || quoted_price == null)
    return res.status(400).json({ error: 'name and quoted_price required' });
  await q(
    `INSERT INTO ticket_item (ticket_id, service_id, custom_name, qty, quoted_price, note, minutes)
     VALUES ($1, NULL, $2, $3, $4, NULL, $5)`,
    [req.params.id, String(name).trim(), qty || 1, quoted_price,
     minutes == null || minutes === '' ? null : minutes]);
  await q("UPDATE ticket SET status='in_progress' WHERE id=$1 AND status='open'", [req.params.id]);
  await recomputeEstMinutes(req.params.id);
  res.json(await ticketDetail(req.params.id, req.user.storeId));
});

// §v0.6 — partial update of a ticket item (minutes / quoted_price / qty), then
// recompute the ticket's est_minutes. Only the provided fields change.
app.put('/api/tickets/:id/items/:itemId', async (req, res) => {
  // §v0.8 — verify the ticket is in this store before touching its items.
  const ticket = (await q(
    'SELECT id FROM ticket WHERE id=$1 AND store_id=$2',
    [req.params.id, req.user.storeId])).rows[0];
  if (!ticket) return res.status(404).json({ error: 'not found' });
  const existing = (await q(
    'SELECT * FROM ticket_item WHERE id=$1 AND ticket_id=$2',
    [req.params.itemId, req.params.id])).rows[0];
  if (!existing) return res.status(404).json({ error: 'item not found' });
  const { minutes, quoted_price, qty } = req.body || {};
  const next = {
    minutes: minutes === undefined ? existing.minutes : minutes,
    quoted_price: quoted_price === undefined ? existing.quoted_price : quoted_price,
    qty: qty === undefined ? existing.qty : qty,
  };
  await q(
    `UPDATE ticket_item SET minutes=$3, quoted_price=$4, qty=$5
      WHERE id=$1 AND ticket_id=$2`,
    [req.params.itemId, req.params.id, next.minutes, next.quoted_price, next.qty]);
  await recomputeEstMinutes(req.params.id);
  res.json(await ticketDetail(req.params.id, req.user.storeId));
});

app.delete('/api/tickets/:id/items/:itemId', async (req, res) => {
  // §v0.8 — verify the ticket is in this store before deleting its items.
  const ticket = (await q(
    'SELECT id FROM ticket WHERE id=$1 AND store_id=$2',
    [req.params.id, req.user.storeId])).rows[0];
  if (!ticket) return res.status(404).json({ error: 'not found' });
  await q('DELETE FROM ticket_item WHERE id=$1 AND ticket_id=$2',
    [req.params.itemId, req.params.id]);
  await recomputeEstMinutes(req.params.id);
  res.json(await ticketDetail(req.params.id, req.user.storeId));
});

// §v1.2 — shared discount permission gate for staff. Returns:
//   { ok:true, overrode:bool }                → proceed (caller applies+audits)
//   { ok:false, status, body }                → reply with res.status(status).json(body)
// Owners always pass without override/quota. Staff: within ceiling AND quota →
// bump 'discount' and proceed; otherwise need an owner-PIN override (bumps
// 'override'). reason = 'limit' (over ceiling) else 'quota'.
async function checkDiscountPermission(user, type, value, override_pin) {
  if (user.role === 'owner') return { ok: true, overrode: false };
  const s = await getEffectiveSettings(user.storeId, user.id);
  const dailyCount = await todayUsage(user.storeId, user.id, 'discount');
  const withinCeiling = type === 'percent'
    ? Number(value) <= Number(s.max_discount_percent)
    : Number(value) <= Number(s.max_discount_baht);
  const withinQuota = dailyCount < Number(s.daily_discount_quota);
  if (withinCeiling && withinQuota) {
    await bumpUsage(user.storeId, user.id, 'discount');
    return { ok: true, overrode: false };
  }
  if (!override_pin) {
    return { ok: false, status: 403,
      body: { error: 'override_required', need_override: true, reason: !withinCeiling ? 'limit' : 'quota' } };
  }
  if (!(await verifyOwnerPin(user.storeId, override_pin))) {
    return { ok: false, status: 403, body: { error: 'override_failed', need_override: true } };
  }
  await bumpUsage(user.storeId, user.id, 'override');
  return { ok: true, overrode: true };
}

// §v1.2 — bill-level discount. CLEAR (falsy type or zero/NaN value) is always
// allowed for any role; SET requires a valid type + positive value and, for
// staff, passes the ceiling/quota/override gate.
app.put('/api/tickets/:id/discount', async (req, res) => {
  const ticket = (await q(
    'SELECT id FROM ticket WHERE id=$1 AND store_id=$2',
    [req.params.id, req.user.storeId])).rows[0];
  if (!ticket) return res.status(404).json({ error: 'not found' });
  const { discount_type, discount_value, override_pin } = req.body || {};
  const val = Number(discount_value);
  if (!discount_type || !val || Number.isNaN(val)) {
    await q('UPDATE ticket SET discount_type=NULL, discount_value=NULL WHERE id=$1 AND store_id=$2',
      [req.params.id, req.user.storeId]);
    await audit(req.user.id, req.user.storeId, 'discount_clear', 'ticket', req.params.id, { level: 'bill' });
    return res.json(await ticketDetail(req.params.id, req.user.storeId));
  }
  if (!['percent', 'baht'].includes(discount_type) || val <= 0)
    return res.status(400).json({ error: 'invalid discount' });
  const gate = await checkDiscountPermission(req.user, discount_type, val, override_pin);
  if (!gate.ok) return res.status(gate.status).json(gate.body);
  await q('UPDATE ticket SET discount_type=$3, discount_value=$4 WHERE id=$1 AND store_id=$2',
    [req.params.id, req.user.storeId, discount_type, val]);
  await audit(req.user.id, req.user.storeId, 'discount_apply', 'ticket', req.params.id,
    { level: 'bill', discount_type, discount_value: val, override: !!gate.overrode });
  res.json(await ticketDetail(req.params.id, req.user.storeId));
});

// §v1.2 — per-item discount. Same clear/set/quota/override flow as the bill
// discount; counts toward the SAME 'discount' daily quota.
app.put('/api/tickets/:id/items/:itemId/discount', async (req, res) => {
  const item = (await q(
    `SELECT ti.id FROM ticket_item ti JOIN ticket t ON t.id = ti.ticket_id
      WHERE ti.id=$1 AND ti.ticket_id=$2 AND t.store_id=$3`,
    [req.params.itemId, req.params.id, req.user.storeId])).rows[0];
  if (!item) return res.status(404).json({ error: 'not found' });
  const { discount_type, discount_value, override_pin } = req.body || {};
  const val = Number(discount_value);
  if (!discount_type || !val || Number.isNaN(val)) {
    await q('UPDATE ticket_item SET discount_type=NULL, discount_value=NULL WHERE id=$1 AND ticket_id=$2',
      [req.params.itemId, req.params.id]);
    await audit(req.user.id, req.user.storeId, 'discount_clear', 'ticket_item', req.params.itemId,
      { level: 'item', item_id: Number(req.params.itemId) });
    return res.json(await ticketDetail(req.params.id, req.user.storeId));
  }
  if (!['percent', 'baht'].includes(discount_type) || val <= 0)
    return res.status(400).json({ error: 'invalid discount' });
  const gate = await checkDiscountPermission(req.user, discount_type, val, override_pin);
  if (!gate.ok) return res.status(gate.status).json(gate.body);
  await q('UPDATE ticket_item SET discount_type=$3, discount_value=$4 WHERE id=$1 AND ticket_id=$2',
    [req.params.itemId, req.params.id, discount_type, val]);
  await audit(req.user.id, req.user.storeId, 'discount_apply', 'ticket_item', req.params.itemId,
    { level: 'item', item_id: Number(req.params.itemId), discount_type, discount_value: val, override: !!gate.overrode });
  res.json(await ticketDetail(req.params.id, req.user.storeId));
});

// §v1.2 — store settings (discount ceilings + daily quotas). GET: any role.
app.get('/api/settings', async (req, res) => {
  res.json(await getSettings(req.user.storeId));
});

// §v1.2 — owner-only upsert of store settings. Numbers coerced + clamped >=0;
// percent clamped 0..100.
app.put('/api/settings', requireOwner, async (req, res) => {
  const b = req.body || {};
  const num = (x) => { const n = Number(x); return Number.isFinite(n) ? n : 0; };
  const max_discount_percent = clamp(num(b.max_discount_percent), 0, 100);
  const max_discount_baht = Math.max(0, num(b.max_discount_baht));
  const daily_discount_quota = Math.max(0, Math.trunc(num(b.daily_discount_quota)));
  const daily_staff_price_quota = Math.max(0, Math.trunc(num(b.daily_staff_price_quota)));
  const row = (await q(
    `INSERT INTO store_settings
       (store_id, max_discount_percent, max_discount_baht, daily_discount_quota, daily_staff_price_quota)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (store_id) DO UPDATE SET
       max_discount_percent=$2, max_discount_baht=$3,
       daily_discount_quota=$4, daily_staff_price_quota=$5, updated_at=now()
     RETURNING *`,
    [req.user.storeId, max_discount_percent, max_discount_baht,
     daily_discount_quota, daily_staff_price_quota])).rows[0];
  await audit(req.user.id, req.user.storeId, 'settings_update', 'store_settings', req.user.storeId, row);
  res.json(row);
});

// §v1.3 — per-staff discount/quota overrides. Owner only. Lists every staff in
// the store with their override row (nulls where unset) + the effective values
// (override-or-store). The UI shows the store defaults as placeholders.
app.get('/api/settings/staff', requireOwner, async (req, res) => {
  const store = await getSettings(req.user.storeId);
  const staff = (await q(
    "SELECT id, name, role, active FROM app_user WHERE store_id=$1 AND role='staff' ORDER BY id",
    [req.user.storeId])).rows;
  const overrides = (await q(
    'SELECT * FROM staff_settings WHERE store_id=$1', [req.user.storeId])).rows;
  const byUser = new Map(overrides.map((o) => [o.user_id, o]));
  const FIELDS = ['max_discount_percent', 'max_discount_baht', 'daily_discount_quota', 'daily_staff_price_quota'];
  const list = staff.map((u) => {
    const ov = byUser.get(u.id) || {};
    const override = {}; const effective = {};
    for (const f of FIELDS) {
      override[f] = ov[f] == null ? null : Number(ov[f]);
      effective[f] = ov[f] == null ? Number(store[f]) : Number(ov[f]);
    }
    return { user_id: u.id, name: u.name, active: u.active, override, effective };
  });
  res.json({ store, staff: list });
});

// §v1.3 — owner upserts one staff's overrides. Each field: '' / null → NULL
// (fall back to the store value); a number → clamp (percent 0..100, others >=0).
app.put('/api/settings/staff/:userId', requireOwner, async (req, res) => {
  const u = (await q(
    "SELECT id FROM app_user WHERE id=$1 AND store_id=$2 AND role='staff'",
    [req.params.userId, req.user.storeId])).rows[0];
  if (!u) return res.status(404).json({ error: 'staff not found' });
  const b = req.body || {};
  // null/'' stays null (fallback); otherwise coerce + clamp.
  const opt = (x, max) => {
    if (x == null || x === '') return null;
    const n = Number(x);
    if (!Number.isFinite(n)) return null;
    return max != null ? clamp(n, 0, max) : Math.max(0, n);
  };
  const optInt = (x) => {
    const v = opt(x, null);
    return v == null ? null : Math.trunc(v);
  };
  const mp = opt(b.max_discount_percent, 100);
  const mb = opt(b.max_discount_baht, null);
  const dq = optInt(b.daily_discount_quota);
  const sq = optInt(b.daily_staff_price_quota);
  const row = (await q(
    `INSERT INTO staff_settings
       (store_id, user_id, max_discount_percent, max_discount_baht, daily_discount_quota, daily_staff_price_quota)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (store_id, user_id) DO UPDATE SET
       max_discount_percent=$3, max_discount_baht=$4,
       daily_discount_quota=$5, daily_staff_price_quota=$6, updated_at=now()
     RETURNING *`,
    [req.user.storeId, req.params.userId, mp, mb, dq, sq])).rows[0];
  await audit(req.user.id, req.user.storeId, 'staff_settings_update', 'staff_settings', req.params.userId, row);
  res.json({ user_id: Number(req.params.userId), override: { max_discount_percent: mp, max_discount_baht: mb, daily_discount_quota: dq, daily_staff_price_quota: sq },
    effective: await getEffectiveSettings(req.user.storeId, Number(req.params.userId)) });
});

// §v1.2 — current user's usage counts for today (for the UI to show remaining).
app.get('/api/usage/today', async (req, res) => {
  const [discount, staff_price, override] = await Promise.all([
    todayUsage(req.user.storeId, req.user.id, 'discount'),
    todayUsage(req.user.storeId, req.user.id, 'staff_price'),
    todayUsage(req.user.storeId, req.user.id, 'override'),
  ]);
  res.json({ discount, staff_price, override });
});

// LINE confirm (mocked)
app.post('/api/tickets/:id/quote/send', async (req, res) => {
  // §v0.8 — ticketDetail is store-scoped; null → 404 (incl cross-tenant).
  const d = await ticketDetail(req.params.id, req.user.storeId);
  if (!d) return res.status(404).json({ error: 'not found' });
  const { lineMsgId: msgId } = await lineAdapter.pushQuote({
    lineUserId: d.member?.line_user_id || null,
    ticketId: req.params.id,
    quotedTotal: d.total,
  });
  const qc = (await q(
    `INSERT INTO quote_confirm (ticket_id, channel, quoted_total, sent_at, line_msg_id)
     VALUES ($1,'line',$2, now(), $3) RETURNING *`,
    [req.params.id, d.total, msgId])).rows[0];
  res.json({ ...await ticketDetail(req.params.id, req.user.storeId), justSent: qc });
});

app.post('/api/tickets/:id/quote/confirm', async (req, res) => {
  // §v0.8 — verify the ticket is in this store before confirming its quote.
  const ticket = (await q(
    'SELECT id FROM ticket WHERE id=$1 AND store_id=$2',
    [req.params.id, req.user.storeId])).rows[0];
  if (!ticket) return res.status(404).json({ error: 'not found' });
  await q(
    `UPDATE quote_confirm SET confirmed_at = now()
      WHERE ticket_id=$1 AND id = (SELECT id FROM quote_confirm WHERE ticket_id=$1 ORDER BY id DESC LIMIT 1)`,
    [req.params.id]);
  res.json(await ticketDetail(req.params.id, req.user.storeId));
});

// Payment — cash / beam_edc / unpaid. EDC simulated (persist-before-send).
app.post('/api/tickets/:id/payments', async (req, res) => {
  // §v0.8 — store scope only: confirm the ticket belongs to this store before
  // taking payment. The payment/idempotency logic below is UNCHANGED (SACRED).
  const ticket = (await q(
    'SELECT id FROM ticket WHERE id=$1 AND store_id=$2',
    [req.params.id, req.user.storeId])).rows[0];
  if (!ticket) return res.status(404).json({ error: 'not found' });
  const { method, amount, simulate } = req.body;
  if (!['cash', 'beam_edc', 'unpaid'].includes(method))
    return res.status(400).json({ error: 'bad method' });
  const seq = (await q(
    'SELECT COALESCE(MAX(payment_seq),0)+1 AS n FROM payment WHERE ticket_id=$1',
    [req.params.id])).rows[0].n;

  if (method === 'beam_edc') {
    // INVARIANT 1: persist idempotency key (durable) BEFORE calling Beam
    const key = randomUUID();
    const p = (await q(
      `INSERT INTO payment (ticket_id, payment_seq, method, amount, beam_idempotency_key, status)
       VALUES ($1,$2,'beam_edc',$3,$4,'pending') RETURNING *`,
      [req.params.id, seq, amount, key])).rows[0];
    // INVARIANT 1 satisfied: row durable. Now call Beam via adapter.
    const result = await beamAdapter.charge({
      idempotencyKey: key,
      amount,
      ticketId: req.params.id,
      simulate,
    });
    await q(
      `UPDATE payment SET status=$2, beam_charge_id=$3 WHERE id=$1`,
      [p.id, result.status, result.beamChargeId || null]);
  } else if (method === 'cash') {
    await q(
      `INSERT INTO payment (ticket_id, payment_seq, method, amount, status)
       VALUES ($1,$2,'cash',$3,'success')`, [req.params.id, seq, amount]);
  } else { // unpaid
    await q(
      `INSERT INTO payment (ticket_id, payment_seq, method, amount, status)
       VALUES ($1,$2,'unpaid',$3,'pending')`, [req.params.id, seq, amount]);
  }
  res.json(await ticketDetail(req.params.id, req.user.storeId));
});

// §4 INVARIANT 2 — retry an existing beam_edc payment reusing its stored key.
// Within 12h: idempotent re-charge with SAME key. Beyond 12h: key expired,
// mark failed, return 409 needs_reconcile (manual). Pure logic — mock Beam.
app.post('/api/tickets/:id/payments/:pid/retry', async (req, res) => {
  const { simulate } = req.body || {};
  // §v0.8 — scope the payment via its parent ticket's store. Cross-tenant pid →
  // not found (404). SACRED retry/idempotency logic below is UNCHANGED.
  const p = (await q(
    `SELECT p.* FROM payment p JOIN ticket t ON t.id = p.ticket_id
      WHERE p.id=$1 AND p.ticket_id=$2 AND t.store_id=$3`,
    [req.params.pid, req.params.id, req.user.storeId])).rows[0];
  if (!p) return res.status(404).json({ error: 'payment not found' });
  if (p.method !== 'beam_edc')
    return res.status(400).json({ error: 'not a beam_edc payment' });
  if (!['pending', 'failed'].includes(p.status))
    return res.status(409).json({ error: 'payment not retryable', status: p.status });
  if (!p.beam_idempotency_key)
    return res.status(409).json({ error: 'no idempotency key on payment' });

  const ageMs = Date.now() - new Date(p.created_at).getTime();
  if (ageMs > IDEMPOTENCY_REUSE_WINDOW_MS) {
    // INVARIANT 2: key too old to reuse safely → do NOT call Beam.
    await q(`UPDATE payment SET status='failed' WHERE id=$1`, [p.id]);
    return res.status(409).json({ error: 'idempotency_key_expired', needs_reconcile: true });
  }

  // Within 12h → re-call Beam with the SAME stored key (idempotent).
  const result = await beamAdapter.charge({
    idempotencyKey: p.beam_idempotency_key,
    amount: p.amount,
    ticketId: req.params.id,
    simulate,
  });
  await q(
    `UPDATE payment SET status=$2, beam_charge_id=$3 WHERE id=$1`,
    [p.id, result.status, result.beamChargeId || null]);
  res.json(await ticketDetail(req.params.id, req.user.storeId));
});

// Void a payment (§3 'voided' enum). Safe on pending/success/failed.
// OWNER ONLY (sensitive). Audits 'payment_void'.
app.post('/api/tickets/:id/payments/:pid/void', requireOwner, async (req, res) => {
  // §v0.8 — verify the ticket (and thus the payment) is in this store.
  const ticket = (await q(
    'SELECT id FROM ticket WHERE id=$1 AND store_id=$2',
    [req.params.id, req.user.storeId])).rows[0];
  if (!ticket) return res.status(404).json({ error: 'not found' });
  await q(
    `UPDATE payment SET status='voided' WHERE id=$1 AND ticket_id=$2`,
    [req.params.pid, req.params.id]);
  await audit(req.user.id, req.user.storeId, 'payment_void', 'payment', req.params.pid,
    { ticket_id: req.params.id });
  res.json(await ticketDetail(req.params.id, req.user.storeId));
});

// ---- Beam Bolt "Deep Link" payments (PoC) ----
// Separate from the SACRED /payments endpoints above. Same idempotency-key
// pattern (randomUUID → stored on the payment row → used as the Bolt
// x-beam-idempotency-key header) and the same INVARIANT 1 persist-before-send.

// Create a Bolt Intent for a ticket. Persists a pending beam_edc payment row
// BEFORE calling Beam (INVARIANT 1), then creates the intent via the adapter.
app.post('/api/tickets/:id/bolt-intent', requireAuth, async (req, res) => {
  const ticket = await ticketDetail(req.params.id, req.user.storeId);
  if (!ticket) return res.status(404).json({ error: 'not found' });

  // Load this store's Bolt pairing so we can default the mode and supply the
  // boltConnectionId for PAIRING (physical EDC) intents.
  const store = (await q(
    'SELECT bolt_connection_id FROM store WHERE id=$1',
    [req.user.storeId])).rows[0] || {};

  // mode: explicit body.mode wins; else PAIRING when paired, DEEP_LINK otherwise.
  const mode =
    req.body?.mode || (store.bolt_connection_id ? 'PAIRING' : 'DEEP_LINK');

  // PAIRING requires a paired terminal — fail BEFORE persisting any row.
  if (mode === 'PAIRING' && !store.bolt_connection_id) {
    return res.status(400).json({ error: 'ร้านยังไม่ได้ pair เครื่องรูดบัตร' });
  }

  const amount =
    req.body?.amount ?? (Number(ticket.total) - Number(ticket.paid)) ?? ticket.total;

  const seq = (await q(
    'SELECT COALESCE(MAX(payment_seq),0)+1 AS n FROM payment WHERE ticket_id=$1',
    [req.params.id])).rows[0].n;

  // INVARIANT 1: persist idempotency key (durable) BEFORE calling Beam.
  // SAME pattern as the SACRED beam_edc block — randomUUID stored on the row.
  const key = randomUUID();
  const p = (await q(
    `INSERT INTO payment (ticket_id, payment_seq, method, amount, beam_idempotency_key, status)
     VALUES ($1,$2,'beam_edc',$3,$4,'pending') RETURNING id`,
    [req.params.id, seq, amount, key])).rows[0];
  // INVARIANT 1 satisfied: row durable. Now create the Bolt Intent.

  let intent;
  try {
    intent = await beamBoltAdapter.createBoltIntent({
      mode,
      amountBaht: amount,
      referenceId: 'tkt-' + req.params.id + '-pay-' + p.id,
      boltConnectionId: store.bolt_connection_id,
      // PAIRING (EDC device) accepts card OR an on-device QR — client picks via paymentMethodType.
      paymentMethodType: req.body?.paymentMethodType,
      returnUrl:
        (process.env.PUBLIC_BASE_URL || 'http://localhost:8090') +
        '/?ticket=' + req.params.id,
      idempotencyKey: key,
    });
  } catch (e) {
    await q(`UPDATE payment SET status='failed' WHERE id=$1`, [p.id]);
    return res.status(502).json({ error: String(e.message || e) });
  }

  // PoC: reuse the beam_charge_id column to store the Bolt Intent id so the
  // poll endpoint (and webhook) can recover it without a schema change.
  await q(`UPDATE payment SET beam_charge_id=$2 WHERE id=$1`,
    [p.id, intent.boltIntentId || null]);

  res.json({
    payment_id: p.id,
    boltIntentId: intent.boltIntentId,
    deepLinkUrl: intent.deepLinkUrl,
    mode: intent.mode,
    // echo so the client panel can tell card-on-device vs QR-on-device (PAIRING)
    paymentMethodType: intent.paymentMethodType || (req.body?.paymentMethodType),
    mock: !!intent.mock,
  });
});

// Poll a Bolt Intent for a ticket's payment. ?simulate=success|fail drives the
// mock adapter. Maps the Bolt result enum onto the payment row status.
app.get('/api/tickets/:id/bolt-intent/:pid', requireAuth, async (req, res) => {
  // Scope the payment via its parent ticket's store — cross-tenant → 404.
  const p = (await q(
    `SELECT p.* FROM payment p JOIN ticket t ON t.id = p.ticket_id
      WHERE p.id=$1 AND p.ticket_id=$2 AND t.store_id=$3`,
    [req.params.pid, req.params.id, req.user.storeId])).rows[0];
  if (!p) return res.status(404).json({ error: 'payment not found' });

  // boltIntentId was stored in beam_charge_id at creation time (PoC reuse).
  const boltIntentId = p.beam_charge_id;
  const { result } = await beamBoltAdapter.getBoltIntent(boltIntentId, {
    simulate: req.query.simulate,
  });

  const FAILURES = [
    'CH_PROCESSING_FAILED', 'CH_INSUFFICIENT_FUNDS', 'CH_AUTHENTICATION_FAILED',
    'BI_EXPIRED', 'BI_CANCELED',
  ];
  let status = p.status;
  if (result === 'CH_SUCCEEDED') {
    status = 'success';
    await q(`UPDATE payment SET status='success' WHERE id=$1`, [p.id]);
  } else if (FAILURES.includes(result)) {
    status = 'failed';
    await q(`UPDATE payment SET status='failed' WHERE id=$1`, [p.id]);
  } // else: pending → leave status unchanged

  await audit(req.user.id, req.user.storeId, 'payment', 'payment', p.id,
    { bolt_result: result, status });

  res.json({
    result,
    status,
    ticket: await ticketDetail(req.params.id, req.user.storeId),
  });
});

// Cancel an in-flight Bolt Intent for a ticket's payment. The cashier hit
// "ยกเลิก" on the POS — propagate the cancel to Beam so the paired EDC terminal
// stops waiting for a card tap, then void the (still-pending) payment row.
// requireAuth (staff drives checkout); store-scoped via the parent ticket.
app.post('/api/tickets/:id/bolt-intent/:pid/cancel', requireAuth, async (req, res) => {
  // Scope the payment via its parent ticket's store — cross-tenant → 404.
  const p = (await q(
    `SELECT p.* FROM payment p JOIN ticket t ON t.id = p.ticket_id
      WHERE p.id=$1 AND p.ticket_id=$2 AND t.store_id=$3`,
    [req.params.pid, req.params.id, req.user.storeId])).rows[0];
  if (!p) return res.status(404).json({ error: 'payment not found' });

  // boltIntentId was stored in beam_charge_id at creation time (PoC reuse).
  const boltIntentId = p.beam_charge_id;
  let beamError = null;
  if (boltIntentId) {
    try {
      await beamBoltAdapter.cancelBoltIntent(boltIntentId);
    } catch (e) {
      // Best-effort: log + report, but still void our row so the POS isn't stuck.
      beamError = String(e.message || e);
      console.warn('[bolt-cancel]', beamError);
    }
  }

  // Void the pending row (§3 'voided' enum) — same void logic as the manual void.
  await q(
    `UPDATE payment SET status='voided' WHERE id=$1 AND ticket_id=$2`,
    [p.id, req.params.id]);
  await audit(req.user.id, req.user.storeId, 'payment_void', 'payment', p.id,
    { ticket_id: req.params.id, reason: 'bolt_cancel', bolt_intent_id: boltIntentId, beam_error: beamError });

  res.json({
    ok: true,
    beamError, // null on success; a message if Beam cancel failed (row still voided)
    ticket: await ticketDetail(req.params.id, req.user.storeId),
  });
});

// §v0.6 — assign (or unassign) a technician to a ticket. Pass assigned_user_id
// null to unassign. Does not change status or start the clock.
app.put('/api/tickets/:id/assign', async (req, res) => {
  const t = (await q(
    'SELECT id FROM ticket WHERE id=$1 AND store_id=$2',
    [req.params.id, req.user.storeId])).rows[0];
  if (!t) return res.status(404).json({ error: 'not found' });
  const { assigned_user_id } = req.body || {};
  // §v0.8 — the technician must belong to this store too (no cross-tenant assign).
  if (assigned_user_id) {
    const tech = (await q(
      'SELECT id, role FROM app_user WHERE id=$1 AND store_id=$2',
      [assigned_user_id, req.user.storeId])).rows[0];
    if (!tech) return res.status(404).json({ error: 'user not found' });
    // owner = manager only, cannot take jobs.
    if (tech.role === 'owner')
      return res.status(400).json({ error: 'owner cannot take jobs / เจ้าของร้านรับงานไม่ได้' });
  }
  await q('UPDATE ticket SET assigned_user_id=$2 WHERE id=$1 AND store_id=$3',
    [req.params.id, assigned_user_id || null, req.user.storeId]);
  res.json(await ticketDetail(req.params.id, req.user.storeId));
});

// §v0.6 — start work: set status=in_progress, started_at=now(), recompute
// est_minutes, and (optionally) assign a technician. From now the assigned tech
// is busy/locked until started_at + est_minutes (derived busy_until).
app.post('/api/tickets/:id/start', async (req, res) => {
  const t = (await q(
    'SELECT * FROM ticket WHERE id=$1 AND store_id=$2',
    [req.params.id, req.user.storeId])).rows[0];
  if (!t) return res.status(404).json({ error: 'not found' });
  const { assigned_user_id } = req.body || {};
  const tech = assigned_user_id !== undefined && assigned_user_id !== null
    ? assigned_user_id
    : t.assigned_user_id;
  // §v0.8 — if a technician is being assigned, they must be in this store.
  if (tech) {
    const techRow = (await q(
      'SELECT id, role FROM app_user WHERE id=$1 AND store_id=$2',
      [tech, req.user.storeId])).rows[0];
    if (!techRow) return res.status(404).json({ error: 'user not found' });
    // owner = manager only, cannot take jobs.
    if (techRow.role === 'owner')
      return res.status(400).json({ error: 'owner cannot take jobs / เจ้าของร้านรับงานไม่ได้' });
  }
  await recomputeEstMinutes(req.params.id);
  await q(
    `UPDATE ticket
        SET status='in_progress', started_at=now(), assigned_user_id=$2
      WHERE id=$1 AND store_id=$3`,
    [req.params.id, tech || null, req.user.storeId]);
  res.json(await ticketDetail(req.params.id, req.user.storeId));
});

app.post('/api/tickets/:id/close', async (req, res) => {
  // §v0.8 — scope close to this store. No cross-tenant ticket close.
  const t = (await q(
    'SELECT id FROM ticket WHERE id=$1 AND store_id=$2',
    [req.params.id, req.user.storeId])).rows[0];
  if (!t) return res.status(404).json({ error: 'not found' });
  await q("UPDATE ticket SET status='closed', closed_at=now() WHERE id=$1 AND store_id=$2",
    [req.params.id, req.user.storeId]);
  await audit(req.user.id, req.user.storeId, 'ticket_close', 'ticket', req.params.id, null);
  res.json(await ticketDetail(req.params.id, req.user.storeId));
});

// §v0.6 — Queue board. Computed live from app_user + ticket. A technician is
// "busy" iff there is an in_progress ticket assigned to them with started_at set
// whose busy_until (started_at + est_minutes*60000) is still in the future.
app.get('/api/queue', async (req, res) => {
  const now = Date.now();
  const storeId = req.user.storeId;
  // §v0.8 — store-scoped technicians + tickets.
  // owner = manager only (cannot take jobs) → exclude from the queue board.
  const techs = (await q(
    "SELECT id, name, role FROM app_user WHERE active AND store_id=$1 AND role <> 'owner' ORDER BY role, name",
    [storeId])).rows;
  // Live open/in_progress tickets with member name for labels.
  const tickets = (await q(
    `SELECT t.*, m.name AS member_name
       FROM ticket t LEFT JOIN member m ON m.id = t.member_id
      WHERE t.status IN ('open','in_progress') AND t.store_id=$1
      ORDER BY t.created_at`, [storeId])).rows;

  const labelOf = (t) =>
    `บิล #${t.id} · ${t.member_name || 'ลูกค้าทั่วไป'}`;

  // The single active (busy-counted) ticket per technician, if any.
  const activeByTech = new Map();
  for (const t of tickets) {
    const bu = busyUntil(t);
    if (bu && bu.getTime() > now && t.assigned_user_id != null) {
      const prev = activeByTech.get(t.assigned_user_id);
      // Keep the one finishing latest (the genuine current lock).
      if (!prev || busyUntil(prev).getTime() < bu.getTime())
        activeByTech.set(t.assigned_user_id, t);
    }
  }

  const technicians = techs.map(tech => {
    const active = activeByTech.get(tech.id) || null;
    const bu = active ? busyUntil(active) : null;
    return {
      id: tech.id,
      name: tech.name,
      role: tech.role,
      status: active ? 'busy' : 'available',
      busy_until: bu ? bu.toISOString() : null,
      remaining_min: bu ? Math.max(0, Math.ceil((bu.getTime() - now) / 60000)) : 0,
      current_ticket_id: active ? active.id : null,
      current_ticket_label: active ? labelOf(active) : null,
    };
  });

  // Waiting = upcoming work: open/in_progress tickets that are NOT an actively
  // busy-counted lock (open, assigned-but-not-started, or in_progress whose
  // estimate has already elapsed).
  const activeTicketIds = new Set([...activeByTech.values()].map(t => t.id));
  const waiting = tickets
    .filter(t => !activeTicketIds.has(t.id))
    .map(t => ({
      ticket_id: t.id,
      member_name: t.member_name || null,
      assigned_user_id: t.assigned_user_id || null,
      assigned_name: null, // filled below
      est_minutes: t.est_minutes == null ? null : Number(t.est_minutes),
    }));

  // Resolve assigned_name for waiting rows (assignee may be an inactive user, so
  // look up any ids not covered by the active technician list — one batched query).
  const nameById = new Map(techs.map(u => [u.id, u.name]));
  const missing = [...new Set(
    waiting.map(w => w.assigned_user_id).filter(uid => uid != null && !nameById.has(uid)))];
  if (missing.length) {
    const extra = (await q(
      'SELECT id, name FROM app_user WHERE id = ANY($1) AND store_id=$2',
      [missing, storeId])).rows;
    for (const u of extra) nameById.set(u.id, u.name);
  }
  for (const w of waiting) {
    if (w.assigned_user_id != null) w.assigned_name = nameById.get(w.assigned_user_id) || null;
  }

  res.json({ technicians, waiting });
});

// ---- static client ----
const clientDir = join(__dirname, '../client/dist');
app.use(express.static(clientDir));
app.get('*', (_req, res) => res.sendFile(join(clientDir, 'index.html')));

withRetry(bootstrap).then(() => {
  app.listen(PORT, () => console.log(`[lazy-pos] listening on :${PORT}`));
}).catch(e => { console.error(e); process.exit(1); });
