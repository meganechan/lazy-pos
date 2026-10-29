import { test } from 'node:test';
import assert from 'node:assert/strict';
import { businessDay, reportRange } from './business-time.js';
import { baht } from '../client/src/api.js';
test('Bangkok dates/presets are independent of browser timezone',()=>{
  const at=new Date('2026-10-28T23:30:00Z');
  assert.equal(businessDay(at),'2026-10-29');
  assert.deepEqual(reportRange('today',at),{from:'2026-10-29',to:'2026-10-29'});
  assert.deepEqual(reportRange('week',at),{from:'2026-10-26',to:'2026-10-29'});
  assert.deepEqual(reportRange('month',at),{from:'2026-10-01',to:'2026-10-29'});
});
test('money display rounds averages to at most two decimals',()=>{
  assert.equal(baht(1195/3),'฿398.33');assert.equal(baht(350),'฿350');
  assert.equal(1195/3,398.3333333333333,'formatting did not change arithmetic');
});
