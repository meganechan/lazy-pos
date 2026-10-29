import { test } from 'node:test';
import assert from 'node:assert/strict';
import { api } from '../client/src/api.js';

test('client serializes computed decimal payments as whole cents', async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url, body: JSON.parse(options.body) });
    return { ok: true, json: async () => ({}) };
  };
  try {
    const outstanding = 1.15 - 0.10;
    assert.notEqual(outstanding, 1.05, 'fixture exercises floating subtraction');
    await api.createBoltIntent(42, { amount: outstanding, mode: 'DEEP_LINK' });
    await api.pay(42, { amount: outstanding, method: 'cash' });
    assert.deepEqual(requests, [
      { url: '/api/tickets/42/bolt-intent', body: { amount: 1.05, mode: 'DEEP_LINK' } },
      { url: '/api/tickets/42/payments', body: { amount: 1.05, method: 'cash' } },
    ]);
  } finally { globalThis.fetch = originalFetch; }
});
