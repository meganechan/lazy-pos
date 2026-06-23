// LINE OA Messaging adapter (push quote summary + receive confirm).
// Mock implementation now — swap for real LINE Messaging API later WITHOUT
// changing core. Core only depends on the returned interface shape.
//
// Real impl (later): POST to LINE Messaging API with
// `Authorization: Bearer <env.LINE_CHANNEL_ACCESS_TOKEN>` to push messages,
// and verify inbound webhooks with env.LINE_CHANNEL_SECRET.

import { randomUUID } from 'node:crypto';

export function createLineAdapter(env = {}) {
  const token = env.LINE_CHANNEL_ACCESS_TOKEN;
  const secret = env.LINE_CHANNEL_SECRET;
  const mock = !token || !secret;
  if (mock) {
    console.log('[line] running in MOCK mode (LINE channel credentials not set)');
  }

  return {
    // pushQuote({ lineUserId, ticketId, quotedTotal })
    //   -> Promise<{ lineMsgId: string }>
    async pushQuote({ lineUserId, ticketId, quotedTotal } = {}) {
      return { lineMsgId: 'line_' + randomUUID().slice(0, 8) };
    },

    // confirm({ ticketId }) -> Promise<{ confirmed: true }>
    // (mock acknowledgement of a customer confirm)
    async confirm({ ticketId } = {}) {
      return { confirmed: true };
    },
  };
}
