// Real server, per-run disposable PG, and local fake Beam only.
import http from 'node:http';
import { once } from 'node:events';
import assert from 'node:assert/strict';
import { startServer } from './harness.mjs';
let beamCalls = [];
const beamResult = { bolti_t1: 'BI_EXPIRED', bolti_t2: 'CH_SUCCEEDED' };
const beam = http.createServer((req, res) => {
  beamCalls.push(req.method + ' ' + req.url);
  const id = req.url.split('/').pop();
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ id, result: beamResult[id] || '' }));
}).listen(0, '127.0.0.1');
await once(beam, 'listening');

const h = await startServer({ env: {
  BEAM_BOLT_MERCHANT_ID:'m', BEAM_BOLT_API_KEY:'k',
  BEAM_BOLT_API_BASE:`http://127.0.0.1:${beam.address().port}`,
} });
const db=h.db, base=h.base;
const q=(text,params)=>db.query(text,params);
try {
const owner = (await q(`SELECT id FROM app_user WHERE role='owner' AND store_id=1 LIMIT 1`)).rows[0].id;
const { token } = await (await fetch(base + '/api/auth/login', { method: 'POST',
  headers: { 'content-type': 'application/json' }, body: JSON.stringify({ userId: owner, pin: '1234' }) })).json();
const H = { 'content-type': 'application/json', authorization: 'Bearer ' + token };
const post = (u, b) => fetch(base + u, { method: 'POST', headers: H, body: JSON.stringify(b || {}) });

const t = (await q(`INSERT INTO ticket (store_id, status) VALUES (1,'open') RETURNING id`)).rows[0].id;
await q(`INSERT INTO ticket_item (ticket_id, custom_name, qty, quoted_price) VALUES ($1,'x',1,350)`, [t]);
const mk = async (seq, charge, status) => (await q(
  `INSERT INTO payment (ticket_id, payment_seq, method, amount, beam_idempotency_key, beam_charge_id, status)
   VALUES ($1,$2,'beam_edc',350,gen_random_uuid(),$3,$4) RETURNING id`, [t, seq, charge, status])).rows[0].id;
const pFailed = await mk(1, 'bolti_t1', 'failed');
const pLegacy = await mk(2, null, 'pending');
const pPaid = await mk(3, 'bolti_t2', 'pending');
const row = async (id) => (await q('SELECT status, beam_charge_id FROM payment WHERE id=$1', [id])).rows[0];

// 1. failed Bolt row + Beam says expired → stays failed, charge id untouched, Beam was asked
let r = await post(`/api/tickets/${t}/payments/${pFailed}/retry`);
assert.equal(r.status, 200);
assert.deepEqual(await row(pFailed), { status: 'failed', beam_charge_id: 'bolti_t1' });
assert.ok(beamCalls.some((c) => c.endsWith('/bolt-intents/bolti_t1')));

// 2. legacy row (no Bolt id) in real mode → 400, untouched
r = await post(`/api/tickets/${t}/payments/${pLegacy}/retry`);
assert.equal(r.status, 400);
assert.deepEqual(await row(pLegacy), { status: 'pending', beam_charge_id: null });

// 3. direct legacy beam_edc charge in real mode → 400, no row added
const before = (await q('SELECT count(*)::int n FROM payment WHERE ticket_id=$1', [t])).rows[0].n;
r = await post(`/api/tickets/${t}/payments`, { method: 'beam_edc', amount: 350 });
assert.equal(r.status, 400);
assert.equal((await q('SELECT count(*)::int n FROM payment WHERE ticket_id=$1', [t])).rows[0].n, before);

// 4. pending Bolt row + Beam says succeeded → success via real status, ticket auto-closes
r = await post(`/api/tickets/${t}/payments/${pPaid}/retry`);
assert.equal(r.status, 200);
assert.deepEqual(await row(pPaid), { status: 'success', beam_charge_id: 'bolti_t2' });
assert.equal((await q('SELECT status FROM ticket WHERE id=$1', [t])).rows[0].status, 'closed');

// 5. cash still works
const t2 = (await q(`INSERT INTO ticket (store_id, status) VALUES (1,'open') RETURNING id`)).rows[0].id;
await q("INSERT INTO ticket_item (ticket_id, custom_name, qty, quoted_price) VALUES ($1,'cash fixture',1,100)", [t2]);
r = await post(`/api/tickets/${t2}/payments`, { method: 'cash', amount: 100 });
assert.equal(r.status, 200);

assert.ok(!(await q(`SELECT 1 FROM payment WHERE beam_charge_id LIKE 'beam\\_%'`)).rows.length, 'no legacy mock ids');
console.log('E2E PASS — beam calls:', beamCalls);
} finally { await h.close(); await new Promise(r=>beam.close(r)); }
