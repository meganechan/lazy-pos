// Beam Bolt "Deep Link" payment adapter (Bolt Intents API).
//
// PoC integration with Beam's Bolt deep-link flow. The POS creates a Bolt
// Intent (server-side), shows the returned deep link to the customer, then
// polls the intent for the terminal result. Mock now (no network) when
// credentials are absent — swap to real sandbox/prod by setting env vars
// WITHOUT changing core endpoint logic.
//
// Verified spec (docs.beamcheckout.com):
//   - Sandbox base: https://playground.api.beamcheckout.com
//   - Prod base:    https://api.beamcheckout.com
//   - Auth:         Authorization: Basic base64(merchantId + ':' + apiKey)
//   - Idempotency:  x-beam-idempotency-key (UUID; 12h window)
//   - CREATE: POST {base}/api/v1/bolt-intents
//   - POLL:   GET  {base}/api/v1/bolt-intents/{boltIntentId}
//
// result enum: ''/absent = pending; CH_SUCCEEDED = paid;
//   failures = CH_PROCESSING_FAILED | CH_INSUFFICIENT_FUNDS
//            | CH_AUTHENTICATION_FAILED | BI_EXPIRED | BI_CANCELED

const SANDBOX_BASE = 'https://playground.api.beamcheckout.com';

// Normalize the deep-link field: the API may return it as a string or an
// object — handle both, falling back to a JSON string if shape is unknown.
function normalizeDeepLink(deepLink) {
  if (deepLink == null) return null;
  if (typeof deepLink === 'string') return deepLink;
  if (typeof deepLink === 'object') {
    return deepLink.url || deepLink.deepLink || JSON.stringify(deepLink);
  }
  return String(deepLink);
}

export function createBeamBoltAdapter(env = {}) {
  const base = env.BEAM_BOLT_API_BASE || SANDBOX_BASE;
  const merchantId = env.BEAM_BOLT_MERCHANT_ID;
  const apiKey = env.BEAM_BOLT_API_KEY;
  const mock = !merchantId || !apiKey;

  if (mock) {
    console.log('[beamBolt] MOCK mode');
  }

  const authHeader = mock
    ? null
    : 'Basic ' + Buffer.from(merchantId + ':' + apiKey).toString('base64');

  return {
    mock,

    // createBoltIntent({ amountBaht, referenceId, redirectUrl, idempotencyKey })
    //   -> Promise<{ boltIntentId, deepLink, mock? }>
    async createBoltIntent({ amountBaht, referenceId, redirectUrl, idempotencyKey } = {}) {
      if (mock) {
        return {
          boltIntentId: 'mock_bolt_' + String(idempotencyKey).slice(0, 8),
          deepLink:
            redirectUrl + (redirectUrl.includes('?') ? '&' : '?') + 'boltMock=1',
          mock: true,
        };
      }

      const body = {
        mode: { type: 'DEEP_LINK', deepLink: { redirectUrl } },
        amount: { currency: 'THB', value: Math.round(amountBaht * 100) },
        referenceId,
        merchantId,
      };

      const resp = await fetch(base + '/api/v1/bolt-intents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader,
          'x-beam-idempotency-key': idempotencyKey,
        },
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        throw new Error(
          `[beamBolt] createBoltIntent failed: ${resp.status} ${resp.statusText} ${text}`,
        );
      }

      const data = await resp.json();
      return {
        boltIntentId: data.boltIntentId,
        deepLink: normalizeDeepLink(data.deepLink),
      };
    },

    // getBoltIntent(boltIntentId, { simulate? })
    //   -> Promise<{ result, raw? , mock? }>
    async getBoltIntent(boltIntentId, { simulate } = {}) {
      if (mock) {
        let result = '';
        if (simulate === 'success') result = 'CH_SUCCEEDED';
        else if (simulate === 'fail') result = 'CH_PROCESSING_FAILED';
        return { result, mock: true };
      }

      const resp = await fetch(
        base + '/api/v1/bolt-intents/' + encodeURIComponent(boltIntentId),
        {
          method: 'GET',
          headers: { Authorization: authHeader },
        },
      );

      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        throw new Error(
          `[beamBolt] getBoltIntent failed: ${resp.status} ${resp.statusText} ${text}`,
        );
      }

      const raw = await resp.json();
      return { result: raw.result || '', raw };
    },
  };
}
