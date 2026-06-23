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

    // 401 handling:
    //  - WITH a token = an existing session expired mid-use → drop auth + reload to <Login/>.
    //  - WITHOUT a token = a pre-auth call (login/lookup); a wrong PIN returns 401 here, so
    //    DON'T reload — just throw so the caller (e.g. submit) can show "PIN ไม่ถูกต้อง".
    if (r.status === 401) {
      if (token) {
        clearAuth()
        if (typeof window !== 'undefined') window.location.reload()
      }
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
  // public shop picker
  shops: () => j('/api/auth/shops'),
  // users for ONE store only. Pass the chosen store's id at login.
  // In-app callers (no arg) fall back to the logged-in user's store_id so the
  // technician picker keeps working. No store id at all → [] (server returns empty).
  authUsers: (storeId) => {
    const sid = storeId != null && storeId !== '' ? storeId : (getUser() && getUser().store_id)
    if (sid == null || sid === '') return Promise.resolve([])
    return j('/api/auth/users?store_id=' + encodeURIComponent(sid))
  },
  login: (userId, pin) => j('/api/auth/login', { method: 'POST', body: JSON.stringify({ userId, pin }) }),
  signup: (body) => j('/api/auth/signup', { method: 'POST', body: JSON.stringify(body) }),
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
  deleteService: (id, opts) => j(`/api/services/${id}`, { method: 'DELETE', ...(opts ? { body: JSON.stringify(opts) } : {}) }),
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
  addCustomItem: (id, body) => j(`/api/tickets/${id}/custom-item`, { method: 'POST', body: JSON.stringify(body) }),
  updateItem: (ticketId, itemId, body) => j(`/api/tickets/${ticketId}/items/${itemId}`, { method: 'PUT', body: JSON.stringify(body) }),
  delItem: (id, itemId) => j(`/api/tickets/${id}/items/${itemId}`, { method: 'DELETE' }),

  /* ── discounts + staff pricing + settings (§v1.2) ── */
  setBillDiscount: (id, body) => j(`/api/tickets/${id}/discount`, { method: 'PUT', body: JSON.stringify(body) }),
  setItemDiscount: (id, itemId, body) => j(`/api/tickets/${id}/items/${itemId}/discount`, { method: 'PUT', body: JSON.stringify(body) }),
  getSettings: () => j('/api/settings'),
  updateSettings: (body) => j('/api/settings', { method: 'PUT', body: JSON.stringify(body) }),
  // per-staff discount/quota overrides (owner): { store, staff:[{user_id,name,override,effective}] }
  getStaffSettings: () => j('/api/settings/staff'),
  updateStaffSettings: (userId, body) => j(`/api/settings/staff/${userId}`, { method: 'PUT', body: JSON.stringify(body) }),
  usageToday: () => j('/api/usage/today'),
  // §v1.5 attendance: { me:{checked_in,...}, staff:[{user_id,name,checked_in,...}] }
  // §v1.6 owner sales report (read-only aggregates). from/to = YYYY-MM-DD.
  reports: (from, to) => j('/api/reports' + ((from || to) ? `?from=${from || ''}&to=${to || ''}` : '')),
  attendanceToday: () => j('/api/attendance/today'),
  checkIn: (userId) => j('/api/attendance/check-in', { method: 'POST', body: JSON.stringify(userId ? { user_id: userId } : {}) }),
  checkOut: (userId) => j('/api/attendance/check-out', { method: 'POST', body: JSON.stringify(userId ? { user_id: userId } : {}) }),

  /* ── technician queue + assignment + start ── */
  queue: () => j('/api/queue'),
  assignTech: (id, assigned_user_id) => j(`/api/tickets/${id}/assign`, { method: 'PUT', body: JSON.stringify({ assigned_user_id }) }),
  startTicket: (id, assigned_user_id) => j(`/api/tickets/${id}/start`, { method: 'POST', body: JSON.stringify(assigned_user_id != null ? { assigned_user_id } : {}) }),
  sendQuote: (id) => j(`/api/tickets/${id}/quote/send`, { method: 'POST' }),
  confirmQuote: (id) => j(`/api/tickets/${id}/quote/confirm`, { method: 'POST' }),
  pay: (id, body) => j(`/api/tickets/${id}/payments`, { method: 'POST', body: JSON.stringify(body) }),
  voidPayment: (ticketId, pid) => j(`/api/tickets/${ticketId}/payments/${pid}/void`, { method: 'POST' }),
  retryEdc: (ticketId, pid, simulate) => j(`/api/tickets/${ticketId}/payments/${pid}/retry`, { method: 'POST', body: JSON.stringify(simulate ? { simulate } : {}) }),

  /* ── Beam Bolt device pairing (owner) ──
     pairBolt: send the 8-char code shown on the EDC device → links it to this shop.
     boltConnection: read this shop's current pairing status. */
  pairBolt: (pairingCode) => j('/api/bolt/pair', { method: 'POST', body: JSON.stringify({ pairingCode }) }),
  boltConnection: () => j('/api/bolt/connection'),

  /* ── Beam Bolt intent (PoC) ──
     create a pending beam_edc payment + a Beam Bolt intent, then poll its result.
     body carries { mode, amount }: mode = PAIRING (รูดบัตรที่เครื่อง EDC) or
     DEEP_LINK (QR PromptPay). Server defaults to PAIRING when the shop is paired
     else DEEP_LINK. pollBoltIntent appends ?simulate= only when supplied (mock demo). */
  createBoltIntent: (ticketId, body) => j(`/api/tickets/${ticketId}/bolt-intent`, { method: 'POST', body: JSON.stringify(body || {}) }),
  pollBoltIntent: (ticketId, pid, simulate) => j(`/api/tickets/${ticketId}/bolt-intent/${pid}` + (simulate ? '?simulate=' + encodeURIComponent(simulate) : '')),
  // cancelBoltIntent: cashier hit "ยกเลิก" → tell Beam to cancel so the EDC stops
  // waiting, and void the pending row. Returns { ok, beamError, ticket }.
  cancelBoltIntent: (ticketId, pid) => j(`/api/tickets/${ticketId}/bolt-intent/${pid}/cancel`, { method: 'POST' }),

  close: (id) => j(`/api/tickets/${id}/close`, { method: 'POST' }),
}

export const baht = (n) => '฿' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0 })
