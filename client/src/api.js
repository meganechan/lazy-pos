/* ───────────────────────── auth storage ───────────────────────── */
const TOKEN_KEY = 'lazypos_token'
const USER_KEY = 'lazypos_user'

export const getToken = () => {
  try { return localStorage.getItem(TOKEN_KEY) || null } catch { return null }
}

export const getUser = () => {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export const setAuth = (token, user) => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user))
  } catch { /* ignore storage errors */ }
}

export const clearAuth = () => {
  try {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  } catch { /* ignore */ }
}

/* fetch wrapper: attaches bearer token, handles 401/403 globally */
const j = async (url, opts = {}) => {
  const token = getToken()
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) }
  if (token) headers['Authorization'] = 'Bearer ' + token

  const r = await fetch(url, { ...opts, headers })

  if (!r.ok) {
    const data = await r.json().catch(() => ({}))

    // session gone/expired → drop auth and force back to login
    if (r.status === 401) {
      clearAuth()
      // reload so the App gate re-renders <Login/>
      if (typeof window !== 'undefined') window.location.reload()
      const err = new Error(data.error || 'unauthorized')
      err.status = 401
      err.body = data
      throw err
    }

    // insufficient role → friendly, callers can toast
    if (r.status === 403) {
      const err = new Error('ไม่มีสิทธิ์ (owner เท่านั้น)')
      err.status = 403
      err.body = data
      throw err
    }

    const err = new Error(data.error || r.statusText)
    err.status = r.status
    err.body = data
    throw err
  }
  return r.json()
}

export const api = {
  /* ── auth ── */
  authUsers: () => j('/api/auth/users'),
  login: (userId, pin) => j('/api/auth/login', { method: 'POST', body: JSON.stringify({ userId, pin }) }),
  logout: () => j('/api/auth/logout', { method: 'POST' }),

  /* ── user management (owner only) ── */
  users: () => j('/api/users'),
  addUser: (body) => j('/api/users', { method: 'POST', body: JSON.stringify(body) }),
  updateUser: (id, body) => j(`/api/users/${id}`, { method: 'PUT', body: JSON.stringify(body) }),

  /* ── audit log (owner only) ── */
  audit: (params) => {
    let qs = ''
    if (params && typeof params === 'object') {
      const sp = new URLSearchParams()
      Object.keys(params).forEach((k) => {
        if (params[k] !== undefined && params[k] !== null && params[k] !== '') sp.set(k, params[k])
      })
      const s = sp.toString()
      if (s) qs = '?' + s
    }
    return j('/api/audit' + qs)
  },

  /* ── services (CRUD + add-on options, owner only for mutations) ── */
  updateService: (id, body) => j(`/api/services/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  serviceDetail: (id) => j(`/api/services/${id}`),
  createService: (body) => j('/api/services', { method: 'POST', body: JSON.stringify(body) }),
  deleteService: (id) => j(`/api/services/${id}`, { method: 'DELETE' }),
  addOption: (sid, body) => j(`/api/services/${sid}/options`, { method: 'POST', body: JSON.stringify(body) }),
  updateOption: (sid, oid, body) => j(`/api/services/${sid}/options/${oid}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteOption: (sid, oid) => j(`/api/services/${sid}/options/${oid}`, { method: 'DELETE' }),

  /* ── existing app endpoints (now carry auth header automatically) ── */
  summary: () => j('/api/summary'),
  // services() = active services (for the ticket picker); services(true) = ALL services (+all options) for management
  services: (all) => j('/api/services' + (all ? '?all=1' : '')),
  members: (q) => j('/api/members' + (typeof q === 'string' && q.trim() ? '?q=' + encodeURIComponent(q.trim()) : '')),
  member: (id) => j(`/api/members/${id}`),
  addMember: (body) => j('/api/members', { method: 'POST', body: JSON.stringify(body) }),
  updateMember: (id, body) => j(`/api/members/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  tickets: () => j('/api/tickets'),
  ticket: (id) => j(`/api/tickets/${id}`),
  newTicket: (body) => j('/api/tickets', { method: 'POST', body: JSON.stringify(body) }),
  addItem: (id, body) => j(`/api/tickets/${id}/items`, { method: 'POST', body: JSON.stringify(body) }),
  updateItem: (ticketId, itemId, body) => j(`/api/tickets/${ticketId}/items/${itemId}`, { method: 'PUT', body: JSON.stringify(body) }),
  delItem: (id, itemId) => j(`/api/tickets/${id}/items/${itemId}`, { method: 'DELETE' }),

  /* ── technician queue + assignment + start ── */
  queue: () => j('/api/queue'),
  assignTech: (id, assigned_user_id) => j(`/api/tickets/${id}/assign`, { method: 'PUT', body: JSON.stringify({ assigned_user_id }) }),
  startTicket: (id, assigned_user_id) => j(`/api/tickets/${id}/start`, { method: 'POST', body: JSON.stringify(assigned_user_id != null ? { assigned_user_id } : {}) }),
  sendQuote: (id) => j(`/api/tickets/${id}/quote/send`, { method: 'POST' }),
  confirmQuote: (id) => j(`/api/tickets/${id}/quote/confirm`, { method: 'POST' }),
  pay: (id, body) => j(`/api/tickets/${id}/payments`, { method: 'POST', body: JSON.stringify(body) }),
  voidPayment: (ticketId, pid) => j(`/api/tickets/${ticketId}/payments/${pid}/void`, { method: 'POST' }),
  retryEdc: (ticketId, pid, simulate) => j(`/api/tickets/${ticketId}/payments/${pid}/retry`, { method: 'POST', body: JSON.stringify(simulate ? { simulate } : {}) }),
  close: (id) => j(`/api/tickets/${id}/close`, { method: 'POST' }),
}

export const baht = (n) => '฿' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0 })
