// Run only against a disposable database; server/providers use an isolated env.
// E2E_DATABASE_URL=... node server/e2e/robustness.mjs
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import net from 'node:net';
import assert from 'node:assert/strict';
import pg from 'pg';
import { api } from '../../client/src/api.js';
const dbURL = process.env.E2E_DATABASE_URL;
assert.ok(dbURL, 'E2E_DATABASE_URL must point to throwaway PostgreSQL');
const socket = net.createServer().listen(0, '127.0.0.1');
await once(socket, 'listening'); const port = socket.address().port; await new Promise(r => socket.close(r));
const srv = spawn(process.execPath, ['index.js'], { cwd: process.env.E2E_SERVER_DIR || new URL('..', import.meta.url), env: { PATH: process.env.PATH, PORT: String(port), DATABASE_URL: dbURL }, stdio: ['ignore','pipe','pipe'] });
let logs = ''; srv.stdout.on('data', d => logs += d); srv.stderr.on('data', d => logs += d);
const db = new pg.Pool({connectionString: dbURL});
const q = (s,p) => db.query(s,p); let failures = 0;
const check = async (name, fn) => { try { await fn(); console.log('PASS',name); } catch(e) { failures++; console.error('FAIL',name,e.message); } };
const call = (path, token, body, method = 'POST') => fetch(`http://127.0.0.1:${port}/api${path}`, { method, signal: AbortSignal.timeout(5000), headers: {'content-type':'application/json', authorization:`Bearer ${token}`}, ...(body === undefined ? {} : {body:JSON.stringify(body)}) });
try {
  for(let i=0;i<100;i++){try{if((await call('/health','',undefined,'GET')).ok)break;}catch{} await new Promise(r=>setTimeout(r,100));}
  const owner=(await q("SELECT id FROM app_user WHERE role='owner' LIMIT 1")).rows[0];
  const token=(await(await call('/auth/login','',{userId:owner.id,pin:'1234'})).json()).token;
  const scenario=process.argv[2] || 'all';
  if (scenario==='partial' || scenario==='all') {
    await check('real client sends partial decimal balance as 1.05 and server persists 1.05', async () => {
      const ticket = await (await call('/tickets',token,{})).json();
      await call(`/tickets/${ticket.id}/custom-item`,token,{name:'decimal service',quoted_price:1.15});
      const partial = await (await call(`/tickets/${ticket.id}/payments`,token,{method:'cash',amount:0.10})).json();
      assert.equal(Number(partial.total),1.15);
      assert.equal(Number(partial.paid),0.10);
      const outstanding = Math.max(0, Number(partial.total) - Number(partial.paid)) || Number(partial.total);
      const originalFetch = globalThis.fetch;
      let sent;
      // Browser-relative URLs and its bearer token, with real client serialization.
      globalThis.fetch = (url, options) => {
        sent = JSON.parse(options.body);
        return originalFetch(new URL(url, `http://127.0.0.1:${port}`), {
          ...options, headers: {...options.headers, Authorization:`Bearer ${token}`},
        });
      };
      try {
        const intent = await api.createBoltIntent(ticket.id,{amount:outstanding});
        assert.equal(sent.amount,1.05);
        const payment = (await q('SELECT amount FROM payment WHERE id=$1',[intent.payment_id])).rows[0];
        assert.equal(Number(payment.amount),1.05);
      } finally { globalThis.fetch = originalFetch; }
    });
  }
  if (scenario==='amount' || scenario==='all') {
    const t=await(await call('/tickets',token,{})).json();
    for(const path of ['payments','bolt-intent']) {
      for(const amount of [-10,0,'NaN','10',null,true,1.001,0.001,1.0000001]) {
        await check(`${path} rejects ${JSON.stringify(amount)}`,async()=>{
          const before=(await q('SELECT count(*) FROM payment')).rows;
          assert.equal((await call(`/tickets/${t.id}/${path}`,token,{method:'cash',amount})).status,400);
          assert.deepEqual((await q('SELECT count(*) FROM payment')).rows,before);
        });
      }
      await check(`${path} rejects nonfinite JSON number`,async()=>{
        const r=await fetch(`http://127.0.0.1:${port}/api/tickets/${t.id}/${path}`,{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${token}`},body:'{"method":"cash","amount":1e999}'});
        assert.equal(r.status,400);
      });
      for(const amount of [0.29,10,10.01]) await check(`${path} accepts ${amount}`,async()=>assert.equal((await call(`/tickets/${t.id}/${path}`,token,{method:'cash',amount})).status,200));
    }
  }
  if(scenario==='date' || scenario==='all') {
    for(const path of ['tickets','reports']) {
      for(const date of ['2026-99-99','2026-02-30','2025-02-29','0000-01-01','bad','']) {
        for(const field of ['from','to']) await check(`${path} rejects ${field}=${date}`,async()=>assert.equal((await call(`/${path}?${field}=${date}`,token,undefined,'GET')).status,400));
      }
      await check(`${path} accepts leap day`,async()=>assert.equal((await call(`/${path}?from=2024-02-29&to=2024-03-01`,token,undefined,'GET')).status,200));
    }
  }
  if(scenario==='crash' || scenario==='all') {
    await check('arbitrary async DB rejection gives logged 500 and process survives',async()=>{
      // Fault injection only in this disposable DB, not a special test route.
      await q('ALTER TABLE member RENAME TO member_fault_injection');
      try {
        const r=await call('/members',token,undefined,'GET');
        assert.equal(r.status,500); assert.deepEqual(await r.json(),{error:'internal server error'});
        assert.match(logs,/request failed/);
        assert.equal((await call('/health','',undefined,'GET')).status,200);
      } finally { await q('ALTER TABLE member_fault_injection RENAME TO member'); }
      assert.equal((await call('/members',token,undefined,'GET')).status,200);
    });
  }
} finally { if(srv.exitCode===null) {srv.kill(); await once(srv,'exit');} await db.end(); if(failures) { console.error(logs); process.exitCode=1; } }
