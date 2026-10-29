import { test } from 'node:test';
import assert from 'node:assert/strict';
import { outstandingAmount, cashChange, queueStateLabel } from '../client/src/checkout.js';
import { createLineAdapter } from './adapters/line.js';
test('cash charges remaining cents and change uses received minus outstanding',()=>{
  assert.equal(outstandingAmount(1.15,.10),1.05);
  assert.equal(outstandingAmount(900,200),700);
  assert.equal(outstandingAmount(100,120),0);
  assert.equal(cashChange('1000',700),300);
  assert.equal(cashChange('2',1.05),.95);
  for(const input of ['', '699.99','NaN','Infinity','-1','700.001']) assert.equal(cashChange(input,700),null);
});
test('queue overrun is still busy, and the UI labels it honestly',()=>{
  assert.equal(queueStateLabel({status:'busy',overrun:true}),'เกินเวลา');
  assert.equal(queueStateLabel({status:'busy',overrun:false}),'กำลังทำ');
  assert.equal(queueStateLabel({status:'available'}),'ว่าง');
});
test('the stub LINE adapter never claims actual delivery, even with credentials',async()=>{
  const adapter=createLineAdapter({LINE_CHANNEL_ACCESS_TOKEN:'local-placeholder',LINE_CHANNEL_SECRET:'local-placeholder'});
  assert.equal(adapter.mock,true);
  const sent=await adapter.pushQuote({lineUserId:'local-only'});
  assert.equal(sent.mock,true);assert.equal(sent.sent,false);
});
