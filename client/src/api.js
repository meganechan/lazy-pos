const j = async (url, opts) => {
  const r = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (!r.ok) {
    const data = await r.json().catch(() => ({}));
    const err = new Error(data.error || r.statusText);
    err.status = r.status;
    err.body = data;
    throw err;
  }
  return r.json();
};

export const api = {
  summary: () => j('/api/summary'),
  services: () => j('/api/services'),
  members: (q) => j('/api/members' + (typeof q === 'string' && q.trim() ? '?q=' + encodeURIComponent(q.trim()) : '')),
  member: (id) => j(`/api/members/${id}`),
  addMember: (body) => j('/api/members', { method: 'POST', body: JSON.stringify(body) }),
  updateMember: (id, body) => j(`/api/members/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  tickets: () => j('/api/tickets'),
  ticket: (id) => j(`/api/tickets/${id}`),
  newTicket: (body) => j('/api/tickets', { method: 'POST', body: JSON.stringify(body) }),
  addItem: (id, body) => j(`/api/tickets/${id}/items`, { method: 'POST', body: JSON.stringify(body) }),
  delItem: (id, itemId) => j(`/api/tickets/${id}/items/${itemId}`, { method: 'DELETE' }),
  sendQuote: (id) => j(`/api/tickets/${id}/quote/send`, { method: 'POST' }),
  confirmQuote: (id) => j(`/api/tickets/${id}/quote/confirm`, { method: 'POST' }),
  pay: (id, body) => j(`/api/tickets/${id}/payments`, { method: 'POST', body: JSON.stringify(body) }),
  voidPayment: (ticketId, pid) => j(`/api/tickets/${ticketId}/payments/${pid}/void`, { method: 'POST' }),
  retryEdc: (ticketId, pid, simulate) => j(`/api/tickets/${ticketId}/payments/${pid}/retry`, { method: 'POST', body: JSON.stringify(simulate ? { simulate } : {}) }),
  close: (id) => j(`/api/tickets/${id}/close`, { method: 'POST' }),
};

export const baht = (n) => '฿' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0 });
