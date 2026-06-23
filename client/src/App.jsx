import { useState, useEffect } from 'react'
import { api, baht, getToken, getUser, setAuth, clearAuth } from './api'

const N = (v) => Number(v || 0)

/* ───────────────────────── Icons (inline Lucide-style SVG) ─────────────────────────
 * Single source of truth for UI glyphs. Real Lucide path data, consistent 1.75 stroke.
 * Replaces all emoji used as nav / system / action icons. Pure presentation. */
const ICONS = {
  'dashboard': <><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></>,
  'users': <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
  'clock': <><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" /></>,
  'receipt': <><path d="M4 2v20l2-1.5L8 22l2-1.5L12 22l2-1.5L16 22l2-1.5L20 22V2l-2 1.5L16 2l-2 1.5L12 2l-2 1.5L8 2 6 3.5 4 2Z" /><path d="M8 7h8" /><path d="M8 11h8" /><path d="M8 15h5" /></>,
  'key': <><circle cx="7.5" cy="15.5" r="4.5" /><path d="m10.7 12.3 8.3-8.3" /><path d="m17 5 3 3" /><path d="m14 8 2 2" /></>,
  'history': <><path d="M5 6h14a2 2 0 0 1 2 2v9a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V5a2 2 0 0 1 2-2h11" /><path d="M19 17V8a2 2 0 0 0-2-2H5" /><path d="M8 8h6" /><path d="M8 12h6" /></>,
  'sparkles': <><path d="M9.5 3 11 7.5 15.5 9 11 10.5 9.5 15 8 10.5 3.5 9 8 7.5 9.5 3Z" /><path d="M18 4l.7 2.3L21 7l-2.3.7L18 10l-.7-2.3L15 7l2.3-.7L18 4Z" /><path d="M18 14l.7 2.3L21 17l-2.3.7L18 20l-.7-2.3L15 17l2.3-.7L18 14Z" /></>,
  'banknote': <><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /><path d="M6 12h.01" /><path d="M18 12h.01" /></>,
  'credit-card': <><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></>,
  'rotate-ccw': <><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></>,
  'plus': <><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>,
  'minus': <line x1="5" y1="12" x2="19" y2="12" />,
  'pencil': <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></>,
  'play': <polygon points="6 4 20 12 6 20 6 4" />,
  'search': <><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></>,
  'log-out': <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></>,
  'store': <><path d="M3 9 4.5 4h15L21 9" /><path d="M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9" /><path d="M3 9h18" /><path d="M9 20v-6h6v6" /></>,
  'smartphone': <><rect x="6" y="2" width="12" height="20" rx="2" /><line x1="10" y1="18" x2="14" y2="18" /></>,
  'message-circle': <path d="M7.9 20A9 9 0 1 0 4 16.1L3 21Z" />,
  'check': <polyline points="20 6 9 17 4 12" />,
  'check-circle': <><circle cx="12" cy="12" r="9" /><polyline points="16 9 11 14 8.5 11.5" /></>,
  'alert-triangle': <><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></>,
  'chevron-left': <polyline points="15 18 9 12 15 6" />,
  'chevron-right': <polyline points="9 18 15 12 9 6" />,
  'lock': <><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>,
  'loader': <><line x1="12" y1="2" x2="12" y2="6" /><line x1="12" y1="18" x2="12" y2="22" /><line x1="4.9" y1="4.9" x2="7.8" y2="7.8" /><line x1="16.2" y1="16.2" x2="19.1" y2="19.1" /><line x1="2" y1="12" x2="6" y2="12" /><line x1="18" y1="12" x2="22" y2="12" /><line x1="4.9" y1="19.1" x2="7.8" y2="16.2" /><line x1="16.2" y1="7.8" x2="19.1" y2="4.9" /></>,
  'delete': <><path d="M21 4H8L1 12l7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Z" /><line x1="18" y1="9" x2="12" y2="15" /><line x1="12" y1="9" x2="18" y2="15" /></>,
  'send': <><path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4Z" /></>,
}

function Icon({ name, size = 24, className }) {
  const p = ICONS[name]
  if (!p) return null
  return (
    <svg className={'icon ' + (className || '')} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{p}</svg>
  )
}

/* Brand wordmark "owo" (owo.chat). Styled text now; swap for an asset later by
   replacing this component's body. Inherits font-size + uses currentColor so it
   themes (white on dark bars, near-black on white) with an orange accent letter. */
function Logo({ className = '' }) {
  return (
    <span className={'brand-logo ' + className} aria-label="owo" role="img">
      o<span className="brand-logo-accent">w</span>o
    </span>
  )
}

const roleTH = { owner: 'เจ้าของร้าน', staff: 'พนักงาน' }

/* viewport hook: exposes isLarge (≥768px). matchMedia with cleanup. */
function useViewport() {
  const query = '(min-width: 768px)'
  const get = () =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(query).matches
      : false
  const [isLarge, setIsLarge] = useState(get)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia(query)
    const onChange = (e) => setIsLarge(e.matches)
    // addEventListener is the modern API; addListener is the legacy fallback
    if (mq.addEventListener) mq.addEventListener('change', onChange)
    else mq.addListener(onChange)
    setIsLarge(mq.matches)
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', onChange)
      else mq.removeListener(onChange)
    }
  }, [])

  return { isLarge }
}

/* read-only hint banner shown on management views for owner-on-phone */
function ManageHint() {
  return <div className="note-warn manage-hint"><Icon name="smartphone" size={20} /> เปิดบน iPad/คอมเพื่อจัดการ</div>
}

// status -> Thai label
const statusTH = {
  open: 'เปิดบิล',
  in_progress: 'กำลังทำ',
  done: 'เสร็จแล้ว',
  closed: 'ปิดบิล',
}

