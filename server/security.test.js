// DB-free checks for the auth + webhook guards. Run: cd server && npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  hashPin, verifyPin,
  loginBlocked, recordLoginFail, clearLoginFails,
  LOGIN_MAX_FAILS, LOGIN_WINDOW_MS,
} from './auth.js';
import { createBeamBoltAdapter } from './adapters/beamBolt.js';

test('PIN hash round-trip', () => {
  const h = hashPin('1234');
  assert.equal(verifyPin('1234', h), true);
  assert.equal(verifyPin('1235', h), false);
  assert.equal(verifyPin('1234', 'garbage'), false);
});

test('login throttle blocks after max fails, resets after window or success', () => {
  const t0 = 1_000_000;
  for (let i = 0; i < LOGIN_MAX_FAILS; i++) {
    assert.equal(loginBlocked('u1', t0), false);
    recordLoginFail('u1', t0);
  }
  assert.equal(loginBlocked('u1', t0), true);
  assert.equal(loginBlocked('u2', t0), false, 'other users unaffected');
  assert.equal(loginBlocked('u1', t0 + LOGIN_WINDOW_MS), false, 'window rolls over');

  recordLoginFail('u3', t0);
  clearLoginFails('u3');
  assert.equal(loginBlocked('u3', t0), false);
});

const secret = Buffer.from('test-secret').toString('base64');
const body = Buffer.from('{"id":"ch_1","status":"PAID"}');
const sign = (b) => crypto.createHmac('sha256', Buffer.from(secret, 'base64')).update(b).digest('base64');
const real = { BEAM_BOLT_MERCHANT_ID: 'm', BEAM_BOLT_API_KEY: 'k' };

test('webhook: mock mode without secret is skipped (PoC)', () => {
  assert.deepEqual(createBeamBoltAdapter({}).verifyWebhookSignature(body, 'x'),
    { verified: false, skipped: true });
});

test('webhook: real creds without secret fails closed', () => {
  assert.deepEqual(createBeamBoltAdapter(real).verifyWebhookSignature(body, 'x'),
    { verified: false });
});

test('webhook: valid signature passes, tampered body / missing header fail', () => {
  const a = createBeamBoltAdapter({ ...real, BEAM_WEBHOOK_SECRET: secret });
  assert.deepEqual(a.verifyWebhookSignature(body, sign(body)), { verified: true });
  assert.deepEqual(a.verifyWebhookSignature(Buffer.from('{"status":"PAID"}'), sign(body)), { verified: false });
  assert.deepEqual(a.verifyWebhookSignature(body, undefined), { verified: false });
});
