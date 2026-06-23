const j = async (url, opts) => {
  const r = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || r.statusText);
  return r.json();
};

export const api = {
  summary: () => j('/api/summary'),
  services: () => j('/api/services'),
  members: () => j('/api/members'),
  member: (id) => j(`/api/members/${id}`),
  addMember: (body) => j('/api/members', { method: 'POST', body: JSON.stringify(body) }),
  tickets: () => j('/api/tickets'),
  ticket: (id) => j(`/api/tickets/${id}`),
  newTicket: (body) => j('/api/tickets', { method: 'POST', body: JSON.stringify(body) }),
  addItem: (id, body) => j(`/api/tickets/${id}/items`, { method: 'POST', body: JSON.stringify(body) }),
  delItem: (id, itemId) => j(`/api/tickets/${id}/items/${itemId}`, { method: 'DELETE' }),
  sendQuote: (id) => j(`/api/tickets/${id}/quote/send`, { method: 'POST' }),
  confirmQuote: (id) => j(`/api/tickets/${id}/quote/confirm`, { method: 'POST' }),
  pay: (id, body) => j(`/api/tickets/${id}/payments`, { method: 'POST', body: JSON.stringify(body) }),
  close: (id) => j(`/api/tickets/${id}/close`, { method: 'POST' }),
};

export const baht = (n) => '฿' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0 });
