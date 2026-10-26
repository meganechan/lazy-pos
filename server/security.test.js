// DB-free checks for the auth + webhook guards. Run: cd server && npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  hashPin, verifyPin,
  canonicalUserId, takeLoginAttempt, clearLoginAttempts, loginAttemptsSize,
  LOGIN_MAX_ATTEMPTS, LOGIN_WINDOW_MS,
} from './auth.js';
import { createBeamBoltAdapter } from './adapters/beamBolt.js';

test('PIN hash round-trip', () => {
  const h = hashPin('1234');
  assert.equal(verifyPin('1234', h), true);
  assert.equal(verifyPin('1235', h), false);
  assert.equal(verifyPin('1234', 'garbage'), false);
});

test('userId aliases collapse to one canonical id', () => {
  for (const raw of [1, '1', '01', '001', '+1', ' 1', '1 ']) assert.equal(canonicalUserId(raw), 1);
  for (const raw of [null, undefined, '', '0', '-1', '1.5', 'abc', true, {}]) assert.equal(canonicalUserId(raw), null);
});

test('login throttle: reserved attempts cap concurrent bursts; window + clear reset', () => {
  const t0 = 1_000_000;
  // 12 "concurrent" logins = 12 synchronous reservations before any await.
  const admitted = Array.from({ length: 12 }, () => takeLoginAttempt(101, t0)).filter(Boolean);
  assert.equal(admitted.length, LOGIN_MAX_ATTEMPTS);
  assert.equal(takeLoginAttempt(102, t0), true, 'other users unaffected');
  assert.equal(takeLoginAttempt(101, t0 + LOGIN_WINDOW_MS), true, 'window rolls over');

  takeLoginAttempt(103, t0);
  clearLoginAttempts(103);
  for (let i = 0; i < LOGIN_MAX_ATTEMPTS; i++) assert.equal(takeLoginAttempt(103, t0), true);
});

test('login throttle: expired entries are swept, map stays bounded', () => {
  const t0 = 5_000_000;
  for (let i = 0; i < 1500; i++) takeLoginAttempt(10_000 + i, t0);
  takeLoginAttempt(99_999, t0 + LOGIN_WINDOW_MS);
  assert.ok(loginAttemptsSize() < 10, `size ${loginAttemptsSize()}`);
});

const secret = Buffer.from('test-secret').toString('base64');
const body = Buffer.from('{"id":"ch_1","status":"PAID"}');
const sign = (b, s = secret) => crypto.createHmac('sha256', Buffer.from(s, 'base64')).update(b).digest('base64');
const real = { BEAM_BOLT_MERCHANT_ID: 'm', BEAM_BOLT_API_KEY: 'k' };

test('webhook: no creds and no secret is skipped (PoC)', () => {
  assert.deepEqual(createBeamBoltAdapter({}).verifyWebhookSignature(body, 'x'),
    { verified: false, skipped: true });
});

test('webhook: any Bolt cred without secret fails closed', () => {
  for (const env of [real, { BEAM_BOLT_MERCHANT_ID: 'm' }, { BEAM_BOLT_API_KEY: 'k' }]) {
    assert.deepEqual(createBeamBoltAdapter(env).verifyWebhookSignature(body, 'x'), { verified: false });
  }
});

test('webhook: valid signature passes; tampered / missing header / missing body / bad secret fail', () => {
  const a = createBeamBoltAdapter({ ...real, BEAM_WEBHOOK_SECRET: secret });
  assert.deepEqual(a.verifyWebhookSignature(body, sign(body)), { verified: true });
  assert.deepEqual(a.verifyWebhookSignature(Buffer.from('{"status":"PAID"}'), sign(body)), { verified: false });
  assert.deepEqual(a.verifyWebhookSignature(body, undefined), { verified: false });
  assert.deepEqual(a.verifyWebhookSignature(undefined, sign(body)), { verified: false });

  const bad = createBeamBoltAdapter({ ...real, BEAM_WEBHOOK_SECRET: '!!!' });
  assert.deepEqual(bad.verifyWebhookSignature(body, sign(body, '')), { verified: false });
});
