// node --test server/e2e/payment-lifecycle.mjs (each run owns a fresh DB)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { startServer } from './harness.mjs';
let h;
before(async()=>{h=await startServer();});
after(async()=>{await h?.close();});
async function ticket(total=100) {
  const {body:t}=await h.request('/api/tickets',{});
  assert.equal((await h.request(`/api/tickets/${t.id}/custom-item`,{name:'fixture',quoted_price:total})).status,200);
  return t.id;
}
const payment=(id,amount=100,method='cash')=>h.request(`/api/tickets/${id}/payments`,{amount,method});
const bolt=(id,amount=100)=>h.request(`/api/tickets/${id}/bolt-intent`,{amount});
const row=async id=>(await h.db.query('SELECT * FROM payment WHERE id=$1',[id])).rows[0];
async function webhook(p,status) {
  const body={id:p.boltIntentId,status};
  const signature=createHmac('sha256','local-test-secret').update(JSON.stringify(body)).digest('base64');
  return h.request('/api/webhooks/beam',body,'POST',{'x-beam-signature':signature});
}
test('duplicate closed cash and Bolt charges are rejected without changing paid',async()=>{
  const id=await ticket();assert.equal((await payment(id)).status,200);
  for(const send of [()=>payment(id),()=>bolt(id),()=>payment(id,100,'unpaid')]) {
    const r=await send();assert.equal(r.status,409);assert.equal(r.body.error,'ticket_closed');
  }
  const d=(await h.request(`/api/tickets/${id}`)).body;assert.equal(d.paid,100);assert.equal(d.payments.length,1);
});
test('negative, excess, zero outstanding and voided bills do not insert payments',async()=>{
  const id=await ticket();assert.equal((await payment(id,-10)).status,400);
  for(const r of [await payment(id,101),await bolt(id,101)]) {assert.equal(r.status,409);assert.equal(r.body.error,'amount_exceeds_outstanding');}
  assert.equal((await h.request(`/api/tickets/${id}`)).body.payments.length,0);
  await h.db.query('UPDATE ticket SET voided_at=now() WHERE id=$1',[id]);
  assert.equal((await payment(id)).body.error,'ticket_closed');
  assert.equal((await bolt(id)).body.error,'ticket_closed');
  const empty=(await h.request('/api/tickets',{})).body.id;
  assert.equal((await payment(empty,1)).status,409);
});
test('two simultaneous full cash payments serialize: one success, one 409',async()=>{
  const id=await ticket();const results=await Promise.all([payment(id),payment(id)]);
  assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
  assert.equal((await h.request(`/api/tickets/${id}`)).body.paid,100);
});
test('concurrent partial payments allocate distinct sequences under the ticket lock',async()=>{
  const id=await ticket(1000);const results=await Promise.all(Array.from({length:20},()=>payment(id,10)));
  assert.ok(results.every(r=>r.status===200));
  const d=(await h.request(`/api/tickets/${id}`)).body;
  assert.equal(d.paid,200);assert.equal(new Set(d.payments.map(p=>p.payment_seq)).size,20);
});
test('signed PAID → EXPIRED → PAID keeps one success and stable money/key',async()=>{
  const id=await ticket();const p=(await bolt(id)).body;const before=await row(p.payment_id);
  for(const status of ['PAID','EXPIRED','PAID']) {
    assert.equal((await webhook(p,status)).status,200);
    assert.equal((await row(p.payment_id)).status,'success');
    assert.equal((await h.request(`/api/tickets/${id}`)).body.paid,100);
  }
  assert.equal((await row(p.payment_id)).beam_idempotency_key,before.beam_idempotency_key);
  assert.equal((await h.db.query("SELECT count(*)::int n FROM audit_log WHERE action='bolt_webhook' AND entity_id=$1",[String(p.payment_id)])).rows[0].n,3);
});
test('success stays terminal under failure poll/cancel; owner void remains explicit exception',async()=>{
  const id=await ticket();const p=(await bolt(id)).body;await webhook(p,'PAID');
  assert.equal((await h.request(`/api/tickets/${id}/bolt-intent/${p.payment_id}?simulate=fail`)).body.status,'success');
  assert.equal((await h.request(`/api/tickets/${id}/bolt-intent/${p.payment_id}/cancel`,{})).status,409);
  assert.equal((await row(p.payment_id)).status,'success');
  assert.equal((await h.request(`/api/tickets/${id}/payments/${p.payment_id}/void`,{})).status,200);
  await webhook(p,'PAID');assert.equal((await row(p.payment_id)).status,'voided');
});
test('pending/failed cancel to voided; late success only revives failed',async()=>{
  for(const failed of [false,true]) {
    const id=await ticket();const p=(await bolt(id)).body;
    if(failed) await webhook(p,'EXPIRED');
    assert.equal((await h.request(`/api/tickets/${id}/bolt-intent/${p.payment_id}/cancel`,{})).status,200);
    await webhook(p,'PAID');assert.equal((await row(p.payment_id)).status,'voided');
  }
  const id=await ticket();const p=(await bolt(id)).body;
  await webhook(p,'EXPIRED');assert.equal((await row(p.payment_id)).status,'failed');
  await webhook(p,'PAID');assert.equal((await row(p.payment_id)).status,'success');
});

test('pending card blocks cash/new intent until cancel; concurrent intents serialize',async()=>{
  const id=await ticket();
  const responses=await Promise.all([bolt(id),bolt(id)]);
  assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);
  assert.equal(responses.find(r=>r.status===409).body.error,'pending_card_payment');
  const p=responses.find(r=>r.status===200).body;
  const cash=await payment(id);assert.equal(cash.status,409);assert.equal(cash.body.error,'pending_card_payment');
  assert.equal((await h.request(`/api/tickets/${id}`)).body.paid,0);
  assert.equal((await h.request(`/api/tickets/${id}/bolt-intent/${p.payment_id}/cancel`,{})).status,200);
  assert.equal((await payment(id)).status,200);
  assert.equal((await h.request(`/api/tickets/${id}`)).body.paid,100);
});