export default function App() {
  // auth gate: only treat as logged-in when both token + user exist
  const [user, setUser] = useState(() => (getToken() ? getUser() : null))
  const [tab, setTab] = useState('dashboard') // dashboard | members | services | tickets | users | audit
  const [view, setView] = useState(null) // null | {kind:'member',id} | {kind:'ticket',id} | {kind:'newTicket'} | {kind:'newMember'} | {kind:'newUser'} | {kind:'editUser',u}
  const [toast, setToast] = useState(null)
  const { isLarge } = useViewport()

  const flash = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2200)
  }

  const onLoggedIn = (token, u) => {
    setAuth(token, u)
    setUser(u)
    setTab('dashboard')
    setView(null)
  }

  const doLogout = () => {
    api.logout().catch(() => {}) // best-effort; clear locally regardless
    clearAuth()
    setUser(null)
    setTab('dashboard')
    setView(null)
  }

  // not authenticated → full-screen login
  if (!user) {
    return <Login onLoggedIn={onLoggedIn} />
  }

  const role = user.role
  const isOwner = role === 'owner'

  // mode = role × viewport
  // staff → always phone-lean. owner+large → wide management. owner+phone → read-only summary.
  const canManage = isOwner && isLarge
  const lean = !isOwner // staff lean layout on any screen
  const wide = isOwner && isLarge // owner wide management layout
  const ownerPhone = isOwner && !isLarge // owner read-only summary

  const appClass = 'app' + (lean ? ' lean' : '') + (wide ? ' wide' : '')

  const goTab = (t) => {
    setView(null)
    setTab(t)
  }

  const openTicket = (id) => setView({ kind: 'ticket', id })
  const openMember = (id) => setView({ kind: 'member', id })

  // figure out title + back behavior
  let title = 'Lazy Nail POS'
  let sub = 'ร้านทำเล็บ'
  let onBack = null
  if (view) {
    onBack = () => setView(null)
    if (view.kind === 'member') { title = 'ข้อมูลสมาชิก'; sub = 'Member' }
    else if (view.kind === 'newMember') { title = 'เพิ่มสมาชิก'; sub = 'New member' }
    else if (view.kind === 'newTicket') { title = 'เปิดบิลใหม่'; sub = 'New ticket' }
    else if (view.kind === 'ticket') { title = 'บิล / เช็คเอาท์'; sub = 'Ticket #' + view.id }
    else if (view.kind === 'newUser') { title = 'เพิ่มผู้ใช้'; sub = 'New user' }
    else if (view.kind === 'editUser') { title = 'แก้ไขผู้ใช้'; sub = 'Edit user' }
  } else {
    if (tab === 'members') { title = 'สมาชิก'; sub = 'Members' }
    else if (tab === 'queue') { title = 'คิวช่าง'; sub = 'Queue' }
    else if (tab === 'services') { title = 'บริการ'; sub = 'Services' }
    else if (tab === 'tickets') { title = 'บิลทั้งหมด'; sub = 'Tickets' }
    else if (tab === 'users') { title = 'จัดการผู้ใช้'; sub = 'Users' }
    else if (tab === 'audit') { title = 'บันทึกกิจกรรม'; sub = 'Audit log' }
  }

  // which tabs get a FAB (new ticket)
  const showFab = !view && (tab === 'dashboard' || tab === 'tickets')

  return (
    <div className={appClass}>
      <div className="topbar">
        {onBack ? (
          <button className="back" onClick={onBack} aria-label="กลับ"><Icon name="chevron-left" size={22} /></button>
        ) : (
          <Logo className="logo" />
        )}
        <div className="grow">
          <h1>{title}</h1>
          <div className="sub">{sub}</div>
        </div>
        <div className="userchip">
          <div className="who">
            <div className="uname">{user.name}</div>
            <div className="urole">{roleTH[role] || role}</div>
          </div>
          <button className="logout" onClick={doLogout} title="ออกจากระบบ" aria-label="ออกจากระบบ"><Icon name="log-out" size={18} /></button>
        </div>
      </div>

      <div className="content">
        {view ? (
          view.kind === 'member' ? (
            <MemberDetail id={view.id} onNewTicket={(mid) => setView({ kind: 'newTicket', preMember: mid })} flash={flash} openTicket={openTicket} ownerPhone={ownerPhone} />
          ) : view.kind === 'newMember' ? (
            <NewMember flash={flash} onDone={() => { setView(null); setTab('members') }} />
          ) : view.kind === 'newTicket' ? (
            <NewTicket flash={flash} preMember={view.preMember} onCreated={(t) => setView({ kind: 'ticket', id: t.id })} />
          ) : view.kind === 'newUser' ? (
            <UserForm flash={flash} onDone={() => { setView(null); setTab('users') }} onCancel={() => setView(null)} />
          ) : view.kind === 'editUser' ? (
            <UserForm flash={flash} u={view.u} onDone={() => { setView(null); setTab('users') }} onCancel={() => setView(null)} />
          ) : (
            <TicketView id={view.id} flash={flash} isOwner={isOwner} canManage={canManage} ownerPhone={ownerPhone} onClosed={() => goTab('tickets')} />
          )
        ) : tab === 'dashboard' ? (
          <Dashboard flash={flash} openTicket={openTicket} canManage={canManage} isOwner={isOwner} wide={wide} onNewTicket={() => setView({ kind: 'newTicket' })} onNewMember={() => setView({ kind: 'newMember' })} />
        ) : tab === 'members' ? (
          <Members openMember={openMember} canManage={canManage} ownerPhone={ownerPhone} onNewMember={() => setView({ kind: 'newMember' })} />
        ) : tab === 'queue' ? (
          <QueueBoard flash={flash} openTicket={openTicket} />
        ) : tab === 'services' ? (
          <Services flash={flash} isOwner={isOwner} canManage={canManage} ownerPhone={ownerPhone} wide={wide} />
        ) : tab === 'users' && isOwner ? (
          <Users flash={flash} canManage={canManage} ownerPhone={ownerPhone} wide={wide} onNewUser={() => setView({ kind: 'newUser' })} onEditUser={(u) => setView({ kind: 'editUser', u })} />
        ) : tab === 'audit' && isOwner ? (
          <AuditLog flash={flash} wide={wide} />
        ) : (
          <Tickets openTicket={openTicket} />
        )}
      </div>

      {showFab && (
        <button className="fab" onClick={() => setView({ kind: 'newTicket' })} aria-label="เปิดบิลใหม่"><Icon name="plus" size={28} /></button>
      )}

      {!view && (
        <div className="tabbar">
          <button className={tab === 'dashboard' ? 'active' : ''} onClick={() => goTab('dashboard')}>
            <span className="tico"><Icon name="dashboard" /></span>หน้าหลัก
          </button>
          <button className={tab === 'members' ? 'active' : ''} onClick={() => goTab('members')}>
            <span className="tico"><Icon name="users" /></span>สมาชิก
          </button>
          <button className={tab === 'queue' ? 'active' : ''} onClick={() => goTab('queue')}>
            <span className="tico"><Icon name="clock" /></span>คิว
          </button>
          {/* staff pick services inside a ticket → hide the บริการ tab (lean) */}
          {isOwner && (
            <button className={tab === 'services' ? 'active' : ''} onClick={() => goTab('services')}>
              <span className="tico"><Icon name="sparkles" /></span>บริการ
            </button>
          )}
          <button className={tab === 'tickets' ? 'active' : ''} onClick={() => goTab('tickets')}>
            <span className="tico"><Icon name="receipt" /></span>บิล
          </button>
          {isOwner && (
            <button className={tab === 'users' ? 'active' : ''} onClick={() => goTab('users')}>
              <span className="tico"><Icon name="key" /></span>ผู้ใช้
            </button>
          )}
          {isOwner && (
            <button className={tab === 'audit' ? 'active' : ''} onClick={() => goTab('audit')}>
              <span className="tico"><Icon name="history" /></span>บันทึก
            </button>
          )}
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

function Loading() {
  return <div className="empty"><div className="big"><Icon name="loader" size={32} className="spin" /></div>กำลังโหลด...</div>
}

function StatusBadge({ status }) {
  return <span className={'badge ' + status}>{statusTH[status] || status}</span>
}

/* ───────────────────────── Dashboard ───────────────────────── */
function Dashboard({ flash, openTicket, onNewTicket, onNewMember, canManage, isOwner, wide }) {
  const [sum, setSum] = useState(null)
  const [tickets, setTickets] = useState(null)

  const load = () => {
    api.summary().then(setSum).catch(() => flash('โหลดสรุปไม่สำเร็จ'))
    api.tickets().then(setTickets).catch(() => setTickets([]))
  }
  useEffect(load, [])

  if (!sum) return <Loading />

  // staff = lean: hide management money KPIs. owner (any viewport) sees the stats.
  const showStats = isOwner

  return (
    <>
      {showStats && (
        <div className={'stats' + (wide ? ' wide-grid' : '')}>
          <div className="stat primary">
            <div className="v">{baht(sum.revenue)}</div>
            <div className="l">รายได้วันนี้</div>
          </div>
          <div className="stat">
            <div className="v">{N(sum.txns)}</div>
            <div className="l">จำนวนบิล</div>
          </div>
          <div className="stat">
            <div className="v">{N(sum.members)}</div>
            <div className="l">สมาชิก</div>
          </div>
          <div className="stat">
            <div className="v">{N(sum.openTickets)}</div>
            <div className="l">บิลที่เปิดอยู่</div>
          </div>
        </div>
      )}

      <div className="quick">
        <button onClick={onNewTicket}><span className="ico"><Icon name="receipt" /></span>เปิดบิลใหม่</button>
        <button onClick={onNewMember}><span className="ico"><Icon name="plus" /></span>เพิ่มสมาชิก</button>
      </div>

      <div className="section-title">บิลที่เปิดอยู่</div>
      {!tickets ? (
        <Loading />
      ) : tickets.length === 0 ? (
        <div className="empty"><div className="big"><Icon name="sparkles" size={32} /></div>ยังไม่มีบิลที่เปิดอยู่</div>
      ) : (
        tickets.map((t) => (
          <div className="li" key={t.id} onClick={() => openTicket(t.id)}>
            <div className="avatar">{(t.member_name || t.staff_name || '?').charAt(0).toUpperCase()}</div>
            <div className="grow">
              <div className="name">{t.member_name || 'ลูกค้าทั่วไป'}</div>
              <div className="meta">โดย {t.staff_name || '-'} · <StatusBadge status={t.status} /></div>
            </div>
            <div className="price tnum">{baht(t.total)}</div>
            <span className="chev"><Icon name="chevron-right" size={20} /></span>
          </div>
        ))
      )}
    </>
  )
}

/* ───────────────────────── Members ───────────────────────── */
function Members({ openMember, onNewMember, ownerPhone }) {
  const [list, setList] = useState(null)
  const [q, setQ] = useState('')

  useEffect(() => {
    const t = setTimeout(() => {
      api.members(q).then(setList).catch(() => setList([]))
    }, 250)
    return () => clearTimeout(t)
  }, [q])

  return (
    <>
      {ownerPhone ? (
        <ManageHint />
      ) : (
        <button className="btn" onClick={onNewMember}><Icon name="plus" size={20} /> เพิ่มสมาชิกใหม่</button>
      )}
      <div className="spacer" />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาชื่อ/เบอร์..." />
      <div className="spacer" />
      {!list ? (
        <Loading />
      ) : list.length === 0 ? (
        <div className="empty"><div className="big"><Icon name="users" size={32} /></div>{q.trim() ? 'ไม่พบสมาชิกที่ค้นหา' : 'ยังไม่มีสมาชิก'}</div>
      ) : (
        list.map((m) => (
          <div className="li" key={m.id} onClick={() => openMember(m.id)}>
            <div className="avatar">{(m.name || '?').charAt(0).toUpperCase()}</div>
            <div className="grow">
              <div className="name">{m.name}</div>
              <div className="meta">{m.phone || 'ไม่มีเบอร์'}</div>
            </div>
            <span className="chev"><Icon name="chevron-right" size={20} /></span>
          </div>
        ))
      )}
    </>
  )
}

function NewMember({ flash, onDone }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [line, setLine] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const save = () => {
    if (!name.trim()) { flash('กรุณากรอกชื่อ'); return }
    setSaving(true)
    api.addMember({ name: name.trim(), phone: phone.trim() || undefined, line_user_id: line.trim() || undefined, notes: notes.trim() || undefined })
      .then(() => { flash('เพิ่มสมาชิกสำเร็จ'); onDone() })
      .catch((e) => { setSaving(false); flash('ผิดพลาด: ' + e.message) })
  }

  return (
    <div className="card">
      <label>ชื่อ *</label>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ชื่อลูกค้า" />
      <label>เบอร์โทร</label>
      <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="08x-xxx-xxxx" />
      <label>LINE User ID</label>
      <input value={line} onChange={(e) => setLine(e.target.value)} placeholder="U1234..." />
      <label>โน้ต</label>
      <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="แพ้น้ำยา, ชอบสีแดง ..." />
      <div className="btn-row">
        <button className="btn" disabled={saving} onClick={save}>{saving ? 'กำลังบันทึก...' : 'บันทึก'}</button>
      </div>
    </div>
  )
}

function MemberDetail({ id, flash, onNewTicket, openTicket, ownerPhone }) {
  const [m, setM] = useState(null)
  const [editing, setEditing] = useState(false)
  useEffect(() => {
    api.member(id).then(setM).catch(() => flash('โหลดข้อมูลสมาชิกไม่สำเร็จ'))
  }, [id])

  if (!m) return <Loading />

  if (editing) {
    return (
      <EditMember
        m={m}
        flash={flash}
        onCancel={() => setEditing(false)}
        onSaved={(updated) => { setM((prev) => ({ ...prev, ...updated })); setEditing(false) }}
      />
    )
  }

  return (
    <>
      <div className="card">
        <div className="row">
          <div className="avatar" style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--rose-soft)', color: 'var(--rose-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 22 }}>
            {(m.name || '?').charAt(0).toUpperCase()}
          </div>
          <div className="grow">
            <div className="name" style={{ fontSize: 18 }}>{m.name}</div>
            <div className="meta">{m.phone || 'ไม่มีเบอร์'}</div>
          </div>
        </div>
        {m.line_user_id && <div className="meta" style={{ marginTop: 10 }}>LINE: {m.line_user_id}</div>}
        {m.notes && <div className="meta" style={{ marginTop: 6 }}>โน้ต: {m.notes}</div>}
      </div>

      {ownerPhone ? (
        <ManageHint />
      ) : (
        <>
          <div className="btn-row">
            <button className="btn" onClick={() => onNewTicket(m.id)}><Icon name="receipt" size={20} /> เปิดบิลให้ลูกค้านี้</button>
          </div>
          <div className="btn-row">
            <button className="btn ghost" onClick={() => setEditing(true)}><Icon name="pencil" size={20} /> แก้ไขข้อมูล</button>
          </div>
        </>
      )}

      <div className="section-title">ประวัติการมาใช้บริการ</div>
      {!m.history || m.history.length === 0 ? (
        <div className="empty">ยังไม่มีประวัติ</div>
      ) : (
        m.history.map((h) => (
          <div className="li" key={h.id} onClick={() => openTicket(h.id)}>
            <div className="grow">
              <div className="name">บิล #{h.id}</div>
              <div className="meta">{fmtDate(h.created_at)} · <StatusBadge status={h.status} /></div>
            </div>
            <div className="price tnum">{baht(h.spent)}</div>
          </div>
        ))
      )}
    </>
  )
}

function EditMember({ m, flash, onSaved, onCancel }) {
  const [name, setName] = useState(m.name || '')
  const [phone, setPhone] = useState(m.phone || '')
  const [line, setLine] = useState(m.line_user_id || '')
  const [notes, setNotes] = useState(m.notes || '')
  const [saving, setSaving] = useState(false)

  const save = () => {
    if (!name.trim()) { flash('กรุณากรอกชื่อ'); return }
    setSaving(true)
    api.updateMember(m.id, { name: name.trim(), phone: phone.trim() || undefined, line_user_id: line.trim() || undefined, notes: notes.trim() || undefined })
      .then((updated) => { flash('บันทึกการแก้ไขแล้ว'); onSaved(updated) })
      .catch((e) => { setSaving(false); flash('ผิดพลาด: ' + e.message) })
  }

  return (
    <div className="card">
      <label>ชื่อ *</label>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ชื่อลูกค้า" />
      <label>เบอร์โทร</label>
      <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="08x-xxx-xxxx" />
      <label>LINE User ID</label>
      <input value={line} onChange={(e) => setLine(e.target.value)} placeholder="U1234..." />
      <label>โน้ต</label>
      <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="แพ้น้ำยา, ชอบสีแดง ..." />
      <div className="btn-row">
        <button className="btn ghost" disabled={saving} onClick={onCancel}>ยกเลิก</button>
        <button className="btn" disabled={saving} onClick={save}>{saving ? 'กำลังบันทึก...' : 'บันทึก'}</button>
      </div>
    </div>
  )
}

/* ───────────────────────── Services ───────────────────────── */
function Services({ flash, isOwner, canManage, ownerPhone, wide }) {
  const [list, setList] = useState(null)
  const [edits, setEdits] = useState({}) // serviceId -> string price
  const [busy, setBusy] = useState(false)
  const [nav, setNav] = useState(null) // null | {kind:'new'} | {kind:'edit',s} | {kind:'detail',id}

  // owner-large management loads ALL services (active+inactive); others load active only
  const manageMode = wide && canManage
  const load = () => api.services(manageMode).then(setList).catch(() => setList([]))
  useEffect(() => { load() }, [manageMode])

  // sub-views (owner-large only)
  if (manageMode && nav) {
    if (nav.kind === 'new') {
      return <ServiceForm flash={flash} categories={catNames(list || [])} onCancel={() => setNav(null)} onDone={() => { setNav(null); load() }} />
    }
    if (nav.kind === 'edit') {
      return <ServiceForm flash={flash} s={nav.s} categories={catNames(list || [])} onCancel={() => setNav(null)} onDone={() => { setNav(null); load() }} />
    }
    if (nav.kind === 'detail') {
      return <ServiceDetail id={nav.id} flash={flash} onBack={() => { setNav(null); load() }} onEdit={(s) => setNav({ kind: 'edit', s })} />
    }
  }

  if (!list) return <Loading />

  const commitPrice = (s) => {
    const raw = edits[s.id]
    if (raw === undefined) return
    const newPrice = N(raw)
    if (newPrice === N(s.base_price)) {
      setEdits((p) => { const c = { ...p }; delete c[s.id]; return c })
      return
    }
    setBusy(true)
    api.updateService(s.id, { base_price: newPrice })
      .then(() => load())
      .then(() => {
        setBusy(false)
        setEdits((p) => { const c = { ...p }; delete c[s.id]; return c })
        flash && flash('แก้ราคาแล้ว')
      })
      .catch((e) => { setBusy(false); flash && flash(e.status === 403 ? e.message : 'แก้ราคาไม่สำเร็จ: ' + e.message) })
  }

  const removeService = (s) => {
    if (typeof window !== 'undefined' && !window.confirm('ลบบริการ "' + s.name + '" ?')) return
    setBusy(true)
    api.deleteService(s.id)
      .then((d) => load().then(() => {
        setBusy(false)
        if (d && d.mode === 'soft') flash && flash('บริการนี้มีประวัติการใช้ → ปิดการใช้งานแทนการลบ')
        else flash && flash('ลบบริการแล้ว')
      }))
      .catch((e) => { setBusy(false); flash && flash(e.status === 403 ? e.message : 'ลบไม่สำเร็จ: ' + e.message) })
  }

  // owner + large → management table with inline price edit + full CRUD
  if (manageMode) {
    return (
      <>
        <div className="btn-row" style={{ marginTop: 0, marginBottom: 12 }}>
          <button className="btn" style={{ width: 'auto', padding: '12px 18px' }} onClick={() => setNav({ kind: 'new' })}><Icon name="plus" size={20} /> เพิ่มบริการ</button>
        </div>
        {list.length === 0 ? (
          <div className="empty"><div className="big"><Icon name="sparkles" size={32} /></div>ยังไม่มีบริการ</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>บริการ</th>
                <th>หมวด</th>
                <th className="num">เวลา (นาที)</th>
                <th className="num">ราคา (บาท)</th>
                <th className="act">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {list.map((s) => {
                const inactive = s.active === false
                const nOpt = (s.options || []).length
                return (
                  <tr key={s.id} style={{ cursor: 'pointer' }}>
                    <td
                      className="strong"
                      onClick={() => setNav({ kind: 'detail', id: s.id })}
                      style={inactive ? { color: 'var(--muted)', textDecoration: 'line-through' } : undefined}
                    >
                      {s.name}
                      {inactive && <span className="badge closed" style={{ marginLeft: 8 }}>ปิดใช้งาน</span>}
                      {nOpt > 0 && <span className="cat" style={{ fontSize: 12, color: 'var(--rose-dark)', background: 'var(--rose-soft)', padding: '2px 8px', borderRadius: 6, marginLeft: 6 }}>+{nOpt} add-on</span>}
                    </td>
                    <td onClick={() => setNav({ kind: 'detail', id: s.id })}>{s.category || 'อื่นๆ'}</td>
                    <td className="num" onClick={() => setNav({ kind: 'detail', id: s.id })}>{N(s.duration_min)}</td>
                    <td className="num">
                      <input
                        className="cell-input"
                        type="number"
                        value={edits[s.id] !== undefined ? edits[s.id] : String(N(s.base_price))}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setEdits((p) => ({ ...p, [s.id]: e.target.value }))}
                      />
                    </td>
                    <td className="act">
                      <button
                        className="btn secondary"
                        style={{ width: 'auto', padding: '8px 12px', marginRight: 6 }}
                        disabled={busy || edits[s.id] === undefined}
                        onClick={(e) => { e.stopPropagation(); commitPrice(s) }}
                      >
                        แก้ราคา
                      </button>
                      <button
                        className="btn ghost"
                        style={{ width: 'auto', padding: '8px 12px', marginRight: 6 }}
                        disabled={busy}
                        onClick={(e) => { e.stopPropagation(); setNav({ kind: 'edit', s }) }}
                      >
                        แก้ไข
                      </button>
                      <button
                        className="btn ghost"
                        style={{ width: 'auto', padding: '8px 12px' }}
                        disabled={busy}
                        onClick={(e) => { e.stopPropagation(); removeService(s) }}
                      >
                        ลบ
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </>
    )
  }

  // owner-phone (read-only) + staff fallback: grouped read-only list
  if (list.length === 0) return <div className="empty"><div className="big"><Icon name="sparkles" size={32} /></div>ยังไม่มีบริการ</div>
  const cats = groupByCat(list)

  return (
    <>
      {ownerPhone && <ManageHint />}
      {Object.keys(cats).map((cat) => (
        <div key={cat}>
          <div className="section-title">{cat}</div>
          {cats[cat].map((s) => (
            <div className="svc" key={s.id}>
              <div className="grow">
                <span className="name" style={{ fontWeight: 600 }}>{s.name}</span>
                <div className="meta" style={{ fontSize: 13, color: 'var(--muted)' }}><span className="tnum">{N(s.duration_min)}</span> นาที</div>
              </div>
              <div className="price tnum">{baht(s.base_price)}</div>
            </div>
          ))}
        </div>
      ))}
    </>
  )
}

/* Service add/edit form (owner-large) */
function ServiceForm({ flash, s, categories, onDone, onCancel }) {
  const editing = !!s
  const [name, setName] = useState(s ? (s.name || '') : '')
  const [category, setCategory] = useState(s ? (s.category || '') : '')
  const [basePrice, setBasePrice] = useState(s ? String(N(s.base_price)) : '')
  const [durationMin, setDurationMin] = useState(s ? String(N(s.duration_min)) : '')
  const [description, setDescription] = useState(s ? (s.description || '') : '')
  const [active, setActive] = useState(s ? s.active !== false : true)
  const [saving, setSaving] = useState(false)

  const save = () => {
    if (!name.trim()) { flash('กรุณากรอกชื่อบริการ'); return }
    setSaving(true)
    const body = {
      name: name.trim(),
      category: category.trim() || undefined,
      base_price: N(basePrice),
      duration_min: durationMin === '' ? undefined : N(durationMin),
      description: description.trim() || undefined,
      active,
    }
    const req = editing ? api.updateService(s.id, body) : api.createService(body)
    req
      .then(() => { flash(editing ? 'บันทึกการแก้ไขแล้ว' : 'เพิ่มบริการสำเร็จ'); onDone() })
      .catch((e) => { setSaving(false); flash(e.status === 403 ? e.message : 'ผิดพลาด: ' + e.message) })
  }

  return (
    <div className="card">
      <label>ชื่อบริการ *</label>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น ทาเจลสีพื้น" />

      <label>หมวด</label>
      <input list="svc-cat-list" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="เช่น เจล, ต่อเล็บ, สปา" />
      <datalist id="svc-cat-list">
        {(categories || []).map((c) => <option key={c} value={c} />)}
      </datalist>

      <label>ราคา (บาท)</label>
      <input type="number" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} placeholder="0" />

      <label>เวลา (นาที)</label>
      <input type="number" value={durationMin} onChange={(e) => setDurationMin(e.target.value)} placeholder="0" />

      <label>รายละเอียด</label>
      <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="รายละเอียดงาน / เงื่อนไข / หมายเหตุ" rows={4} style={{ width: '100%', padding: '13px 14px', borderRadius: 12, border: '1px solid var(--line)', fontSize: 16, fontFamily: 'inherit', background: '#fff', color: 'var(--ink)', resize: 'vertical' }} />

      <label>สถานะ</label>
      <div className="btn-row" style={{ marginTop: 0 }}>
        <button className={'btn ' + (active ? '' : 'ghost')} onClick={() => setActive(true)}>ใช้งานอยู่</button>
        <button className={'btn ' + (!active ? 'dark' : 'ghost')} onClick={() => setActive(false)}>ปิดใช้งาน</button>
      </div>

      <div className="btn-row">
        <button className="btn ghost" disabled={saving} onClick={onCancel}>ยกเลิก</button>
        <button className="btn" disabled={saving} onClick={save}>{saving ? 'กำลังบันทึก...' : 'บันทึก'}</button>
      </div>
    </div>
  )
}

/* Service deep detail + add-on options manager (owner-large) */
function ServiceDetail({ id, flash, onBack, onEdit }) {
  const [s, setS] = useState(null)
  const [busy, setBusy] = useState(false)
  // add-on form
  const [oName, setOName] = useState('')
  const [oPrice, setOPrice] = useState('')
  const [oMin, setOMin] = useState('')
  // inline option edits: oid -> {name, price_delta, minute_delta}
  const [oEdits, setOEdits] = useState({})

  const load = () => api.serviceDetail(id).then(setS).catch(() => flash('โหลดบริการไม่สำเร็จ'))
  useEffect(() => { load() }, [id])

  if (!s) return <Loading />

  const options = s.options || []

  const addOpt = () => {
    if (!oName.trim()) { flash('กรอกชื่อ add-on'); return }
    setBusy(true)
    api.addOption(s.id, { name: oName.trim(), price_delta: N(oPrice), minute_delta: N(oMin) })
      .then(() => { setOName(''); setOPrice(''); setOMin(''); return load() })
      .then(() => { setBusy(false); flash('เพิ่ม add-on แล้ว') })
      .catch((e) => { setBusy(false); flash(e.status === 403 ? e.message : 'เพิ่มไม่สำเร็จ: ' + e.message) })
  }

  const startEdit = (o) => setOEdits((p) => ({ ...p, [o.id]: { name: o.name || '', price_delta: String(N(o.price_delta)), minute_delta: String(N(o.minute_delta)) } }))
  const cancelEdit = (oid) => setOEdits((p) => { const c = { ...p }; delete c[oid]; return c })
  const setEditField = (oid, k, v) => setOEdits((p) => ({ ...p, [oid]: { ...p[oid], [k]: v } }))

  const saveEdit = (o) => {
    const e = oEdits[o.id]
    if (!e) return
    setBusy(true)
    api.updateOption(s.id, o.id, { name: e.name.trim(), price_delta: N(e.price_delta), minute_delta: N(e.minute_delta) })
      .then(() => { cancelEdit(o.id); return load() })
      .then(() => { setBusy(false); flash('แก้ add-on แล้ว') })
      .catch((err) => { setBusy(false); flash(err.status === 403 ? err.message : 'แก้ไม่สำเร็จ: ' + err.message) })
  }

  const removeOpt = (o) => {
    if (typeof window !== 'undefined' && !window.confirm('ลบ add-on "' + o.name + '" ?')) return
    setBusy(true)
    api.deleteOption(s.id, o.id)
      .then(() => load())
      .then(() => { setBusy(false); flash('ลบ add-on แล้ว') })
      .catch((e) => { setBusy(false); flash(e.status === 403 ? e.message : 'ลบไม่สำเร็จ: ' + e.message) })
  }

  return (
    <>
      <div className="card">
        <div className="row">
          <div className="grow">
            <div className="name" style={{ fontSize: 18 }}>
              {s.name}
              {s.active === false && <span className="badge closed" style={{ marginLeft: 8 }}>ปิดใช้งาน</span>}
            </div>
            <div className="meta">{s.category || 'อื่นๆ'} · {baht(s.base_price)} · {N(s.duration_min)} นาที</div>
          </div>
          <button className="btn secondary" style={{ width: 'auto', padding: '8px 14px' }} onClick={() => onEdit(s)}><Icon name="pencil" size={20} /> แก้ไข</button>
        </div>
        {s.description && <div className="meta" style={{ marginTop: 10, whiteSpace: 'pre-wrap' }}>{s.description}</div>}
      </div>

      <div className="section-title">Add-on / ออปชันเสริม</div>
      {options.length === 0 ? (
        <div className="empty">ยังไม่มี add-on</div>
      ) : (
        options.map((o) => {
          const ed = oEdits[o.id]
          const inactive = o.active === false
          return (
            <div className="card" key={o.id}>
              {ed ? (
                <>
                  <label>ชื่อ</label>
                  <input value={ed.name} onChange={(e) => setEditField(o.id, 'name', e.target.value)} />
                  <label>+ราคา (บาท)</label>
                  <input type="number" value={ed.price_delta} onChange={(e) => setEditField(o.id, 'price_delta', e.target.value)} />
                  <label>+เวลา (นาที)</label>
                  <input type="number" value={ed.minute_delta} onChange={(e) => setEditField(o.id, 'minute_delta', e.target.value)} />
                  <div className="btn-row">
                    <button className="btn ghost" disabled={busy} onClick={() => cancelEdit(o.id)}>ยกเลิก</button>
                    <button className="btn" disabled={busy} onClick={() => saveEdit(o)}>บันทึก</button>
                  </div>
                </>
              ) : (
                <div className="row">
                  <div className="grow">
                    <div className="name" style={inactive ? { color: 'var(--muted)', textDecoration: 'line-through' } : undefined}>
                      {o.name}
                      {inactive && <span className="badge closed" style={{ marginLeft: 8 }}>ปิด</span>}
                    </div>
                    <div className="meta">+{baht(o.price_delta)} · +{N(o.minute_delta)} นาที</div>
                  </div>
                  <button className="btn secondary" style={{ width: 'auto', padding: '8px 12px', marginRight: 6 }} disabled={busy} onClick={() => startEdit(o)}>แก้</button>
                  <button className="btn ghost" style={{ width: 'auto', padding: '8px 12px' }} disabled={busy} onClick={() => removeOpt(o)}>ลบ</button>
                </div>
              )}
            </div>
          )
        })
      )}

      <div className="section-title">เพิ่ม add-on</div>
      <div className="card">
        <label>ชื่อ add-on</label>
        <input value={oName} onChange={(e) => setOName(e.target.value)} placeholder="เช่น เพิ่มลาย, ถอดเก่า" />
        <label>+ราคา (บาท)</label>
        <input type="number" value={oPrice} onChange={(e) => setOPrice(e.target.value)} placeholder="0" />
        <label>+เวลา (นาที)</label>
        <input type="number" value={oMin} onChange={(e) => setOMin(e.target.value)} placeholder="0" />
        <div className="btn-row">
          <button className="btn" disabled={busy} onClick={addOpt}><Icon name="plus" size={20} /> เพิ่ม add-on</button>
        </div>
      </div>

      <div className="spacer" />
      <div className="btn-row">
        <button className="btn ghost" onClick={onBack}><Icon name="chevron-left" size={20} /> กลับไปรายการบริการ</button>
      </div>
    </>
  )
}

/* ───────────────────────── Tickets list ───────────────────────── */
function Tickets({ openTicket }) {
  const [list, setList] = useState(null)
  useEffect(() => {
    api.tickets().then(setList).catch(() => setList([]))
  }, [])

  if (!list) return <Loading />
  if (list.length === 0) return <div className="empty"><div className="big"><Icon name="receipt" size={32} /></div>ยังไม่มีบิลที่เปิดอยู่</div>

  return (
    <>
      {list.map((t) => (
        <div className="li" key={t.id} onClick={() => openTicket(t.id)}>
          <div className="avatar">{(t.member_name || t.staff_name || '?').charAt(0).toUpperCase()}</div>
          <div className="grow">
            <div className="name">{t.member_name || 'ลูกค้าทั่วไป'}</div>
            <div className="meta">โดย {t.staff_name || '-'} · <StatusBadge status={t.status} /></div>
          </div>
          <div className="price tnum">{baht(t.total)}</div>
          <span className="chev"><Icon name="chevron-right" size={20} /></span>
        </div>
      ))}
    </>
  )
}

/* ───────────────────────── Queue board ───────────────────────── */
function QueueBoard({ flash, openTicket }) {
  const [q, setQ] = useState(null)

  const load = () => api.queue().then(setQ).catch(() => flash('โหลดคิวไม่สำเร็จ'))
  useEffect(() => {
    load()
    const iv = setInterval(load, 30000) // soft refresh
    return () => clearInterval(iv)
  }, [])

  if (!q) return <Loading />

  const techs = q.technicians || []
  const waiting = q.waiting || []

  return (
    <>
      <div className="section-title">ช่าง</div>
      {techs.length === 0 ? (
        <div className="empty"><div className="big"><Icon name="users" size={32} /></div>ยังไม่มีช่าง</div>
      ) : (
        techs.map((tech) => {
          const busy = tech.status === 'busy'
          return (
            <div className="li" key={tech.id}>
              <div className="avatar">{(tech.name || '?').charAt(0).toUpperCase()}</div>
              <div className="grow">
                <div className="name">{tech.name}</div>
                <div className="meta">
                  {busy ? (
                    <>
                      ติดถึง {fmtTime(tech.busy_until)} (เหลือ {N(tech.remaining_min)} นาที)
                      {tech.current_ticket_label ? ' · ' + tech.current_ticket_label : ''}
                    </>
                  ) : (
                    'พร้อมรับงาน'
                  )}
                </div>
              </div>
              <span className={'badge ' + (busy ? 'failed' : 'done')}>
                {busy ? 'ไม่ว่าง' : 'ว่าง'}
              </span>
            </div>
          )
        })
      )}

      <div className="section-title">รอคิว / กำลังทำ</div>
      {waiting.length === 0 ? (
        <div className="empty"><div className="big"><Icon name="sparkles" size={32} /></div>ไม่มีงานในคิว</div>
      ) : (
        waiting.map((w) => (
          <div className="li" key={w.ticket_id} onClick={() => openTicket(w.ticket_id)}>
            <div className="avatar">{(w.member_name || '?').charAt(0).toUpperCase()}</div>
            <div className="grow">
              <div className="name">{w.member_name || 'ลูกค้าทั่วไป'}</div>
              <div className="meta">
                ช่าง: {w.assigned_name || 'ยังไม่มอบหมาย'} · <Icon name="clock" size={14} className="ico-inline" /> ~<span className="tnum">{N(w.est_minutes)}</span> นาที
              </div>
            </div>
            <span className="chev"><Icon name="chevron-right" size={20} /></span>
          </div>
        ))
      )}
    </>
  )
}

/* ───────────────────────── New ticket ───────────────────────── */
function NewTicket({ flash, preMember, onCreated }) {
  const [members, setMembers] = useState(null)
  const [memberId, setMemberId] = useState(preMember ? String(preMember) : '')
  const [techs, setTechs] = useState([]) // [{id,name,role}]
  const [techStatus, setTechStatus] = useState({}) // userId -> {status, busy_until}
  const [assignId, setAssignId] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    api.members().then(setMembers).catch(() => setMembers([]))
    // owner = manager only (cannot take jobs) → technician picker = staff only
    api.authUsers().then((us) => setTechs((us || []).filter((u) => u.role === 'staff'))).catch(() => setTechs([]))
    api.queue()
      .then((q) => {
        const map = {}
        ;(q.technicians || []).forEach((t) => { map[t.id] = t })
        setTechStatus(map)
      })
      .catch(() => setTechStatus({}))
  }, [])

  // busy info for the currently-selected technician (override allowed)
  const selBusy = assignId && techStatus[Number(assignId)] && techStatus[Number(assignId)].status === 'busy'
    ? techStatus[Number(assignId)]
    : null

  const create = () => {
    setCreating(true)
    const body = {}
    if (memberId) body.member_id = Number(memberId)
    if (assignId) {
      body.assigned_user_id = Number(assignId)
      const tech = techs.find((t) => N(t.id) === N(assignId))
      if (tech) body.staff_name = tech.name
    }
    api.newTicket(body)
      .then((t) => { flash('เปิดบิลแล้ว'); onCreated(t) })
      .catch((e) => { setCreating(false); flash('ผิดพลาด: ' + e.message) })
  }

  return (
    <div className="card">
      <label>ลูกค้า (เว้นว่างได้ = ลูกค้าทั่วไป)</label>
      <select value={memberId} onChange={(e) => setMemberId(e.target.value)}>
        <option value="">— ลูกค้าทั่วไป (Walk-in) —</option>
        {(members || []).map((m) => (
          <option key={m.id} value={m.id}>{m.name}{m.phone ? ' · ' + m.phone : ''}</option>
        ))}
      </select>
      <label>ช่าง (มอบหมาย)</label>
      <select value={assignId} onChange={(e) => setAssignId(e.target.value)}>
        <option value="">— ยังไม่มอบหมาย —</option>
        {techs.map((tech) => {
          const ts = techStatus[tech.id]
          const isBusy = ts && ts.status === 'busy'
          return (
            <option key={tech.id} value={tech.id}>
              {tech.name}{isBusy ? ' (ไม่ว่าง)' : ''}
            </option>
          )
        })}
      </select>
      {selBusy && (
        <div className="note-warn">
          <Icon name="alert-triangle" size={18} className="ico-inline" /> ช่างไม่ว่างถึง {fmtTime(selBusy.busy_until)} — มอบหมายได้ (เข้าคิว)
        </div>
      )}
      <div className="btn-row">
        <button className="btn" disabled={creating} onClick={create}>{creating ? 'กำลังเปิด...' : 'เปิดบิล'}</button>
      </div>
    </div>
  )
}

/* ───────────────────────── Ticket / checkout ───────────────────────── */
function TicketView({ id, flash, isOwner, canManage, ownerPhone, onClosed }) {
  // owner-on-phone = read-only summary: hide all mutate controls
  const readOnly = !!ownerPhone
  const [t, setT] = useState(null)
  const [services, setServices] = useState([])
  const [busy, setBusy] = useState(false)
  const [edcStep, setEdcStep] = useState(false) // showing EDC simulate buttons
  const [payFail, setPayFail] = useState(false) // EDC failed -> show fallback
  const [priceEdits, setPriceEdits] = useState({}) // itemId -> string
  const [minutesEdits, setMinutesEdits] = useState({}) // itemId -> string
  const [optSel, setOptSel] = useState({}) // itemId -> { [optionId]: true } selected add-ons
  const [techs, setTechs] = useState([]) // [{id,name,role}] for assign prompt
  const [reconcile, setReconcile] = useState(null) // pid that needs manual reconcile (key expired)

  const refresh = () => api.ticket(id).then(setT)

  const voidPay = (p) => {
    setBusy(true)
    api.voidPayment(id, p.id)
      .then((d) => { setT(d); setBusy(false); flash('ยกเลิกการชำระแล้ว') })
      .catch((e) => { setBusy(false); flash('ยกเลิกไม่สำเร็จ: ' + e.message) })
  }

  const retryPay = (p, simulate) => {
    setBusy(true)
    setReconcile(null)
    api.retryEdc(id, p.id, simulate)
      .then((d) => { setT(d); setBusy(false); flash('รูดบัตรใหม่สำเร็จ') })
      .catch((e) => {
        setBusy(false)
        if (e.status === 409 && e.body && e.body.error === 'idempotency_key_expired') {
          setReconcile(p.id)
          flash('คีย์หมดอายุ (>12 ชม.) — ต้อง reconcile เอง')
        } else {
          flash('รูดบัตรใหม่ไม่สำเร็จ: ' + e.message)
        }
      })
  }

  useEffect(() => {
    api.ticket(id).then(setT).catch(() => flash('โหลดบิลไม่สำเร็จ'))
    api.services().then(setServices).catch(() => setServices([]))
    // owner = manager only (cannot take jobs) → start/assign picker = staff only
    api.authUsers().then((us) => setTechs((us || []).filter((u) => u.role === 'staff'))).catch(() => setTechs([]))
  }, [id])

  if (!t) return <Loading />

  const total = N(t.total)
  const paid = N(t.paid)
  const isPaid = paid >= total && total > 0
  const isClosed = t.status === 'closed'
  const items = t.items || []
  const payments = t.payments || []
  const quote = t.quote
  const inProgress = t.status === 'in_progress'
  const estMinutes = N(t.est_minutes) || items.reduce((a, it) => a + N(it.minutes) * (N(it.qty) || 1), 0)
  const itemCount = (sid) => items.filter((it) => N(it.service_id) === N(sid)).reduce((a, it) => a + N(it.qty), 0)

  // edit per-item service time
  const commitMinutes = (it) => {
    const raw = minutesEdits[it.id]
    if (raw === undefined) return
    const newMin = N(raw)
    if (newMin === N(it.minutes)) {
      setMinutesEdits((p) => { const c = { ...p }; delete c[it.id]; return c })
      return
    }
    setBusy(true)
    api.updateItem(id, it.id, { minutes: newMin })
      .then((d) => {
        setT(d); setBusy(false)
        setMinutesEdits((p) => { const c = { ...p }; delete c[it.id]; return c })
        flash('แก้เวลาแล้ว')
      })
      .catch((e) => { setBusy(false); flash('แก้เวลาไม่สำเร็จ: ' + e.message) })
  }

  // add-on options for a cart item, looked up from the loaded services list by service_id
  const optionsForItem = (it) => {
    const svc = services.find((s) => N(s.id) === N(it.service_id))
    return (svc && svc.options) || []
  }

  // toggle an add-on on a cart item → recompute quoted_price + minutes and persist.
  // base = service base_price/duration_min; quoted = base + Σ(checked price_delta), minutes = base_min + Σ(checked minute_delta)
  const toggleOption = (it, opt) => {
    const svc = services.find((s) => N(s.id) === N(it.service_id))
    if (!svc) return
    const cur = optSel[it.id] || {}
    const next = { ...cur }
    if (next[opt.id]) delete next[opt.id]
    else next[opt.id] = true
    const opts = optionsForItem(it)
    let priceSum = 0
    let minSum = 0
    opts.forEach((o) => {
      if (next[o.id]) { priceSum += N(o.price_delta); minSum += N(o.minute_delta) }
    })
    const newPrice = N(svc.base_price) + priceSum
    const newMinutes = N(svc.duration_min) + minSum
    setOptSel((p) => ({ ...p, [it.id]: next }))
    setBusy(true)
    api.updateItem(id, it.id, { quoted_price: newPrice, minutes: newMinutes })
      .then((d) => { setT(d); setBusy(false) })
      .catch((e) => {
        // revert selection on failure
        setOptSel((p) => ({ ...p, [it.id]: cur }))
        setBusy(false)
        flash('ปรับออปชันไม่สำเร็จ: ' + e.message)
      })
  }

  // start work: needs an assigned tech; if none, prompt to pick one
  const startWork = () => {
    if (!t.assigned_user_id) {
      const names = techs.map((u, i) => `${i + 1}. ${u.name}`).join('\n')
      const pick = typeof window !== 'undefined'
        ? window.prompt('ยังไม่ได้มอบหมายช่าง — พิมพ์เลขช่างเพื่อเริ่มงาน:\n' + names)
        : null
      if (!pick) { flash('กรุณามอบหมายช่างก่อนเริ่มงาน'); return }
      const idx = Number(pick) - 1
      const chosen = techs[idx]
      if (!chosen) { flash('เลือกช่างไม่ถูกต้อง'); return }
      setBusy(true)
      api.startTicket(id, chosen.id)
        .then((d) => { setT(d); setBusy(false); flash('เริ่มงานแล้ว') })
        .catch((e) => { setBusy(false); flash('เริ่มงานไม่สำเร็จ: ' + e.message) })
      return
    }
    setBusy(true)
    api.startTicket(id)
      .then((d) => { setT(d); setBusy(false); flash('เริ่มงานแล้ว') })
      .catch((e) => { setBusy(false); flash('เริ่มงานไม่สำเร็จ: ' + e.message) })
  }

  const addService = (s) => {
    setBusy(true)
    api.addItem(id, { service_id: s.id, qty: 1, quoted_price: N(s.base_price) })
      .then((d) => { setT(d); setBusy(false) })
      .catch((e) => { setBusy(false); flash('เพิ่มไม่สำเร็จ: ' + e.message) })
  }

  const removeOneOfService = (s) => {
    // remove the last matching item
    const matches = items.filter((it) => N(it.service_id) === N(s.id))
    if (matches.length === 0) return
    const last = matches[matches.length - 1]
    setBusy(true)
    api.delItem(id, last.id)
      .then((d) => { setT(d); setBusy(false) })
      .catch((e) => { setBusy(false); flash('ลบไม่สำเร็จ: ' + e.message) })
  }

  const removeItem = (itemId) => {
    setBusy(true)
    api.delItem(id, itemId)
      .then((d) => { setT(d); setBusy(false) })
      .catch((e) => { setBusy(false); flash('ลบไม่สำเร็จ: ' + e.message) })
  }

  // editing quoted price: re-add a fresh item with the new price then drop old one
  const commitPrice = (it) => {
    const raw = priceEdits[it.id]
    if (raw === undefined) return
    const newPrice = N(raw)
    if (newPrice === N(it.quoted_price)) {
      setPriceEdits((p) => { const c = { ...p }; delete c[it.id]; return c })
      return
    }
    setBusy(true)
    api.addItem(id, { service_id: it.service_id, qty: N(it.qty) || 1, quoted_price: newPrice, note: it.note || undefined })
      .then(() => api.delItem(id, it.id))
      .then((d) => {
        setT(d); setBusy(false)
        setPriceEdits((p) => { const c = { ...p }; delete c[it.id]; return c })
        flash('แก้ราคาแล้ว')
      })
      .catch((e) => { setBusy(false); flash('แก้ราคาไม่สำเร็จ: ' + e.message) })
  }

  const sendQuote = () => {
    setBusy(true)
    api.sendQuote(id)
      .then((d) => { setT(d); setBusy(false); flash('ส่งสรุปราคาทาง LINE แล้ว') })
      .catch((e) => { setBusy(false); flash('ส่งไม่สำเร็จ: ' + e.message) })
  }

  const confirmQuote = () => {
    setBusy(true)
    api.confirmQuote(id)
      .then((d) => { setT(d); setBusy(false); flash('ลูกค้ายืนยันแล้ว') })
      .catch((e) => { setBusy(false); flash('ยืนยันไม่สำเร็จ: ' + e.message) })
  }

  const doPay = (method, simulate) => {
    setBusy(true)
    const body = { method, amount: total }
    if (simulate) body.simulate = simulate
    api.pay(id, body)
      .then((d) => {
        setT(d); setBusy(false); setEdcStep(false)
        // server returns 200 even when an EDC charge fails — detect via the row status
        const last = (d.payments || [])[(d.payments || []).length - 1]
        if (method === 'beam_edc' && last && last.status === 'failed') {
          setPayFail(true)
          flash('EDC ล้มเหลว — เลือก fallback')
          return
        }
        setPayFail(false)
        if (method === 'cash') flash('ชำระเงินสดสำเร็จ')
        else if (method === 'beam_edc') flash('ชำระผ่านบัตรสำเร็จ')
        else flash('บันทึกเป็นค้างชำระแล้ว')
      })
      .catch((e) => {
        setBusy(false)
        if (method === 'beam_edc') {
          setPayFail(true)
          setEdcStep(false)
          flash('EDC ล้มเหลว — เลือก fallback')
        } else {
          flash('ชำระไม่สำเร็จ: ' + e.message)
        }
        // refresh to capture failed payment row if backend stored it
        refresh().catch(() => {})
      })
  }

  const closeBill = () => {
    setBusy(true)
    api.close(id)
      .then((d) => { setT(d); setBusy(false); flash('ปิดบิลเรียบร้อย') })
      .catch((e) => { setBusy(false); flash('ปิดบิลไม่สำเร็จ: ' + e.message) })
  }

  /* If already closed → show receipt only */
  if (isClosed) {
    return <Receipt t={t} />
  }

  return (
    <>
      {/* header card */}
      <div className="card">
        <div className="row">
          <div className="grow">
            <div className="name" style={{ fontSize: 17 }}>
              {t.member ? t.member.name : 'ลูกค้าทั่วไป (Walk-in)'}
            </div>
            <div className="meta">ช่าง: {t.assigned_name || t.staff_name || '-'} · บิล #{t.id}</div>
          </div>
          <StatusBadge status={t.status} />
        </div>
        {t.busy_until && (
          <div className="meta" style={{ marginTop: 8 }}>
            <Icon name="clock" size={14} className="ico-inline" /> เสร็จโดยประมาณ {fmtTime(t.busy_until)}
            {t.est_minutes ? ' (~' + N(t.est_minutes) + ' นาที)' : ''}
          </div>
        )}
        {!readOnly && !t.started_at && !isClosed && items.length > 0 && (
          <div className="btn-row">
            <button className="btn" disabled={busy} onClick={startWork}><Icon name="play" size={20} /> เริ่มงาน</button>
          </div>
        )}
      </div>

      {readOnly && <ManageHint />}

      {/* ITEMS in cart */}
      <div className="section-title">รายการในบิล</div>
      {items.length === 0 ? (
        <div className="empty">{readOnly ? 'ยังไม่มีรายการ' : 'ยังไม่มีรายการ — เลือกบริการด้านล่าง'}</div>
      ) : readOnly ? (
        items.map((it) => (
          <div className="li" key={it.id}>
            <div className="grow">
              <div className="name">{it.service_name} {it.category && <span className="cat" style={{ fontSize: 12, color: 'var(--rose-dark)', background: 'var(--rose-soft)', padding: '2px 8px', borderRadius: 6 }}>{it.category}</span>}</div>
              <div className="meta">จำนวน <span className="tnum">{N(it.qty)}</span> · <Icon name="clock" size={14} className="ico-inline" /> <span className="tnum">{N(it.minutes)}</span> นาที</div>
            </div>
            <div className="price tnum">{baht(N(it.quoted_price) * N(it.qty))}</div>
          </div>
        ))
      ) : (
        items.map((it) => (
          <div className="card" key={it.id}>
            <div className="row">
              <div className="grow">
                <div className="name">{it.service_name} {it.category && <span className="cat" style={{ fontSize: 12, color: 'var(--rose-dark)', background: 'var(--rose-soft)', padding: '2px 8px', borderRadius: 6 }}>{it.category}</span>}</div>
                <div className="meta">จำนวน <span className="tnum">{N(it.qty)}</span> · <Icon name="clock" size={14} className="ico-inline" /> <span className="tnum">{N(it.minutes)}</span> นาที</div>
              </div>
              <button className="btn ghost" style={{ width: 'auto', padding: '8px 12px' }} onClick={() => removeItem(it.id)}>ลบ</button>
            </div>
            <label>เสนอราคา (บาท)</label>
            <div className="row">
              <input
                type="number"
                value={priceEdits[it.id] !== undefined ? priceEdits[it.id] : String(N(it.quoted_price))}
                onChange={(e) => setPriceEdits((p) => ({ ...p, [it.id]: e.target.value }))}
              />
              <button
                className="btn secondary"
                style={{ width: 'auto', padding: '8px 14px' }}
                disabled={busy || priceEdits[it.id] === undefined}
                onClick={() => commitPrice(it)}
              >
                แก้
              </button>
            </div>
            <label>เวลา (นาที)</label>
            <div className="row">
              <input
                type="number"
                value={minutesEdits[it.id] !== undefined ? minutesEdits[it.id] : String(N(it.minutes))}
                onChange={(e) => setMinutesEdits((p) => ({ ...p, [it.id]: e.target.value }))}
              />
              <button
                className="btn secondary"
                style={{ width: 'auto', padding: '8px 14px' }}
                disabled={busy || minutesEdits[it.id] === undefined}
                onClick={() => commitMinutes(it)}
              >
                แก้
              </button>
            </div>
            {optionsForItem(it).length > 0 && (
              <>
                <label>ออปชันเสริม (Add-on)</label>
                {optionsForItem(it).map((o) => {
                  const checked = !!(optSel[it.id] && optSel[it.id][o.id])
                  return (
                    <label key={o.id} className="opt-check" style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '6px 2px', color: 'var(--ink)', fontWeight: 500 }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={busy}
                        onChange={() => toggleOption(it, o)}
                        style={{ width: 'auto', margin: 0 }}
                      />
                      <span className="grow">{o.name} <span className="meta">(+{baht(o.price_delta)} / +{N(o.minute_delta)}min)</span></span>
                    </label>
                  )
                })}
              </>
            )}
          </div>
        ))
      )}

      {/* SERVICE PICKER — hidden in read-only summary */}
      {!readOnly && (
        <>
          <div className="section-title">เพิ่มบริการ</div>
          {services.length === 0 ? (
            <div className="empty">ไม่มีบริการ</div>
          ) : (
            services.map((s) => {
              const c = itemCount(s.id)
              return (
                <div className="svc" key={s.id}>
                  <div className="grow">
                    <span style={{ fontWeight: 600 }}>{s.name}</span>
                    {s.category && <span className="cat">{s.category}</span>}
                    <div className="meta tnum" style={{ fontSize: 13, color: 'var(--muted)' }}>{baht(s.base_price)} · {N(s.duration_min)} นาที</div>
                  </div>
                  <button disabled={busy || c === 0} onClick={() => removeOneOfService(s)} aria-label="ลดจำนวน"><Icon name="minus" size={20} /></button>
                  <span className="tnum" style={{ minWidth: 22, textAlign: 'center', fontWeight: 700 }}>{c}</span>
                  <button disabled={busy} onClick={() => addService(s)} aria-label="เพิ่มจำนวน"><Icon name="plus" size={20} /></button>
                </div>
              )
            })
          )}
        </>
      )}

      {/* TOTAL */}
      <div className="total-bar">
        <div className="t">ยอดรวม</div>
        <div className="v tnum">{baht(total)}</div>
      </div>
      {estMinutes > 0 && (
        <div className="meta center" style={{ marginTop: 2 }}><Icon name="clock" size={14} className="ico-inline" /> ~<span className="tnum">{estMinutes}</span> นาที</div>
      )}

      {/* LINE QUOTE STEP */}
      {!(readOnly && !quote) && <div className="section-title">สรุปราคาทาง LINE</div>}
      {readOnly && !quote ? null : !quote ? (
        <button className="btn dark" disabled={busy || items.length === 0} onClick={sendQuote}>
          <Icon name="send" size={20} /> ส่งสรุปราคาทาง LINE
        </button>
      ) : (
        <>
          <div className="line-chat">
            <div className="line-head"><Icon name="message-circle" size={16} /> {t.member ? t.member.name : 'ลูกค้า'}</div>
            <div className="line-bubble me">
              สรุปราคาบริการค่ะ 💅<br />
              {items.map((it) => (
                <span key={it.id}>• {it.service_name} ×{N(it.qty)} — {baht(N(it.quoted_price) * N(it.qty))}<br /></span>
              ))}
              <b>รวม {baht(N(quote.quoted_total) || total)}</b>
            </div>
            {quote.confirmed_at ? (
              <div className="line-bubble" style={{ marginTop: 8 }}>ยืนยันค่ะ ✅</div>
            ) : (
              <div className="muted center" style={{ fontSize: 12, marginTop: 8, color: '#fff' }}>ส่งเมื่อ {fmtDate(quote.sent_at)} · รอลูกค้ายืนยัน</div>
            )}
          </div>
          {quote.confirmed_at ? (
            <div className="center muted" style={{ marginTop: 10 }}>ลูกค้ายืนยันแล้ว <Icon name="check-circle" size={16} className="ico-inline ico-ok" /> ({fmtDate(quote.confirmed_at)})</div>
          ) : readOnly ? null : (
            <div className="btn-row">
              <button className="btn" disabled={busy} onClick={confirmQuote}><Icon name="check" size={20} /> ลูกค้า Confirm</button>
            </div>
          )}
        </>
      )}

      {/* PAYMENT (after quote confirmed, or allow anyway if items exist) */}
      {items.length > 0 && (
        <>
          <div className="section-title">การชำระเงิน</div>

          {payments.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              {payments.map((p) => {
                const st = p.status || 'pending'
                const isVoided = st === 'voided'
                const canRetry = p.method === 'beam_edc' && (st === 'pending' || st === 'failed')
                return (
                  <div key={p.id}>
                    <div className="li">
                      <div className="grow">
                        <div className="name" style={isVoided ? { textDecoration: 'line-through', color: 'var(--muted)' } : undefined}>{payMethodTH(p.method)} #{p.payment_seq}</div>
                        <div className="meta">{fmtDate(p.created_at)}</div>
                      </div>
                      {isVoided ? (
                        <span className="badge closed">ยกเลิกแล้ว</span>
                      ) : (
                        <span className={'badge ' + st}>{st}</span>
                      )}
                      <div className="price tnum" style={{ marginLeft: 8 }}>{baht(p.amount)}</div>
                    </div>
                    {!readOnly && !isVoided && (canRetry || canManage) && (
                      <div className="btn-row" style={{ marginTop: 6 }}>
                        {canRetry && (
                          <button className="btn secondary" style={{ width: 'auto', padding: '8px 14px' }} disabled={busy} onClick={() => retryPay(p)}><Icon name="rotate-ccw" size={20} /> ลองรูดอีกครั้ง</button>
                        )}
                        {canManage && (
                          <button className="btn ghost" style={{ width: 'auto', padding: '8px 14px' }} disabled={busy} onClick={() => voidPay(p)}>ยกเลิก</button>
                        )}
                      </div>
                    )}
                    {reconcile === p.id && (
                      <div className="card" style={{ marginTop: 6, borderColor: 'var(--bad)' }}>
                        <div style={{ color: 'var(--bad)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="alert-triangle" size={18} /> คีย์หมดอายุ (&gt;12 ชม.)</div>
                        <div className="meta" style={{ marginTop: 4 }}>ต้อง reconcile เอง — ตรวจสอบกับเครื่อง EDC/ธนาคารก่อนทำรายการใหม่</div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {!readOnly && !isPaid && (
            edcStep ? (
              <div className="card">
                <div className="center" style={{ color: 'var(--accent)' }}><Icon name="credit-card" size={32} /></div>
                <div className="center muted" style={{ marginBottom: 10 }}>กำลังรูดบัตรผ่านเครื่อง Beam EDC / Bolt...</div>
                <div className="btn-row">
                  <button className="btn" disabled={busy} onClick={() => doPay('beam_edc')}><Icon name="check" size={20} /> จำลองสำเร็จ</button>
                  <button className="btn dark" disabled={busy} onClick={() => doPay('beam_edc', 'fail')}><Icon name="alert-triangle" size={20} /> จำลองล้มเหลว</button>
                </div>
                <div className="btn-row">
                  <button className="btn ghost" disabled={busy} onClick={() => setEdcStep(false)}>ยกเลิก</button>
                </div>
              </div>
            ) : payFail ? (
              <div className="card">
                <div className="center" style={{ color: 'var(--danger)' }}><Icon name="alert-triangle" size={28} /></div>
                <div className="center" style={{ color: 'var(--bad)', fontWeight: 700 }}>EDC ล้มเหลว</div>
                <div className="center muted" style={{ marginBottom: 10 }}>บิลไม่ค้าง — เลือกวิธีสำรองได้เลย</div>
                <div className="pay-grid">
                  <div className="pay" onClick={() => doPay('cash')}>
                    <div className="ico"><Icon name="banknote" size={20} /></div>
                    <div className="grow"><div>เงินสด</div><div className="desc">รับเป็นเงินสด</div></div>
                    <div className="price tnum">{baht(total)}</div>
                  </div>
                  <div className="pay" onClick={() => doPay('unpaid')}>
                    <div className="ico"><Icon name="clock" size={20} /></div>
                    <div className="grow"><div>ค้างชำระ</div><div className="desc">ไว้จ่ายภายหลัง</div></div>
                  </div>
                  <div className="pay" onClick={() => { setPayFail(false); setEdcStep(true) }}>
                    <div className="ico"><Icon name="rotate-ccw" size={20} /></div>
                    <div className="grow"><div>ลองรูดบัตรอีกครั้ง</div><div className="desc">Beam EDC</div></div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="pay-grid">
                <div className="pay" onClick={() => doPay('cash')}>
                  <div className="ico"><Icon name="banknote" size={20} /></div>
                  <div className="grow"><div>เงินสด</div><div className="desc">Cash</div></div>
                  <div className="price tnum">{baht(total)}</div>
                </div>
                <div className="pay" onClick={() => setEdcStep(true)}>
                  <div className="ico"><Icon name="credit-card" size={20} /></div>
                  <div className="grow"><div>บัตร (Beam EDC)</div><div className="desc">รูดบัตรเครดิต/เดบิต</div></div>
                </div>
                <div className="pay" onClick={() => doPay('unpaid')}>
                  <div className="ico"><Icon name="clock" size={20} /></div>
                  <div className="grow"><div>ค้างชำระ</div><div className="desc">Unpaid</div></div>
                </div>
              </div>
            )
          )}

          {isPaid && (
            <div className="center" style={{ color: 'var(--ok)', fontWeight: 700, margin: '8px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><Icon name="check-circle" size={18} /> ชำระครบแล้ว <span className="tnum">{baht(paid)}</span></div>
          )}
        </>
      )}

      {/* CLOSE — available once paid OR an unpaid record exists (bill not stuck) */}
      {!readOnly && (isPaid || payments.length > 0) && (
        <div className="btn-row">
          <button className="btn dark" disabled={busy} onClick={closeBill}><Icon name="receipt" size={20} /> ปิดบิล / Close</button>
        </div>
      )}
      <div className="spacer" />
    </>
  )
}

function Receipt({ t }) {
  const items = t.items || []
  const total = N(t.total)
  const paid = N(t.paid)
  const payments = t.payments || []
  const lastPay = payments[payments.length - 1]
  return (
    <>
      <div className="receipt">
        <h2>Lazy Nail Salon</h2>
        <div className="shop">ใบเสร็จรับเงิน · บิล #{t.id}</div>
        <div className="rl"><span>ลูกค้า</span><span>{t.member ? t.member.name : 'ลูกค้าทั่วไป'}</span></div>
        <div className="rl"><span>ช่าง</span><span>{t.staff_name || '-'}</span></div>
        <div className="rl"><span>วันที่</span><span>{fmtDate(t.closed_at || t.created_at)}</span></div>
        <div className="div" />
        {items.map((it) => (
          <div className="rl" key={it.id}>
            <span>{it.service_name} ×{N(it.qty)}</span>
            <span className="tnum">{baht(N(it.quoted_price) * N(it.qty))}</span>
          </div>
        ))}
        <div className="div" />
        <div className="rl grand"><span>รวมทั้งสิ้น</span><span className="tnum">{baht(total)}</span></div>
        <div className="rl"><span>ชำระแล้ว</span><span className="tnum">{baht(paid)}</span></div>
        {lastPay && (
          <div className="rl"><span>วิธีชำระ</span><span>{payMethodTH(lastPay.method)} <span className={'badge ' + (lastPay.status || 'pending')}>{lastPay.status || 'pending'}</span></span></div>
        )}
        <div className="thanks">ขอบคุณที่ใช้บริการค่ะ 💅</div>
      </div>
      <div className="spacer" />
      <div className="center muted">บิลนี้ปิดแล้ว <span className="badge closed">ปิดบิล</span></div>
    </>
  )
}

/* ───────────────────────── Login + PIN pad ───────────────────────── */
function RoleBadge({ role }) {
  const cls = role === 'owner' ? 'role-owner' : 'role-staff'
  return <span className={'badge rolebadge ' + cls}>{roleTH[role] || role}</span>
}

/* reusable PIN pad (dots + keypad). Used by login PIN step and signup form. */
function PinPad({ pin, busy, err, onPress, onBack, onSubmit, minLen = 4, okLabel = '✓' }) {
  return (
    <>
      <div className="pin-dots">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <span key={i} className={'pin-dot' + (i < pin.length ? ' filled' : '')} />
        ))}
      </div>

      {err && <div className="pin-err">{err}</div>}

      <div className="pinpad">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button key={d} className="pinkey" disabled={busy} onClick={() => onPress(d)}>{d}</button>
        ))}
        <button className="pinkey ghost" disabled={busy || pin.length === 0} onClick={onBack} aria-label="ลบ"><Icon name="delete" size={26} /></button>
        <button className="pinkey" disabled={busy} onClick={() => onPress('0')}>0</button>
        <button className="pinkey ok" disabled={busy || pin.length < minLen} onClick={onSubmit} aria-label="ยืนยัน">{busy ? '…' : (okLabel === '✓' ? <Icon name="check" size={28} /> : okLabel)}</button>
      </div>
    </>
  )
}

/*
 * Multi-tenant login step machine:
 *   step 'shop'   → pick a shop (list from shops()) or type a shop code → load that store's users
 *   step 'user'   → pick a user of the chosen shop (scoped) → go to pin
 *   step 'pin'    → PIN pad → login() → enter app
 *   step 'signup' → new-shop form → signup() → show shop code → back to 'shop' (pre-selected)
 */
function Login({ onLoggedIn }) {
  const [step, setStep] = useState('shop') // 'shop' | 'user' | 'pin' | 'signup'

  // shop step
  const [shops, setShops] = useState(null)
  const [shop, setShop] = useState(null) // chosen {id,code,name}
  const [code, setCode] = useState('') // typed shop code
  const [shopErr, setShopErr] = useState('')
  const [lookingUp, setLookingUp] = useState(false)

  // user step
  const [users, setUsers] = useState(null)
  const [picked, setPicked] = useState(null) // selected user {id,name,role}

  // pin step
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  // signup step
  const [shopName, setShopName] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [ownerPin, setOwnerPin] = useState('')
  const [signupBusy, setSignupBusy] = useState(false)
  const [signupErr, setSignupErr] = useState('')
  const [newCode, setNewCode] = useState('') // returned shop code banner

  useEffect(() => {
    api.shops().then(setShops).catch(() => setShops([]))
  }, [])

  // choose a shop (from list or by code) → load its users, go to user step
  const chooseShop = (s) => {
    setShop(s)
    setUsers(null)
    setPicked(null)
    setPin('')
    setErr('')
    setStep('user')
    api.authUsers(s.id).then(setUsers).catch(() => setUsers([]))
  }

  const lookupByCode = () => {
    const c = code.trim()
    if (!c) { setShopErr('กรุณาใส่ Shop code'); return }
    setShopErr('')
    const found = (shops || []).find((s) => String(s.code).toLowerCase() === c.toLowerCase())
    if (found) { chooseShop(found); return }
    // not in the loaded list → refetch and retry once (covers a just-created shop)
    setLookingUp(true)
    api.shops()
      .then((list) => {
        setShops(list)
        const f = (list || []).find((s) => String(s.code).toLowerCase() === c.toLowerCase())
        setLookingUp(false)
        if (f) chooseShop(f)
        else setShopErr('ไม่พบร้านรหัสนี้')
      })
      .catch(() => { setLookingUp(false); setShopErr('ค้นหาร้านไม่สำเร็จ') })
  }

  const backToShop = () => {
    setStep('shop')
    setShop(null)
    setUsers(null)
    setPicked(null)
    setPin('')
    setErr('')
  }

  const press = (d) => {
    setErr('')
    setPin((p) => (p.length >= 6 ? p : p + d))
  }
  const back = () => { setErr(''); setPin((p) => p.slice(0, -1)) }

  const submit = () => {
    if (!picked || pin.length < 4) return
    setBusy(true)
    setErr('')
    api.login(picked.id, pin)
      .then((res) => { setBusy(false); onLoggedIn(res.token, res.user) })
      .catch((e) => {
        setBusy(false)
        setPin('')
        setErr(e.status === 401 ? 'PIN ไม่ถูกต้อง' : 'เข้าสู่ระบบไม่สำเร็จ')
      })
  }

  // signup PIN pad handlers
  const pinPress = (d) => { setSignupErr(''); setOwnerPin((p) => (p.length >= 6 ? p : p + d)) }
  const pinBack = () => { setSignupErr(''); setOwnerPin((p) => p.slice(0, -1)) }

  const doSignup = () => {
    if (!shopName.trim()) { setSignupErr('กรุณากรอกชื่อร้าน'); return }
    if (!ownerName.trim()) { setSignupErr('กรุณากรอกชื่อเจ้าของ'); return }
    if (ownerPin.length < 4) { setSignupErr('PIN ต้องมี 4–6 หลัก'); return }
    setSignupBusy(true)
    setSignupErr('')
    api.signup({ shop_name: shopName.trim(), owner_name: ownerName.trim(), owner_pin: ownerPin })
      .then((res) => {
        setSignupBusy(false)
        const store = res.store || {}
        setNewCode(store.code || '')
        // pre-select the new shop and route back to the shop step so they can log in
        setShops((prev) => {
          const list = prev || []
          return list.some((s) => s.id === store.id) ? list : [...list, store]
        })
        // reset signup inputs
        setShopName('')
        setOwnerName('')
        setOwnerPin('')
        setStep('shop')
      })
      .catch((e) => {
        setSignupBusy(false)
        setSignupErr('สมัครไม่สำเร็จ: ' + e.message)
      })
  }

  return (
    <div className="login">
      <div className="login-head">
        <Logo className="login-logo" />
        <h1>Lazy Nail POS</h1>
        <div className="sub">
          {step === 'shop' ? 'กรอกรหัสร้านเพื่อเข้าสู่ระบบ'
            : step === 'signup' ? 'สมัครร้านใหม่'
            : step === 'user' ? 'เลือกผู้ใช้ของร้าน'
            : 'ใส่ PIN เพื่อเข้าสู่ระบบ'}
        </div>
      </div>

      {step === 'shop' ? (
        <div className="login-body">
          {newCode && (
            <div className="note-ok shop-code-banner">
              <Icon name="check-circle" size={18} className="ico-inline" /> สร้างร้านสำเร็จ — ร้านของคุณคือรหัส: <b>{newCode}</b>
              <div className="meta" style={{ marginTop: 4 }}>กรอกรหัสร้านด้านล่างแล้วเข้าสู่ระบบด้วย PIN เจ้าของ</div>
            </div>
          )}

          <div className="section-title">รหัสร้าน (Shop code)</div>
          <input
            value={code}
            onChange={(e) => { setShopErr(''); setCode(e.target.value) }}
            placeholder="เช่น ABCD"
            onKeyDown={(e) => { if (e.key === 'Enter') lookupByCode() }}
          />
          {shopErr && <div className="pin-err">{shopErr}</div>}
          <div className="btn-row">
            <button className="btn" disabled={lookingUp} onClick={lookupByCode}>{lookingUp ? 'กำลังค้นหา…' : 'เข้าร้านด้วยรหัส'}</button>
          </div>

          <div className="spacer" />
          <div className="btn-row">
            <button className="btn ghost" onClick={() => { setSignupErr(''); setNewCode(''); setStep('signup') }}><Icon name="plus" size={20} /> สมัครร้านใหม่</button>
          </div>
        </div>
      ) : step === 'signup' ? (
        <div className="login-body">
          <div className="btn-row" style={{ marginTop: 0, marginBottom: 6 }}>
            <button className="btn ghost" style={{ width: 'auto', padding: '8px 12px' }} onClick={() => { setSignupErr(''); setStep('shop') }}><Icon name="chevron-left" size={20} /> กลับ</button>
          </div>
          <div className="card">
            <label>ชื่อร้าน *</label>
            <input value={shopName} onChange={(e) => { setSignupErr(''); setShopName(e.target.value) }} placeholder="เช่น Lazy Nail สาขาทองหล่อ" />
            <label>ชื่อเจ้าของ *</label>
            <input value={ownerName} onChange={(e) => { setSignupErr(''); setOwnerName(e.target.value) }} placeholder="ชื่อเจ้าของร้าน" />
            <label>PIN เจ้าของ (4–6 หลัก) *</label>
            <PinPad
              pin={ownerPin}
              busy={signupBusy}
              err={signupErr}
              onPress={pinPress}
              onBack={pinBack}
              onSubmit={doSignup}
              minLen={4}
              okLabel="สมัคร"
            />
            <div className="btn-row">
              <button className="btn" disabled={signupBusy} onClick={doSignup}>{signupBusy ? 'กำลังสมัคร…' : 'สมัครร้านใหม่'}</button>
            </div>
          </div>
        </div>
      ) : step === 'user' ? (
        <div className="login-body">
          <div className="btn-row" style={{ marginTop: 0, marginBottom: 6 }}>
            <button className="btn ghost" style={{ width: 'auto', padding: '8px 12px' }} onClick={backToShop}><Icon name="chevron-left" size={20} /> เปลี่ยนร้าน</button>
          </div>
          <div className="li" style={{ marginBottom: 6 }}>
            <div className="avatar"><Icon name="store" size={20} /></div>
            <div className="grow">
              <div className="name">{shop ? shop.name : ''}</div>
              <div className="meta">รหัส: {shop ? shop.code : ''}</div>
            </div>
          </div>

          <div className="section-title">เลือกผู้ใช้</div>
          {!users ? (
            <Loading />
          ) : users.length === 0 ? (
            <div className="empty"><div className="big"><Icon name="lock" size={32} /></div>ยังไม่มีผู้ใช้ในร้านนี้</div>
          ) : (
            users.map((u) => (
              <div className="li" key={u.id} onClick={() => { setPicked(u); setPin(''); setErr(''); setStep('pin') }}>
                <div className="avatar">{(u.name || '?').charAt(0).toUpperCase()}</div>
                <div className="grow">
                  <div className="name">{u.name}</div>
                  <div className="meta"><RoleBadge role={u.role} /></div>
                </div>
                <span className="chev"><Icon name="chevron-right" size={20} /></span>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="login-body">
          <div className="li" style={{ marginBottom: 14 }}>
            <div className="avatar">{(picked && picked.name || '?').charAt(0).toUpperCase()}</div>
            <div className="grow">
              <div className="name">{picked ? picked.name : ''}</div>
              <div className="meta">{picked ? <RoleBadge role={picked.role} /> : null}{shop ? ' · ' + shop.name : ''}</div>
            </div>
            <button className="btn ghost" style={{ width: 'auto', padding: '8px 12px' }} onClick={() => { setPicked(null); setPin(''); setErr(''); setStep('user') }}>เปลี่ยน</button>
          </div>

          <PinPad
            pin={pin}
            busy={busy}
            err={err}
            onPress={press}
            onBack={back}
            onSubmit={submit}
            minLen={4}
            okLabel="✓"
          />
        </div>
      )}
    </div>
  )
}

/* ───────────────────────── Users (owner) ───────────────────────── */
function Users({ flash, onNewUser, onEditUser, canManage, ownerPhone, wide }) {
  const [list, setList] = useState(null)

  const load = () => api.users().then(setList).catch((e) => { setList([]); flash && flash(e.status === 403 ? e.message : 'โหลดผู้ใช้ไม่สำเร็จ') })
  useEffect(() => { load() }, [])

  if (!list) return <Loading />
  if (list.length === 0) return <div className="empty"><div className="big"><Icon name="key" size={32} /></div>ยังไม่มีผู้ใช้</div>

  // owner + large → management table with inline edit
  if (wide && canManage) {
    return (
      <>
        <div className="btn-row" style={{ marginTop: 0, marginBottom: 12 }}>
          <button className="btn" style={{ width: 'auto', padding: '12px 18px' }} onClick={onNewUser}><Icon name="plus" size={20} /> เพิ่มผู้ใช้ใหม่</button>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>ชื่อ</th>
              <th>บทบาท</th>
              <th>สถานะ</th>
              <th className="act">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {list.map((u) => (
              <tr key={u.id}>
                <td className="strong" style={u.active === false ? { color: 'var(--muted)', textDecoration: 'line-through' } : undefined}>{u.name}</td>
                <td><RoleBadge role={u.role} /></td>
                <td>{u.active === false ? <span className="badge closed">ปิดใช้งาน</span> : <span className="badge done">ใช้งานอยู่</span>}</td>
                <td className="act">
                  <button className="btn secondary" style={{ width: 'auto', padding: '8px 14px' }} onClick={() => onEditUser(u)}>แก้ไข</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </>
    )
  }

  // owner-phone read-only OR fallback list view
  return (
    <>
      {ownerPhone ? (
        <ManageHint />
      ) : (
        canManage && <button className="btn" onClick={onNewUser}><Icon name="plus" size={20} /> เพิ่มผู้ใช้ใหม่</button>
      )}
      <div className="spacer" />
      {list.map((u) => (
        <div className="li" key={u.id} onClick={ownerPhone ? undefined : () => onEditUser(u)} style={ownerPhone ? { cursor: 'default' } : undefined}>
          <div className="avatar">{(u.name || '?').charAt(0).toUpperCase()}</div>
          <div className="grow">
            <div className="name" style={u.active === false ? { color: 'var(--muted)', textDecoration: 'line-through' } : undefined}>{u.name}</div>
            <div className="meta">
              <RoleBadge role={u.role} />{' '}
              {u.active === false ? <span className="badge closed">ปิดใช้งาน</span> : <span className="badge done">ใช้งานอยู่</span>}
            </div>
          </div>
          {!ownerPhone && <span className="chev"><Icon name="chevron-right" size={20} /></span>}
        </div>
      ))}
    </>
  )
}

function UserForm({ flash, u, onDone, onCancel }) {
  const editing = !!u
  const [name, setName] = useState(u ? (u.name || '') : '')
  const [role, setRole] = useState(u ? (u.role || 'staff') : 'staff')
  const [pin, setPin] = useState('')
  const [active, setActive] = useState(u ? u.active !== false : true)
  const [saving, setSaving] = useState(false)
  const [pinErr, setPinErr] = useState('')

  // PIN policy mirrors the server: 4–6 digits. Required on create; on edit only
  // when a new PIN is typed (blank = keep current). Inline error, no server round-trip.
  const pinNeedsCheck = !editing || pin.length > 0
  const pinBad = pinNeedsCheck && !/^\d{4,6}$/.test(pin)

  const save = () => {
    if (!name.trim()) { flash('กรุณากรอกชื่อ'); return }
    if (pinBad) { setPinErr('PIN ต้องเป็นตัวเลข 4–6 หลัก'); return }
    setPinErr('')

    setSaving(true)
    if (editing) {
      const body = { name: name.trim(), role, active }
      if (pin) body.pin = pin
      api.updateUser(u.id, body)
        .then(() => { flash('บันทึกการแก้ไขแล้ว'); onDone() })
        .catch((e) => { setSaving(false); flash(e.status === 403 ? e.message : 'ผิดพลาด: ' + e.message) })
    } else {
      api.addUser({ name: name.trim(), role, pin })
        .then(() => { flash('เพิ่มผู้ใช้สำเร็จ'); onDone() })
        .catch((e) => { setSaving(false); flash(e.status === 403 ? e.message : 'ผิดพลาด: ' + e.message) })
    }
  }

  return (
    <div className="card">
      <label>ชื่อ *</label>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ชื่อผู้ใช้" />

      <label>บทบาท (Role)</label>
      <select value={role} onChange={(e) => setRole(e.target.value)}>
        <option value="owner">เจ้าของร้าน (owner)</option>
        <option value="staff">พนักงาน (staff)</option>
      </select>

      <label>{editing ? 'PIN ใหม่ (เว้นว่าง = ไม่เปลี่ยน)' : 'PIN (4–6 หลัก) *'}</label>
      <input
        type="tel"
        inputMode="numeric"
        value={pin}
        onChange={(e) => { setPinErr(''); setPin(e.target.value.replace(/\D/g, '').slice(0, 6)) }}
        placeholder="••••"
      />
      {pinErr && <div className="pin-err">{pinErr}</div>}

      {editing && (
        <>
          <label>สถานะ</label>
          <div className="btn-row" style={{ marginTop: 0 }}>
            <button className={'btn ' + (active ? '' : 'ghost')} onClick={() => setActive(true)}>ใช้งานอยู่</button>
            <button className={'btn ' + (!active ? 'dark' : 'ghost')} onClick={() => setActive(false)}>ปิดใช้งาน</button>
          </div>
        </>
      )}

      <div className="btn-row">
        <button className="btn ghost" disabled={saving} onClick={onCancel}>ยกเลิก</button>
        <button className="btn" disabled={saving} onClick={save}>{saving ? 'กำลังบันทึก...' : 'บันทึก'}</button>
      </div>
    </div>
  )
}

/* ───────────────────────── Audit log (owner) ───────────────────────── */
const AUDIT_FILTERS = [
  { v: '', l: 'ทั้งหมด' },
  { v: 'login', l: 'เข้าสู่ระบบ' },
  { v: 'payment_void', l: 'ยกเลิกชำระ' },
  { v: 'ticket_close', l: 'ปิดบิล' },
  { v: 'user_', l: 'ผู้ใช้' },
  { v: 'service_price_change', l: 'แก้ราคา' },
]

function auditActionTH(a) {
  const map = {
    login: 'เข้าสู่ระบบ',
    payment_void: 'ยกเลิกการชำระ',
    ticket_close: 'ปิดบิล',
    user_create: 'เพิ่มผู้ใช้',
    user_update: 'แก้ไขผู้ใช้',
    user_deactivate: 'ปิดใช้งานผู้ใช้',
    service_price_change: 'แก้ราคาบริการ',
  }
  return map[a] || a
}

function AuditLog({ flash, wide }) {
  const [list, setList] = useState(null)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    setList(null)
    // user_ filter is a prefix; backend can match exact action — send `action`
    const params = filter ? { action: filter } : undefined
    api.audit(params).then(setList).catch((e) => { setList([]); flash && flash(e.status === 403 ? e.message : 'โหลดบันทึกไม่สำเร็จ') })
  }, [filter])

  const filters = (
    <div className="audit-filters">
      {AUDIT_FILTERS.map((f) => (
        <button
          key={f.v || 'all'}
          className={'chip' + (filter === f.v ? ' active' : '')}
          onClick={() => setFilter(f.v)}
        >
          {f.l}
        </button>
      ))}
    </div>
  )

  // owner + large → table layout
  if (wide) {
    return (
      <>
        {filters}
        {!list ? (
          <Loading />
        ) : list.length === 0 ? (
          <div className="empty"><div className="big"><Icon name="history" size={32} /></div>ไม่มีบันทึกกิจกรรม</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>กิจกรรม</th>
                <th>รายการ</th>
                <th>โดย</th>
                <th>เวลา</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id}>
                  <td className="strong">{auditActionTH(r.action)}</td>
                  <td>{(r.entity || '') + (r.entity_id ? ' #' + r.entity_id : '') || '-'}</td>
                  <td>{r.actor_name || '-'}</td>
                  <td>{fmtDate(r.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </>
    )
  }

  return (
    <>
      {filters}

      {!list ? (
        <Loading />
      ) : list.length === 0 ? (
        <div className="empty"><div className="big"><Icon name="history" size={32} /></div>ไม่มีบันทึกกิจกรรม</div>
      ) : (
        <div className="timeline">
          {list.map((r) => (
            <div className="tl-row" key={r.id}>
              <div className="tl-dot" />
              <div className="tl-body">
                <div className="name">
                  {auditActionTH(r.action)}
                  {(r.entity || r.entity_id) && (
                    <span className="meta"> · {r.entity || ''}{r.entity_id ? ' #' + r.entity_id : ''}</span>
                  )}
                </div>
                <div className="meta">โดย {r.actor_name || '-'} · {fmtDate(r.created_at)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

/* ───────────────────────── helpers ───────────────────────── */
function groupByCat(list) {
  const out = {}
  list.forEach((s) => {
    const c = s.category || 'อื่นๆ'
    if (!out[c]) out[c] = []
    out[c].push(s)
  })
  return out
}

// unique non-empty category names (for the <datalist> suggestion in ServiceForm)
function catNames(list) {
  const seen = []
  list.forEach((s) => {
    const c = (s.category || '').trim()
    if (c && !seen.includes(c)) seen.push(c)
  })
  return seen
}

function payMethodTH(m) {
  if (m === 'cash') return 'เงินสด'
  if (m === 'beam_edc') return 'บัตร (Beam EDC)'
  if (m === 'unpaid') return 'ค้างชำระ'
  return m
}

function fmtDate(s) {
  if (!s) return '-'
  try {
    const d = new Date(s)
    if (isNaN(d.getTime())) return s
    return d.toLocaleString('th-TH', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  } catch {
    return s
  }
}

// ISO string -> HH:MM (24h)
function fmtTime(s) {
  if (!s) return '-'
  try {
    const d = new Date(s)
    if (isNaN(d.getTime())) return s
    return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false })
  } catch {
    return s
  }
}
