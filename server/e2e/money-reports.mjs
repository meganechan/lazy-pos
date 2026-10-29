import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from './harness.mjs';
let h;
before(async()=>{h=await startServer();});after(async()=>{await h?.close();});
async function ticket(price) {
  const id=(await h.request('/api/tickets',{})).body.id;
  await h.request(`/api/tickets/${id}/custom-item`,{name:'receivable',quoted_price:price});return id;
}
const pay=(id,amount,method)=>h.request(`/api/tickets/${id}/payments`,{amount,method});
test('unpaid placeholder followed by cash is not outstanding',async()=>{
  const id=await ticket(350);await pay(id,350,'unpaid');await pay(id,350,'cash');
  assert.deepEqual((await h.request('/api/reports')).body.outstanding,{amount:0,count:0});
});
test('receivables include unmarked/partial discounted bills and exclude voids',async()=>{
  const id=await ticket(100);await h.request(`/api/tickets/${id}/discount`,{discount_type:'percent',discount_value:10},'PUT');
  await pay(id,30,'cash');
  const voided=await ticket(900);await h.request(`/api/tickets/${voided}`,undefined,'DELETE');
  assert.deepEqual((await h.request('/api/reports')).body.outstanding,{amount:60,count:1});
});
test('06:30 Bangkok payment and ticket are in the Thai business day, daily trend too',async()=>{
  const id=await ticket(123);await pay(id,123,'cash');
  const time='2026-01-14T23:30:00Z'; // 15 January 06:30 Bangkok
  await h.db.query('UPDATE ticket SET created_at=$2 WHERE id=$1',[id,time]);
  await h.db.query('UPDATE payment SET created_at=$2 WHERE ticket_id=$1',[id,time]);
  const report=(await h.request('/api/reports?from=2026-01-15&to=2026-01-15')).body;
  assert.equal(report.totals.revenue,123);assert.deepEqual(report.daily,[{day:'2026-01-15',amount:123}]);
  assert.ok((await h.request('/api/tickets?status=all&from=2026-01-15&to=2026-01-15')).body.some(t=>t.id===id));
  assert.equal((await h.request('/api/reports?from=2026-01-14&to=2026-01-14')).body.totals.revenue,0);
});
test('attendance writes use the Bangkok database session day',async()=>{
  await h.db.query(`CREATE TABLE attendance_zone(zone text, day date);
    CREATE FUNCTION record_attendance_zone() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      INSERT INTO attendance_zone VALUES(current_setting('TimeZone'),NEW.day); RETURN NEW; END $$;
    CREATE TRIGGER record_zone AFTER INSERT ON attendance FOR EACH ROW EXECUTE FUNCTION record_attendance_zone()`);
  const staff=(await h.db.query("SELECT id FROM app_user WHERE role='staff' LIMIT 1")).rows[0];
  assert.equal((await h.request('/api/attendance/check-in',{user_id:staff.id})).status,200);
  const rows=(await h.db.query('SELECT zone, day::text FROM attendance_zone')).rows;
  assert.equal(rows[0].zone,'Asia/Bangkok');
  assert.equal(rows[0].day,new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()));
});
test('signup catalog failure rolls back store, owner and earlier catalog rows',async()=>{
  const before=(await h.db.query('SELECT (SELECT count(*) FROM store) stores,(SELECT count(*) FROM app_user) users,(SELECT count(*) FROM service) services')).rows;
  await h.db.query(`CREATE FUNCTION fail_signup_catalog() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
    IF NEW.store_id>1 AND EXISTS(SELECT 1 FROM service WHERE store_id=NEW.store_id) THEN
      RAISE EXCEPTION 'injected catalog failure'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER fail_signup BEFORE INSERT ON service FOR EACH ROW EXECUTE FUNCTION fail_signup_catalog()`);
  try {
    assert.equal((await h.request('/api/auth/signup',{shop_name:'rollback fixture',owner_name:'owner',owner_pin:'1234'})).status,500);
    assert.deepEqual((await h.db.query('SELECT (SELECT count(*) FROM store) stores,(SELECT count(*) FROM app_user) users,(SELECT count(*) FROM service) services')).rows,before);
  } finally {await h.db.query('DROP TRIGGER fail_signup ON service');}
  const success=await h.request('/api/auth/signup',{shop_name:'complete fixture',owner_name:'owner',owner_pin:'1234'});
  assert.equal(success.status,200);
  assert.ok((await h.db.query('SELECT 1 FROM service WHERE store_id=$1',[success.body.store.id])).rowCount>1);
});
