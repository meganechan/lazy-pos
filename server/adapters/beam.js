// Beam Bolt payment adapter (EDC charges via x-beam-idempotency-key).
// Mock implementation now — swap for real Beam Charges API later WITHOUT
// changing core. Core only depends on the returned interface shape.
//
// Real impl (later): HTTP Basic auth with env.BEAM_API_KEY, POST to Beam
// Charges API with header `x-beam-idempotency-key: <idempotencyKey>`, then
// deep-link into the Bolt app. Same key on retry → Beam returns the same
// result (no double charge).

export function createBeamAdapter(env = {}) {
  const key = env.BEAM_API_KEY;
  const mock = !key || key === 'demo-not-set';
  if (mock) {
    console.log('[beam] running in MOCK mode (BEAM_API_KEY not set)');
  }

  return {
    // charge({ idempotencyKey, amount, ticketId, simulate? })
    //   -> Promise<{ status: 'success'|'failed', beamChargeId?: string }>
    async charge({ idempotencyKey, amount, ticketId, simulate } = {}) {
      // Mock preserves the original inline simulate semantics:
      // caller may pass simulate:'fail' to force a failure; otherwise success.
      const ok = simulate !== 'fail';
      if (ok) {
        return {
          status: 'success',
          beamChargeId: 'beam_' + String(idempotencyKey).slice(0, 12),
        };
      }
      return { status: 'failed' };
    },
  };
}
