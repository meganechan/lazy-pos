import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from './harness.mjs';
let h, staff;
before(async()=>{h=await startServer();staff=(await h.db.query("SELECT id FROM app_user WHERE role='staff' LIMIT 1")).rows[0].id;await h.request('/api/attendance/check-in',{user_id:staff});});
after(async()=>{await h?.close();});
async function ticket(member) {
  const t=(await h.request('/api/tickets',{assigned_user_id:staff,...(member?{member_id:member}:{})})).body;
  await h.request(`/api/tickets/${t.id}/custom-item`,{name:'work fixture',quoted_price:100,minutes:30});return t.id;
}
test('adding an item leaves ticket open until explicit start',async()=>{
  const id=await ticket();assert.equal((await h.request(`/api/tickets/${id}`)).body.status,'open');
});
test('overdue work stays busy; extending changes ETA; finishing releases technician',async()=>{
  const id=await ticket();await h.request(`/api/tickets/${id}/start`,{});
  await h.db.query("UPDATE ticket SET started_at=now()-interval '35 minutes' WHERE id=$1",[id]);
  let tech=(await h.request('/api/queue')).body.technicians.find(t=>t.id===staff);
  assert.equal(tech.status,'busy');assert.equal(tech.overrun,true);assert.equal(tech.current_ticket_id,id);
  const before=(await h.request(`/api/tickets/${id}`)).body;
  assert.equal((await h.request(`/api/tickets/${id}/extend`,{})).body.est_minutes,before.est_minutes+10);
  tech=(await h.request('/api/queue')).body.technicians.find(t=>t.id===staff);
  assert.equal(tech.status,'busy');assert.equal(tech.overrun,false);
  assert.equal((await h.request(`/api/tickets/${id}/finish`,{})).body.status,'done');
  assert.equal((await h.request('/api/queue')).body.technicians.find(t=>t.id===staff).status,'available');
  assert.equal((await h.request(`/api/tickets/${id}/extend`,{})).status,409);
});
test('full payment releases active work; finish cannot reopen a paid ticket',async()=>{
  const id=await ticket();await h.request(`/api/tickets/${id}/start`,{});
  assert.equal((await h.request(`/api/tickets/${id}/payments`,{method:'cash',amount:100})).body.status,'closed');
  assert.equal((await h.request('/api/queue')).body.technicians.find(t=>t.id===staff).status,'available');
  assert.equal((await h.request(`/api/tickets/${id}/finish`,{})).status,409);
});
test('LINE send requires recipient and reports demo mode for saved quotes',async()=>{
  const id=await ticket();assert.equal((await h.request(`/api/tickets/${id}/quote/send`,{})).status,400);
  const member=(await h.request('/api/members',{name:'local recipient',line_user_id:'U_LOCAL_ONLY'})).body.id;
  const withMember=await ticket(member);const d=await h.request(`/api/tickets/${withMember}/quote/send`,{});
  assert.equal(d.status,200);assert.equal(d.body.line_mock,true);
  assert.equal((await h.request(`/api/tickets/${withMember}`)).body.line_mock,true);
});
test('finish/extend remain store-scoped',async()=>{
  const store=(await h.db.query("INSERT INTO store(name) VALUES ('foreign') RETURNING id")).rows[0].id;
  const id=(await h.db.query("INSERT INTO ticket(store_id,status) VALUES ($1,'in_progress') RETURNING id",[store])).rows[0].id;
  for(const action of ['finish','extend']) assert.equal((await h.request(`/api/tickets/${id}/${action}`,{})).status,404);
});
