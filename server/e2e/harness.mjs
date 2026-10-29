// E2E_PG_URL points to a LOCAL disposable PostgreSQL admin connection.
// Every invocation creates and drops its own database, including on assertion failure.
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import net from 'node:net';
import assert from 'node:assert/strict';
export async function startServer({ env = {} } = {}) {
  assert.ok(process.env.E2E_PG_URL, 'set E2E_PG_URL to a disposable local PostgreSQL');
  const admin = new pg.Pool({ connectionString: process.env.E2E_PG_URL });
  const name = 'e2e_' + randomUUID().replaceAll('-','');
  await admin.query(`CREATE DATABASE "${name}"`);
  const url = new URL(process.env.E2E_PG_URL); url.pathname = '/' + name;
  const db = new pg.Pool({ connectionString: url.href });
  const socket = net.createServer().listen(0,'127.0.0.1'); await once(socket,'listening');
  const port = socket.address().port; await new Promise(r=>socket.close(r));
  const server = spawn(process.execPath,['index.js'], {
    cwd: process.env.E2E_SERVER_DIR || new URL('..',import.meta.url),
    env: { PATH: process.env.PATH, DATABASE_URL: url.href, PORT:String(port), BEAM_WEBHOOK_SECRET:Buffer.from('local-test-secret').toString('base64'), ...env },
    stdio: ['ignore','pipe','pipe'],
  });
  let log='';server.stdout.on('data',d=>log+=d);server.stderr.on('data',d=>log+=d);
  const base=`http://127.0.0.1:${port}`;
  const close=async()=>{
    if(server.exitCode===null && server.signalCode===null){server.kill();await once(server,'exit');}
    await db.end(); await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`); await admin.end();
  };
  try {
    let ready=false;
    for(let i=0;i<150;i++) {
      try {if((await fetch(base+'/api/health')).ok){ready=true;break;}}catch{}
      if(server.exitCode!==null) break;
      await new Promise(r=>setTimeout(r,100));
    }
    assert.ok(ready,log);
    const owner=(await db.query("SELECT id FROM app_user WHERE role='owner' ORDER BY id LIMIT 1")).rows[0];
    const login=await fetch(base+'/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({userId:owner.id,pin:'1234'})});
    const {token}=await login.json(); assert.ok(token);
    const request=async(path,body,method=body===undefined?'GET':'POST',headers={})=>{
      const r=await fetch(base+path,{method,signal:AbortSignal.timeout(10000),headers:{'content-type':'application/json',authorization:`Bearer ${token}`,...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
      return {status:r.status, body:await r.json()};
    };
    return {db,request,close,base,token,log:()=>log};
  } catch(e) {await close();throw e;}
}
