import express from 'express';
import pg from 'pg';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createBeamAdapter } from './adapters/beam.js';
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
async function ticketDetail(id) {
  const t = (await q('SELECT * FROM ticket WHERE id=$1', [id])).rows[0];
  if (!t) return null;
  const member = t.member_id
    ? (await q('SELECT * FROM member WHERE id=$1', [t.member_id])).rows[0]
    : null;
  const items = (await q(
    `SELECT ti.*, s.name AS service_name, s.category
       FROM ticket_item ti JOIN service s ON s.id = ti.service_id
      WHERE ti.ticket_id=$1 ORDER BY ti.id`, [id])).rows;
  const payments = (await q(
    'SELECT * FROM payment WHERE ticket_id=$1 ORDER BY payment_seq', [id])).rows;
  const quote = (await q(
    'SELECT * FROM quote_confirm WHERE ticket_id=$1 ORDER BY id DESC LIMIT 1', [id])).rows[0] || null;
  const total = items.reduce((s, i) => s + Number(i.quoted_price) * i.qty, 0);
  const paid = payments.filter(p => p.status === 'success')
    .reduce((s, p) => s + Number(p.amount), 0);
  return { ...t, member, items, payments, quote, total, paid };
}

const app = express();
app.use(express.json());

// ---- auth middleware ----
// requireAuth: resolve Bearer token → req.user. Missing/invalid → 401.
function requireAuth(req, res, next) {
  const header = req.headers['authorization'] || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
  const session = getSession(token);
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

// ---- PUBLIC API (no token) ----
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Login picker — active users only, minimal shape.
app.get('/api/auth/users', async (_req, res) => {
  const rows = (await q(
    'SELECT id, name, role FROM app_user WHERE active ORDER BY role, name')).rows;
  res.json(rows);
});

// Login — verify PIN, issue session token. Audits 'login' on success.
app.post('/api/auth/login', async (req, res) => {
  const { userId, pin } = req.body || {};
  if (userId == null || pin == null)
    return res.status(401).json({ error: 'invalid_credentials' });
  const user = (await q(
    'SELECT * FROM app_user WHERE id=$1 AND active', [userId])).rows[0];
  if (!user || !verifyPin(pin, user.pin_hash))
    return res.status(401).json({ error: 'invalid_credentials' });
  const token = createSession(user);
  await audit(user.id, user.store_id, 'login', 'app_user', user.id, null);
  res.json({ token, user: { id: user.id, name: user.name, role: user.role } });
});

// ---- AUTH GATE: everything below /api/* requires a valid session ----
app.use('/api', requireAuth);

// Logout — destroy current session.
app.post('/api/auth/logout', (req, res) => {
  destroySession(req.user.token);
  res.json({ ok: true });
});

// ---- OWNER-ONLY: user management ----
app.get('/api/users', requireOwner, async (_req, res) => {
  const rows = (await q(
    `SELECT id, name, role, active, created_at FROM app_user
      ORDER BY created_at, id`)).rows;
  res.json(rows);
});

app.post('/api/users', requireOwner, async (req, res) => {
  const { name, role, pin } = req.body || {};
  if (!name || !role || pin == null)
    return res.status(400).json({ error: 'name, role and pin required' });
  if (!['owner', 'staff'].includes(role))
    return res.status(400).json({ error: 'bad role' });
  const u = (await q(
    `INSERT INTO app_user (store_id, name, role, pin_hash)
     VALUES ($1,$2,$3,$4)
     RETURNING id, name, role, active, created_at`,
    [req.user.storeId, name, role, hashPin(pin)])).rows[0];
  await audit(req.user.id, req.user.storeId, 'user_create', 'app_user', u.id,
    { name: u.name, role: u.role });
  res.json(u);
});

app.put('/api/users/:id', requireOwner, async (req, res) => {
  const existing = (await q('SELECT * FROM app_user WHERE id=$1', [req.params.id])).rows[0];
  if (!existing) return res.status(404).json({ error: 'user not found' });
  const { name, role, pin, active } = req.body || {};
  if (role !== undefined && !['owner', 'staff'].includes(role))
    return res.status(400).json({ error: 'bad role' });
  const next = {
    name: name === undefined ? existing.name : name,
    role: role === undefined ? existing.role : role,
    active: active === undefined ? existing.active : !!active,
    pin_hash: pin === undefined || pin === null ? existing.pin_hash : hashPin(pin),
  };
  const u = (await q(
    `UPDATE app_user SET name=$2, role=$3, active=$4, pin_hash=$5
      WHERE id=$1
      RETURNING id, name, role, active, created_at`,
    [req.params.id, next.name, next.role, next.active, next.pin_hash])).rows[0];
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
  const params = [];
  let where = '';
  if (action) { where = 'WHERE a.action = $1'; params.push(action); }
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

app.get('/api/summary', async (_req, res) => {
  const sales = (await q(
    `SELECT COALESCE(SUM(amount),0)::float AS revenue, COUNT(*)::int AS txns
       FROM payment
      WHERE status='success' AND created_at::date = now()::date`)).rows[0];
  const members = (await q('SELECT COUNT(*)::int n FROM member')).rows[0].n;
  const openTickets = (await q(
    "SELECT COUNT(*)::int n FROM ticket WHERE status IN ('open','in_progress','done')")).rows[0].n;
  const services = (await q('SELECT COUNT(*)::int n FROM service WHERE active')).rows[0].n;
  res.json({ revenue: sales.revenue, txns: sales.txns, members, openTickets, services });
});

app.get('/api/services', async (_req, res) => {
  res.json((await q('SELECT * FROM service WHERE active ORDER BY category, name')).rows);
});

// Service catalog edit (incl. price) — owner only. Audits price changes.
app.put('/api/services/:id', requireOwner, async (req, res) => {
  const existing = (await q('SELECT * FROM service WHERE id=$1', [req.params.id])).rows[0];
  if (!existing) return res.status(404).json({ error: 'service not found' });
  const { name, base_price, active } = req.body || {};
  const next = {
    name: name === undefined ? existing.name : name,
    base_price: base_price === undefined ? existing.base_price : base_price,
    active: active === undefined ? existing.active : !!active,
  };
  const s = (await q(
    `UPDATE service SET name=$2, base_price=$3, active=$4
      WHERE id=$1 RETURNING *`,
    [req.params.id, next.name, next.base_price, next.active])).rows[0];
  if (base_price !== undefined && Number(base_price) !== Number(existing.base_price)) {
    await audit(req.user.id, req.user.storeId, 'service_price_change', 'service', s.id,
      { old_price: Number(existing.base_price), new_price: Number(s.base_price) });
  }
  res.json(s);
});

app.get('/api/members', async (req, res) => {
  const term = (req.query.q || '').trim();
  if (term) {
    const rows = (await q(
      `SELECT * FROM member
        WHERE name ILIKE $1 OR phone ILIKE $1
        ORDER BY joined_at DESC`, [`%${term}%`])).rows;
    return res.json(rows);
  }
  res.json((await q('SELECT * FROM member ORDER BY joined_at DESC')).rows);
});

app.post('/api/members', async (req, res) => {
  const { name, phone, line_user_id, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  const m = (await q(
    `INSERT INTO member (store_id, name, phone, line_user_id, notes)
     VALUES (1,$1,$2,$3,$4) RETURNING *`,
    [name, phone || null, line_user_id || null, notes || null])).rows[0];
  res.json(m);
});

app.put('/api/members/:id', async (req, res) => {
  const existing = (await q('SELECT * FROM member WHERE id=$1', [req.params.id])).rows[0];
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
      WHERE id=$1 RETURNING *`,
    [req.params.id, next.name, next.phone, next.line_user_id, next.notes])).rows[0];
  res.json(m);
});

app.get('/api/members/:id', async (req, res) => {
  const m = (await q('SELECT * FROM member WHERE id=$1', [req.params.id])).rows[0];
  if (!m) return res.status(404).json({ error: 'not found' });
  const history = (await q(
    `SELECT t.id, t.status, t.created_at, t.closed_at,
            COALESCE(SUM(p.amount) FILTER (WHERE p.status='success'),0)::float AS spent
       FROM ticket t LEFT JOIN payment p ON p.ticket_id = t.id
      WHERE t.member_id=$1
      GROUP BY t.id ORDER BY t.created_at DESC`, [req.params.id])).rows;
  res.json({ ...m, history });
});

app.get('/api/tickets', async (_req, res) => {
  const rows = (await q(
    `SELECT t.*, m.name AS member_name,
            COALESCE(SUM(ti.quoted_price*ti.qty),0)::float AS total
       FROM ticket t
       LEFT JOIN member m ON m.id = t.member_id
       LEFT JOIN ticket_item ti ON ti.ticket_id = t.id
      WHERE t.status IN ('open','in_progress','done')
      GROUP BY t.id, m.name ORDER BY t.created_at DESC`)).rows;
  res.json(rows);
});

app.post('/api/tickets', async (req, res) => {
  const { member_id, staff_name } = req.body;
  const t = (await q(
    `INSERT INTO ticket (store_id, member_id, staff_name, status)
     VALUES (1,$1,$2,'open') RETURNING *`,
    [member_id || null, staff_name || 'Front desk'])).rows[0];
  res.json(await ticketDetail(t.id));
});

app.get('/api/tickets/:id', async (req, res) => {
  const d = await ticketDetail(req.params.id);
  if (!d) return res.status(404).json({ error: 'not found' });
  res.json(d);
});

app.post('/api/tickets/:id/items', async (req, res) => {
  const { service_id, qty, quoted_price, note } = req.body;
  if (!service_id || quoted_price == null)
    return res.status(400).json({ error: 'service_id and quoted_price required' });
  await q(
    `INSERT INTO ticket_item (ticket_id, service_id, qty, quoted_price, note)
     VALUES ($1,$2,$3,$4,$5)`,
    [req.params.id, service_id, qty || 1, quoted_price, note || null]);
  await q("UPDATE ticket SET status='in_progress' WHERE id=$1 AND status='open'", [req.params.id]);
  res.json(await ticketDetail(req.params.id));
});

app.delete('/api/tickets/:id/items/:itemId', async (req, res) => {
  await q('DELETE FROM ticket_item WHERE id=$1 AND ticket_id=$2',
    [req.params.itemId, req.params.id]);
  res.json(await ticketDetail(req.params.id));
});

// LINE confirm (mocked)
app.post('/api/tickets/:id/quote/send', async (req, res) => {
  const d = await ticketDetail(req.params.id);
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
  res.json({ ...await ticketDetail(req.params.id), justSent: qc });
});

app.post('/api/tickets/:id/quote/confirm', async (req, res) => {
  await q(
    `UPDATE quote_confirm SET confirmed_at = now()
      WHERE ticket_id=$1 AND id = (SELECT id FROM quote_confirm WHERE ticket_id=$1 ORDER BY id DESC LIMIT 1)`,
    [req.params.id]);
  res.json(await ticketDetail(req.params.id));
});

// Payment — cash / beam_edc / unpaid. EDC simulated (persist-before-send).
app.post('/api/tickets/:id/payments', async (req, res) => {
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
  res.json(await ticketDetail(req.params.id));
});

// §4 INVARIANT 2 — retry an existing beam_edc payment reusing its stored key.
// Within 12h: idempotent re-charge with SAME key. Beyond 12h: key expired,
// mark failed, return 409 needs_reconcile (manual). Pure logic — mock Beam.
app.post('/api/tickets/:id/payments/:pid/retry', async (req, res) => {
  const { simulate } = req.body || {};
  const p = (await q(
    'SELECT * FROM payment WHERE id=$1 AND ticket_id=$2',
    [req.params.pid, req.params.id])).rows[0];
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
  res.json(await ticketDetail(req.params.id));
});

// Void a payment (§3 'voided' enum). Safe on pending/success/failed.
// OWNER ONLY (sensitive). Audits 'payment_void'.
app.post('/api/tickets/:id/payments/:pid/void', requireOwner, async (req, res) => {
  await q(
    `UPDATE payment SET status='voided' WHERE id=$1 AND ticket_id=$2`,
    [req.params.pid, req.params.id]);
  await audit(req.user.id, req.user.storeId, 'payment_void', 'payment', req.params.pid,
    { ticket_id: req.params.id });
  res.json(await ticketDetail(req.params.id));
});

app.post('/api/tickets/:id/close', async (req, res) => {
  await q("UPDATE ticket SET status='closed', closed_at=now() WHERE id=$1", [req.params.id]);
  await audit(req.user.id, req.user.storeId, 'ticket_close', 'ticket', req.params.id, null);
  res.json(await ticketDetail(req.params.id));
});

// ---- static client ----
const clientDir = join(__dirname, '../client/dist');
app.use(express.static(clientDir));
app.get('*', (_req, res) => res.sendFile(join(clientDir, 'index.html')));

withRetry(bootstrap).then(() => {
  app.listen(PORT, () => console.log(`[lazy-pos] listening on :${PORT}`));
}).catch(e => { console.error(e); process.exit(1); });
