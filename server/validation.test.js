import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validAmount, validDate } from './validation.js';
test('amounts are finite positive numbers with at most two decimal places', () => {
  for(const n of [NaN,Infinity,-Infinity,-10,0,'10','NaN',null,undefined,true,1.001,0.001]) assert.equal(validAmount(n),false,String(n));
  for(const n of [0.01,0.29,1.1,10,123.45]) assert.equal(validAmount(n),true,String(n));
});
test('dates must exist in the calendar', () => {
  for(const d of ['2026-99-99','2026-02-30','2025-02-29','0000-01-01','2026-1-1','',null, ['2026-01-01']]) assert.equal(validDate(d),false);
  for(const d of ['2024-02-29','2026-01-01','2026-12-31']) assert.equal(validDate(d),true);
});
