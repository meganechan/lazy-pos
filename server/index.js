import express from 'express';
import pg from 'pg';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 8080;
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

// ---- API ----
app.get('/api/health', (_req, res) => res.json({ ok: true }));

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

app.get('/api/members', async (_req, res) => {
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
  const msgId = 'line_' + randomUUID().slice(0, 8);
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
    // simulate Beam Bolt deep-link + Charges API result
    const ok = simulate !== 'fail';
    await q(
      `UPDATE payment SET status=$2, beam_charge_id=$3 WHERE id=$1`,
      [p.id, ok ? 'success' : 'failed', ok ? 'beam_' + key.slice(0, 12) : null]);
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

app.post('/api/tickets/:id/close', async (req, res) => {
  await q("UPDATE ticket SET status='closed', closed_at=now() WHERE id=$1", [req.params.id]);
  res.json(await ticketDetail(req.params.id));
});

// ---- static client ----
const clientDir = join(__dirname, '../client/dist');
app.use(express.static(clientDir));
app.get('*', (_req, res) => res.sendFile(join(clientDir, 'index.html')));

withRetry(bootstrap).then(() => {
  app.listen(PORT, () => console.log(`[lazy-pos] listening on :${PORT}`));
}).catch(e => { console.error(e); process.exit(1); });
