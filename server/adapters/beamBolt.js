// Beam Bolt payment adapter (Bolt Connections + Bolt Intents API).
//
// PoC integration with Beam's Bolt flow, supporting two intent modes:
//
//   PAIRING   — physical EDC terminal. The store pairs a device once (pairDevice)
//               and stores boltConnectionId + deviceId. Subsequent intents are
//               routed to that paired terminal (CARD).
//   DEEP_LINK — mobile QR / PromptPay. Returns a deep link the customer follows
//               on their phone; the POS polls or waits for a webhook.
//
// Mock now (no network) when credentials are absent — swap to real
// sandbox/prod by setting env vars WITHOUT changing core endpoint logic.
//
// Verified spec (LIVE-VERIFIED on Beam production):
//   - Sandbox base: https://playground.api.beamcheckout.com
//   - Prod base:    https://api.beamcheckout.com
//   - Auth:         Authorization: Basic base64(merchantId + ':' + apiKey)
//   - Idempotency:  x-beam-idempotency-key (UUID; 12h window) [SACRED — unchanged]
//   - PAIR:   POST {base}/api/v1/bolt-connections
//   - CREATE: POST {base}/api/v1/bolt-intents
//   - POLL:   GET  {base}/api/v1/bolt-intents/{boltIntentId}
//   - amount is a FLAT integer at top level (satang), NOT amount.value.
//
// result enum: ''/absent = pending; CH_SUCCEEDED = paid;
//   failures = CH_PROCESSING_FAILED | CH_INSUFFICIENT_FUNDS
//            | CH_AUTHENTICATION_FAILED | BI_EXPIRED | BI_CANCELED

import crypto from 'node:crypto';

const SANDBOX_BASE = 'https://playground.api.beamcheckout.com';

export function createBeamBoltAdapter(env = {}) {
  const base = env.BEAM_BOLT_API_BASE || SANDBOX_BASE;
  const merchantId = env.BEAM_BOLT_MERCHANT_ID;
  const apiKey = env.BEAM_BOLT_API_KEY;
  const webhookSecret = env.BEAM_WEBHOOK_SECRET;
  const mock = !merchantId || !apiKey;

  if (mock) {
    console.log('[beamBolt] MOCK mode');
  }

  const authHeader = mock
    ? null
    : 'Basic ' + Buffer.from(merchantId + ':' + apiKey).toString('base64');

  return {
    mock,

    // pairDevice({ pairingCode })
    //   -> Promise<{ boltConnectionId, deviceId, mock? }>
    // Pairs a physical EDC terminal with this merchant using the pairing code
    // shown on the device. The returned connection id is stored per-store and
    // reused as boltConnectionId on every PAIRING intent.
    async pairDevice({ pairingCode } = {}) {
      if (mock) {
        return { boltConnectionId: 'boltc_mock', deviceId: 'dev_mock', mock: true };
      }

      const resp = await fetch(base + '/api/v1/bolt-connections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader,
        },
        body: JSON.stringify({ pairingCode }),
      });

      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        throw new Error(
          `[beamBolt] pairDevice failed: ${resp.status} ${resp.statusText} ${text}`,
        );
      }

      const resp_ = await resp.json();
      return { boltConnectionId: resp_.id, deviceId: resp_.deviceId };
    },

    // createBoltIntent({ mode, amountBaht, referenceId, boltConnectionId, returnUrl, idempotencyKey })
    //   -> Promise<{ boltIntentId, deepLinkUrl?, mode, mock? }>
    //
    // mode === 'PAIRING'   -> route to a paired physical EDC (CARD).
    // mode === 'DEEP_LINK' -> QR PromptPay deep link for the customer's phone.
    //
    // amount is a FLAT integer (satang) at the top level. The idempotencyKey is
    // passed through verbatim as the x-beam-idempotency-key header [SACRED].
    async createBoltIntent({
      mode,
      amountBaht,
      referenceId,
      boltConnectionId,
      returnUrl,
      idempotencyKey,
      paymentMethodType, // PAIRING: 'CARD' (default) | 'QR_PROMPT_PAY' — both run on the paired EDC device
    } = {}) {
      const amount = Math.round(amountBaht * 100);
      // On a paired EDC device the customer can pay by card OR by a QR shown on the
      // device screen — same boltConnectionId, only the paymentMethod differs.
      const pmType = paymentMethodType === 'QR_PROMPT_PAY' ? 'QR_PROMPT_PAY' : 'CARD';
      const pairedPaymentMethod = pmType === 'QR_PROMPT_PAY'
        ? { paymentMethodType: 'QR_PROMPT_PAY', qrPromptPay: {} }
        : { paymentMethodType: 'CARD', card: {} };

      if (mock) {
        if (mode === 'PAIRING') {
          return {
            boltIntentId: 'mock_bi_' + String(idempotencyKey).slice(0, 8),
            mode: 'PAIRING',
            paymentMethodType: pmType,
            mock: true,
          };
        }
        return {
          boltIntentId: 'mock_bi_' + String(idempotencyKey).slice(0, 8),
          deepLinkUrl:
            returnUrl + (returnUrl.includes('?') ? '&' : '?') + 'boltMock=1',
          mode: 'DEEP_LINK',
          mock: true,
        };
      }

      let body;
      if (mode === 'PAIRING') {
        body = {
          amount,
          currency: 'THB',
          referenceId,
          boltConnectionId,
          paymentMethod: pairedPaymentMethod,
          expiryDurationInSec: 300,
          mode: { type: 'PAIRING' },
        };
      } else {
        body = {
          amount,
          currency: 'THB',
          referenceId,
          paymentMethod: { paymentMethodType: 'QR_PROMPT_PAY', qrPromptPay: {} },
          expiryDurationInSec: 300,
          mode: { type: 'DEEP_LINK', deepLink: { returnUrl } },
        };
      }

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
        boltIntentId: data.id,
        deepLinkUrl: data.mode?.deepLink?.deepLinkUrl,
        mode,
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

    // verifyWebhookSignature(rawBodyBuffer, signatureHeader)
    //   -> { verified, skipped? }
    //
    // No BEAM_WEBHOOK_SECRET configured (PoC) -> { verified:false, skipped:true }
    // so the caller can choose to proceed with a warning.
    //
    // Otherwise: base64( HMAC-SHA256(rawBody, base64decode(secret)) ), compared
    // timing-safe against the signature header. -> { verified }.
    verifyWebhookSignature(rawBodyBuffer, signatureHeader) {
      if (!webhookSecret) {
        return { verified: false, skipped: true };
      }
      if (!signatureHeader) {
        return { verified: false };
      }
      const key = Buffer.from(webhookSecret, 'base64');
      const computed = crypto
        .createHmac('sha256', key)
        .update(rawBodyBuffer)
        .digest('base64');

      const a = Buffer.from(computed);
      const b = Buffer.from(String(signatureHeader));
      if (a.length !== b.length) {
        return { verified: false };
      }
      return { verified: crypto.timingSafeEqual(a, b) };
    },
  };
}
