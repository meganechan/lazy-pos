import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHmac } from 'node:crypto';
import http from 'node:http';
import { once } from 'node:events';
import { createBeamBoltAdapter } from './adapters/beamBolt.js';
const root = new URL('../', import.meta.url);
const read = name => readFileSync(new URL(name, root), 'utf8');

test('both container stages run the supported Node 22 Alpine runtime', () => {
  const stages = [...read('Dockerfile').matchAll(/^FROM (\S+)/gm)].map(m => m[1]);
  assert.deepEqual(stages, ['node:22-alpine','node:22-alpine']);
});

test('compose forwards Bolt credentials, API base and webhook secret used by the adapter', async () => {
  let requested;
  const fake = http.createServer((req,res) => { requested = req; res.setHeader('content-type','application/json');res.end(JSON.stringify({id:'local',result:'CH_SUCCEEDED'})); });
  fake.listen(0,'127.0.0.1'); await once(fake,'listening');
  try {
    const supplied = { BEAM_BOLT_API_BASE:`http://127.0.0.1:${fake.address().port}`, BEAM_BOLT_MERCHANT_ID:'local-merchant', BEAM_BOLT_API_KEY:'local-key', BEAM_WEBHOOK_SECRET:Buffer.from('local-secret').toString('base64') };
    const compose = read('docker-compose.yml'), example = read('.env.example');
    const env = {};
    for(const [key,value] of Object.entries(supplied)) {
      assert.ok(example.includes(`\n${key}=`), `${key} documented`);
      assert.ok(compose.includes(`${key}: \${${key}:-`), `${key} forwarded from environment`);
      env[key]=value;
    }
    assert.ok(!/\bBEAM_API_KEY\b/.test(compose+example),'no obsolete credential name');
    const adapter=createBeamBoltAdapter(env);
    assert.equal(adapter.mock,false,'credentials activate Bolt rather than silent mock');
    assert.equal((await adapter.getBoltIntent('local')).result,'CH_SUCCEEDED');
    assert.equal(requested.url,'/api/v1/bolt-intents/local');
    assert.equal(requested.headers.authorization,'Basic '+Buffer.from('local-merchant:local-key').toString('base64'));
    const body=Buffer.from('{"id":"local"}');
    const signature=createHmac('sha256',Buffer.from(env.BEAM_WEBHOOK_SECRET,'base64')).update(body).digest('base64');
    assert.deepEqual(adapter.verifyWebhookSignature(body,signature),{verified:true});
    assert.deepEqual(adapter.verifyWebhookSignature(body,'bad'),{verified:false});
  } finally { await new Promise(r=>fake.close(r)); }
});
