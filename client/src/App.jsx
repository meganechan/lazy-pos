import { useState, useEffect, useRef } from 'react'
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
  'log-in': <><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><polyline points="10 17 15 12 10 7" /><line x1="15" y1="12" x2="3" y2="12" /></>,
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
  'qr-code': <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3" /><path d="M21 14v7h-7" /><path d="M17 17h.01" /></>,
  'more-horizontal': <><circle cx="12" cy="12" r="1.5" /><circle cx="5" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" /></>,
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

/* ───────────────────────── URL / deep-link state ─────────────────────────
   Reflect (tab, view) in the query string and restore it via the History API,
   so the browser Back button steps through tab/detail changes and links are
   shareable. Param scheme:
     ?tab=<tab>                          → just a tab
     ?tab=<tab>&view=member&id=<n>       → member detail (restored on reload)
     ?tab=<tab>&view=ticket&id=<n>       → ticket detail (restored on reload)
     ?tab=<tab>&view=<formKind>          → transient form (back closes it, NOT
                                            restored-with-data on reload)
   Only id-based detail views (member/ticket) are reconstructed on initial load;
   form kinds (newMember/newTicket/newUser/editUser) drop to view=null. */
const VALID_TABS = new Set([
  'dashboard', 'queue', 'tickets', 'members',
  'services', 'reports', 'users', 'audit', 'settings',
])

// build the query string for a (tab, view) pair
function urlFor(tab, view) {
  const p = new URLSearchParams()
  p.set('tab', tab || 'dashboard')
  if (view && view.kind) {
    if (view.kind === 'member' || view.kind === 'ticket') {
      p.set('view', view.kind)
      if (view.id != null) p.set('id', String(view.id))
    } else {
      // transient form views: record the kind so Back closes them
      p.set('view', view.kind)
    }
  }
  return '?' + p.toString()
}

// parse the current URL → { tab, view } using only restorable info.
// id-based views (member/ticket) are reconstructed; everything else → view=null.
function parseUrl() {
  const p = new URLSearchParams(window.location.search)
  const t = p.get('tab')
  const tab = t && VALID_TABS.has(t) ? t : 'dashboard'
  const vk = p.get('view')
  let view = null
  if (vk === 'member' || vk === 'ticket') {
    const id = Number(p.get('id'))
    if (Number.isFinite(id) && id > 0) view = { kind: vk, id }
  }
  // form kinds + unknown view params → view stays null (just show the tab)
  return { tab, view }
}

export default function App() {
  // auth gate: only treat as logged-in when both token + user exist
  const [user, setUser] = useState(() => (getToken() ? getUser() : null))
  const [tab, setTab] = useState('dashboard') // dashboard | members | services | tickets | users | audit | settings
  const [view, setView] = useState(null) // null | {kind:'member',id} | {kind:'ticket',id} | {kind:'newTicket'} | {kind:'newMember'} | {kind:'newUser'} | {kind:'editUser',u}
  const [toast, setToast] = useState(null)
  const [moreOpen, setMoreOpen] = useState(false) // owner-phone overflow bottom sheet
  const { isLarge } = useViewport()

  // url-state plumbing — must live ABOVE the `if (!user)` early return (rules of hooks).
  // isPopping: true while applying a popstate, so the [tab,view] sync effect doesn't
  //   push a NEW history entry for a state change that came FROM history (loop guard).
  // urlReady: gates the sync effect until the mount effect has parsed the initial URL,
  //   so the first render doesn't push a redundant entry.
  const isPopping = useRef(false)
  const urlReady = useRef(false)

  // mount: parse initial URL (only when authenticated), normalize it with replaceState,
  // and install the popstate listener so Back navigates within the app.
  useEffect(() => {
    if (!user) return // never read url-state during the unauthenticated Login render
    const init = parseUrl()
    setTab(init.tab)
    setView(init.view)
    window.history.replaceState({ tab: init.tab, view: init.view }, '', urlFor(init.tab, init.view))
    urlReady.current = true

    const onPop = () => {
      const next = parseUrl()
      isPopping.current = true
      setTab(next.tab)
      setView(next.view)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  // sync (tab, view) → URL on forward navigation. Skipped while popping (history-driven)
  // and until the initial parse is done. pushState so device/browser Back steps back.
  useEffect(() => {
    if (!user || !urlReady.current) return
    if (isPopping.current) { isPopping.current = false; return }
    const target = urlFor(tab, view)
    if (target !== window.location.search) {
      window.history.pushState({ tab, view }, '', target)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, view, user])

  const flash = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2200)
  }

  const onLoggedIn = (token, u) => {
    setAuth(token, u)
    // reset url-state to the default before the mount effect re-parses on `user` flip,
    // so a pre-login deep-link in the address bar can't leak into the session.
    urlReady.current = false
    window.history.replaceState({ tab: 'dashboard', view: null }, '', '?tab=dashboard')
    setUser(u)
    setTab('dashboard')
    setView(null)
  }

  const doLogout = () => {
    api.logout().catch(() => {}) // best-effort; clear locally regardless
    clearAuth()
    // clear url-state to base so the Login screen carries no leftover params
    urlReady.current = false
    window.history.replaceState(null, '', window.location.pathname)
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
    setMoreOpen(false)
  }

  /* nav model — single source of truth for sidebar + bottom nav + overflow sheet.
     core = the 4 tabs every role sees in the bottom bar.
     manage = owner-only "เจ้าของร้าน" destinations (sidebar section / phone overflow sheet). */
  const NAV_CORE = [
    { tab: 'dashboard', icon: 'dashboard', label: 'หน้าหลัก' },
    { tab: 'queue', icon: 'clock', label: 'คิว' },
    { tab: 'tickets', icon: 'receipt', label: 'บิล' },
    { tab: 'members', icon: 'users', label: 'สมาชิก' },
  ]
  const NAV_MANAGE = [
    { tab: 'services', icon: 'sparkles', label: 'บริการ' },
    { tab: 'reports', icon: 'banknote', label: 'รายงาน' },
    { tab: 'users', icon: 'key', label: 'ผู้ใช้' },
    { tab: 'audit', icon: 'history', label: 'บันทึก' },
    { tab: 'settings', icon: 'lock', label: 'ตั้งค่า' },
  ]

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
    else if (tab === 'reports') { title = 'รายงาน'; sub = 'Report' }
    else if (tab === 'audit') { title = 'บันทึกกิจกรรม'; sub = 'Audit log' }
    else if (tab === 'settings') { title = 'ตั้งค่า'; sub = 'Settings' }
  }

  // which tabs get a FAB (new ticket)
  const showFab = !view && (tab === 'dashboard' || tab === 'tickets')

  return (
    <div className={appClass}>
      {wide && (
        <Sidebar
          core={NAV_CORE}
          manage={NAV_MANAGE}
          tab={tab}
          goTab={goTab}
          onLogout={doLogout}
        />
      )}
      <div className="app-main">
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
        {/* wide-detail header: the topbar (with its Back + title) is hidden in the
            owner-wide layout, so detail/form views would otherwise have no way back
            and no page title. Render an in-content header bar only when wide && view.
            Suppressed for kind==='member' — MemberDetail owns its own header so it can
            reflect its internal detail-vs-editing sub-state (title + back-to-detail). */}
        {wide && view && view.kind !== 'member' && (
          <div className="wide-detail-head">
            <button className="wide-back" onClick={onBack} aria-label="กลับ">
              <Icon name="chevron-left" size={20} />
            </button>
            <div className="wide-detail-title">
              <h2>{title}</h2>
              {sub && <div className="sub">{sub}</div>}
            </div>
          </div>
        )}
        {view ? (
          view.kind === 'member' ? (
            <MemberDetail id={view.id} onNewTicket={(mid) => setView({ kind: 'newTicket', preMember: mid })} flash={flash} openTicket={openTicket} ownerPhone={ownerPhone} wide={wide} onBack={onBack} />
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
        ) : tab === 'reports' && isOwner ? (
          <Report flash={flash} />
        ) : tab === 'audit' && isOwner ? (
          <AuditLog flash={flash} wide={wide} />
        ) : tab === 'settings' && isOwner ? (
          <Settings flash={flash} />
        ) : (
          <Tickets openTicket={openTicket} />
        )}
      </div>

      {showFab && (
        <button className="fab" onClick={() => setView({ kind: 'newTicket' })} aria-label="เปิดบิลใหม่"><Icon name="plus" size={28} /></button>
      )}

      {/* bottom nav — phone / non-wide only. Sidebar replaces it for owner-wide.
          Max 5 items: 4 core tabs + (owner) "เพิ่มเติม" overflow. Staff get the 4 core only. */}
      {!view && !wide && (
        <div className="tabbar">
          {NAV_CORE.map((n) => (
            <button key={n.tab} className={tab === n.tab ? 'active' : ''} onClick={() => goTab(n.tab)}>
              <span className="tico"><Icon name={n.icon} /></span>{n.label}
            </button>
          ))}
          {/* owner on phone: overflow owner tabs live behind "เพิ่มเติม". staff have none → hidden. */}
          {isOwner && (
            <button
              className={'more-btn' + (NAV_MANAGE.some((n) => n.tab === tab) ? ' active' : '')}
              onClick={() => setMoreOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={moreOpen}
            >
              <span className="tico"><Icon name="more-horizontal" /></span>เพิ่มเติม
            </button>
          )}
        </div>
      )}
      </div>

      {!view && !wide && isOwner && moreOpen && (
        <MoreSheet items={NAV_MANAGE} tab={tab} goTab={goTab} onClose={() => setMoreOpen(false)} />
      )}

      {toast && <div className="toast" role="status" aria-live="polite">{toast}</div>}
    </div>
  )
}

/* ───────────────────────── Sidebar (owner ≥768 "wide") ─────────────────────────
   Left rail listing all owner destinations, grouped (core + "เจ้าของร้าน" section),
   with logout pinned at the bottom. Replaces the bottom tabbar for owner-wide. */
function Sidebar({ core, manage, tab, goTab, onLogout }) {
  const NavBtn = (n) => (
    <button
      key={n.tab}
      className={'nav-item' + (tab === n.tab ? ' active' : '')}
      onClick={() => goTab(n.tab)}
      aria-current={tab === n.tab ? 'page' : undefined}
    >
      <span className="nav-ico"><Icon name={n.icon} size={19} /></span>{n.label}
    </button>
  )
  return (
    <aside className="sidebar" aria-label="เมนูหลัก">
      <div className="sidebar-head">
        <Logo className="logo" />
        <div className="sidebar-title">
          <div className="t">Lazy Nail POS</div>
          <div className="s">ร้านทำเล็บ</div>
        </div>
      </div>
      <nav className="sidebar-nav">
        {core.map(NavBtn)}
        <div className="nav-section">เจ้าของร้าน</div>
        {manage.map(NavBtn)}
      </nav>
      <div className="sidebar-spacer" />
      <button className="nav-item logout" onClick={onLogout}>
        <span className="nav-ico"><Icon name="log-out" size={19} /></span>ออกจากระบบ
      </button>
    </aside>
  )
}

/* ───────────────────────── MoreSheet (owner phone overflow) ─────────────────────────
   Slide-up bottom sheet listing owner-only overflow destinations. Modal dialog:
   backdrop + Escape close, focus moved into the sheet on open and restored on close. */
function MoreSheet({ items, tab, goTab, onClose }) {
  const sheetRef = useRef(null)
  const firstRef = useRef(null)
  const prevFocus = useRef(null)

  useEffect(() => {
    prevFocus.current = typeof document !== 'undefined' ? document.activeElement : null
    // move focus into the sheet (first item) on open
    if (firstRef.current) firstRef.current.focus()
    const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); onClose() } }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      // restore focus on close if the previous element is still around
      const el = prevFocus.current
      if (el && typeof el.focus === 'function') el.focus()
    }
  }, [])

  return (
    <>
      <div className="sheet-bg" onClick={onClose} />
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label="เมนูเพิ่มเติม"
        ref={sheetRef}
      >
        <div className="sheet-grip" aria-hidden="true" />
        {items.map((n, i) => (
          <button
            key={n.tab}
            ref={i === 0 ? firstRef : undefined}
            className={'sheet-item' + (tab === n.tab ? ' active' : '')}
            onClick={() => goTab(n.tab)}
            aria-current={tab === n.tab ? 'page' : undefined}
          >
            <span className="sheet-ico"><Icon name={n.icon} size={22} /></span>{n.label}
          </button>
        ))}
      </div>
    </>
  )
}

function Loading() {
  return <div className="empty"><div className="big"><Icon name="loader" size={32} className="spin" /></div>กำลังโหลด…</div>
}

function StatusBadge({ status }) {
  return <span className={'badge ' + status}>{statusTH[status] || status}</span>
}

/* ───────────────────────── Dashboard ───────────────────────── */
function Dashboard({ flash, openTicket, onNewTicket, onNewMember, canManage, isOwner, wide }) {
  const [sum, setSum] = useState(null)
  const [tickets, setTickets] = useState(null)
  const [att, setAtt] = useState(null) // { me, staff } from attendanceToday
  const [attBusy, setAttBusy] = useState(false)

  const loadAtt = () => {
    api.attendanceToday().then(setAtt).catch(() => setAtt(null))
  }
  const load = () => {
    api.summary().then(setSum).catch(() => flash('โหลดสรุปไม่สำเร็จ'))
    api.tickets().then(setTickets).catch(() => setTickets([]))
    loadAtt()
  }
  useEffect(load, [])

  // staff: check self in/out
  const selfCheckIn = () => {
    setAttBusy(true)
    api.checkIn()
      .then(() => { loadAtt(); flash('เข้างานแล้ว') })
      .catch((e) => flash('ผิดพลาด: ' + e.message))
      .finally(() => setAttBusy(false))
  }
  const selfCheckOut = () => {
    setAttBusy(true)
    api.checkOut()
      .then(() => { loadAtt(); flash('เลิกงานแล้ว') })
      .catch((e) => flash('ผิดพลาด: ' + e.message))
      .finally(() => setAttBusy(false))
  }
  // owner: toggle a staff member's attendance
  const ownerToggle = (s) => {
    setAttBusy(true)
    const fn = s.checked_in ? api.checkOut(s.user_id) : api.checkIn(s.user_id)
    fn
      .then(() => { loadAtt(); flash(s.checked_in ? 'เลิกงานแล้ว' : 'เข้างานแล้ว') })
      .catch((e) => flash('ผิดพลาด: ' + e.message))
      .finally(() => setAttBusy(false))
  }

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

      {att && !isOwner && att.me && (
        <div className="card" style={{ marginBottom: 12 }}>
          {att.me.checked_in ? (
            <>
              <div className="name" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
                เข้างานแล้ว{att.me.check_in_at ? ' · ' + fmtTime(att.me.check_in_at) : ''}
              </div>
              <div className="meta" style={{ marginBottom: 8 }}>คุณพร้อมรับคิวงานวันนี้</div>
              <button className="btn ghost" disabled={attBusy} onClick={selfCheckOut}>
                <Icon name="log-out" size={18} className="ico-inline" /> เลิกงาน
              </button>
            </>
          ) : (
            <>
              <div className="name" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#9ca3af', display: 'inline-block' }} />
                ยังไม่เข้างาน
              </div>
              <div className="meta" style={{ marginBottom: 8 }}>กดเข้างานก่อน ถึงจะถูกมอบหมาย/เข้าคิวได้</div>
              <button className="btn" disabled={attBusy} onClick={selfCheckIn}>
                <Icon name="log-in" size={18} className="ico-inline" /> เข้างาน
              </button>
            </>
          )}
        </div>
      )}

      {att && isOwner && (att.staff || []).length > 0 && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="section-title" style={{ marginTop: 0 }}>การเข้างานวันนี้</div>
          {att.staff.map((s) => (
            <div className="li" key={s.user_id}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', flex: '0 0 auto', background: s.checked_in ? '#22c55e' : '#9ca3af', display: 'inline-block', marginRight: 8 }} />
              <div className="grow">
                <div className="name">{s.name}</div>
                <div className="meta">{s.checked_in ? 'เข้างาน' + (s.check_in_at ? ' · ' + fmtTime(s.check_in_at) : '') : 'ยังไม่เข้างาน'}</div>
              </div>
              <button className="btn ghost" style={{ width: 'auto' }} disabled={attBusy} onClick={() => ownerToggle(s)}>
                {s.checked_in ? 'เลิกงาน' : 'เข้างาน'}
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="section-title">บิลที่เปิดอยู่</div>
      {!tickets ? (
        <Loading />
      ) : tickets.length === 0 ? (
        <div className="empty"><div className="big"><Icon name="sparkles" size={32} /></div>ยังไม่มีบิลที่เปิดอยู่</div>
      ) : (
        tickets.map((t) => (
          <button type="button" className="li" key={t.id} onClick={() => openTicket(t.id)}>
            <div className="avatar">{(t.member_name || t.staff_name || '?').charAt(0).toUpperCase()}</div>
            <div className="grow">
              <div className="name">{t.member_name || 'ลูกค้าทั่วไป'}</div>
              <div className="meta">โดย {t.staff_name || '-'} · <StatusBadge status={t.status} /></div>
            </div>
            <div className="price tnum">{baht(t.total)}</div>
            <span className="chev"><Icon name="chevron-right" size={20} /></span>
          </button>
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
      <input type="search" aria-label="ค้นหาสมาชิก" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาชื่อ/เบอร์…" />
      <div className="spacer" />
      {!list ? (
        <Loading />
      ) : list.length === 0 ? (
        <div className="empty"><div className="big"><Icon name="users" size={32} /></div>{q.trim() ? 'ไม่พบสมาชิกที่ค้นหา' : 'ยังไม่มีสมาชิก'}</div>
      ) : (
        list.map((m) => (
          <button type="button" className="li" key={m.id} onClick={() => openMember(m.id)}>
            <div className="avatar">{(m.name || '?').charAt(0).toUpperCase()}</div>
            <div className="grow">
              <div className="name">{m.name}</div>
              <div className="meta">{m.phone || 'ไม่มีเบอร์'}</div>
            </div>
            <span className="chev"><Icon name="chevron-right" size={20} /></span>
          </button>
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
    <div className="card form-card">
      <label htmlFor="member-name">ชื่อ *</label>
      <input id="member-name" name="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="ชื่อลูกค้า" />
      <label htmlFor="member-phone">เบอร์โทร</label>
      <input id="member-phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" spellCheck={false} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="08x-xxx-xxxx" />
      <label htmlFor="member-line">LINE User ID</label>
      <input id="member-line" name="line_user_id" autoComplete="off" spellCheck={false} value={line} onChange={(e) => setLine(e.target.value)} placeholder="U1234…" />
      <label htmlFor="member-notes">โน้ต</label>
      <input id="member-notes" name="notes" autoComplete="off" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="แพ้น้ำยา, ชอบสีแดง …" />
      <div className="btn-row">
        <button className="btn" disabled={saving} onClick={save}>{saving ? 'กำลังบันทึก…' : 'บันทึก'}</button>
      </div>
    </div>
  )
}

function MemberDetail({ id, flash, onNewTicket, openTicket, ownerPhone, wide, onBack }) {
  const [m, setM] = useState(null)
  const [editing, setEditing] = useState(false)
  useEffect(() => {
    api.member(id).then(setM).catch(() => flash('โหลดข้อมูลสมาชิกไม่สำเร็จ'))
  }, [id])

  // in-content header for wide (App suppresses its head for kind==='member', so this single
  // header reflects the right sub-state). detail → back to list; editing → back to detail.
  const head = (title, sub, back) => wide && (
    <div className="wide-detail-head">
      <button className="wide-back" onClick={back} aria-label="กลับ">
        <Icon name="chevron-left" size={20} />
      </button>
      <div className="wide-detail-title">
        <h2>{title}</h2>
        {sub && <div className="sub">{sub}</div>}
      </div>
    </div>
  )

  if (!m) return <Loading />

  if (editing) {
    return (
      <>
        {head('แก้ไขสมาชิก', 'Edit member', () => setEditing(false))}
        <EditMember
          m={m}
          flash={flash}
          onCancel={() => setEditing(false)}
          onSaved={(updated) => { setM((prev) => ({ ...prev, ...updated })); setEditing(false) }}
        />
      </>
    )
  }

  return (
    <>
      {head('ข้อมูลสมาชิก', 'Member', onBack)}
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
          <button type="button" className="li" key={h.id} onClick={() => openTicket(h.id)}>
            <div className="grow">
              <div className="name">บิล #{h.id}</div>
              <div className="meta">{fmtDate(h.created_at)} · <StatusBadge status={h.status} /></div>
            </div>
            <div className="price tnum">{baht(h.spent)}</div>
          </button>
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
    <div className="card form-card">
      <label htmlFor="edit-member-name">ชื่อ *</label>
      <input id="edit-member-name" name="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="ชื่อลูกค้า" />
      <label htmlFor="edit-member-phone">เบอร์โทร</label>
      <input id="edit-member-phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" spellCheck={false} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="08x-xxx-xxxx" />
      <label htmlFor="edit-member-line">LINE User ID</label>
      <input id="edit-member-line" name="line_user_id" autoComplete="off" spellCheck={false} value={line} onChange={(e) => setLine(e.target.value)} placeholder="U1234…" />
      <label htmlFor="edit-member-notes">โน้ต</label>
      <input id="edit-member-notes" name="notes" autoComplete="off" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="แพ้น้ำยา, ชอบสีแดง …" />
      <div className="btn-row">
        <button className="btn ghost" disabled={saving} onClick={onCancel}>ยกเลิก</button>
        <button className="btn" disabled={saving} onClick={save}>{saving ? 'กำลังบันทึก…' : 'บันทึก'}</button>
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
  const [migrateFor, setMigrateFor] = useState(null) // service pending a used-delete decision
  const [migrateTo, setMigrateTo] = useState('') // target service id for migrate

  // owner-large management loads ALL services (active+inactive); others load active only
  const manageMode = wide && canManage
  const load = () => api.services(manageMode).then(setList).catch(() => setList([]))
  useEffect(() => { load() }, [manageMode])

  // sub-views (owner-large only). These render via Services' internal `nav` state (not the
  // top-level `view`), so #26's wide-detail-head doesn't cover them and the hidden topbar
  // would leave them without a title/back. Reuse the same .wide-detail-head markup here.
  if (manageMode && nav) {
    const head = (title, sub, back) => wide && (
      <div className="wide-detail-head">
        <button className="wide-back" onClick={back} aria-label="กลับ">
          <Icon name="chevron-left" size={20} />
        </button>
        <div className="wide-detail-title">
          <h2>{title}</h2>
          {sub && <div className="sub">{sub}</div>}
        </div>
      </div>
    )
    if (nav.kind === 'new') {
      return <>{head('เพิ่มบริการ', 'New service', () => setNav(null))}<ServiceForm flash={flash} categories={catNames(list || [])} onCancel={() => setNav(null)} onDone={() => { setNav(null); load() }} /></>
    }
    if (nav.kind === 'edit') {
      return <>{head('แก้ไขบริการ', 'Edit service', () => setNav(null))}<ServiceForm flash={flash} s={nav.s} categories={catNames(list || [])} onCancel={() => setNav(null)} onDone={() => { setNav(null); load() }} /></>
    }
    if (nav.kind === 'detail') {
      return <>{head('รายละเอียดบริการ', 'Service', () => { setNav(null); load() })}<ServiceDetail id={nav.id} flash={flash} onBack={() => { setNav(null); load() }} onEdit={(s) => setNav({ kind: 'edit', s })} /></>
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
        else if (d && d.mode === 'migrate') flash && flash('ย้ายแล้วลบ ' + N(d.migrated) + ' รายการ')
        else flash && flash('ลบบริการแล้ว')
      }))
      .catch((e) => {
        setBusy(false)
        // used in past bills → server returns 409 needs_migrate → open the migrate dialog
        if (e.status === 409) { setMigrateTo(''); setMigrateFor({ ...s, _count: e.body && e.body.count }); return }
        flash && flash(e.status === 403 ? e.message : 'ลบไม่สำเร็จ: ' + e.message)
      })
  }

  const doMigrate = () => {
    const s = migrateFor
    if (!s || migrateTo === '') return
    setBusy(true)
    api.deleteService(s.id, { migrate_to: Number(migrateTo) })
      .then((d) => { setMigrateFor(null); return load().then(() => { setBusy(false); flash && flash('ย้ายแล้วลบ ' + N(d && d.migrated) + ' รายการ') }) })
      .catch((e) => { setBusy(false); flash && flash(e.status === 403 ? e.message : 'ย้ายไม่สำเร็จ: ' + e.message) })
  }

  const doArchive = () => {
    const s = migrateFor
    if (!s) return
    setBusy(true)
    api.deleteService(s.id, { archive: true })
      .then(() => { setMigrateFor(null); return load().then(() => { setBusy(false); flash && flash('ปิดการใช้งานแล้ว') }) })
      .catch((e) => { setBusy(false); flash && flash(e.status === 403 ? e.message : 'ปิดการใช้งานไม่สำเร็จ: ' + e.message) })
  }

  // owner + large → management table with inline price edit + full CRUD
  if (manageMode) {
    return (
      <>
        <div className="btn-row" style={{ marginTop: 0, marginBottom: 12 }}>
          <button className="btn" style={{ width: 'auto', padding: '12px 18px' }} onClick={() => setNav({ kind: 'new' })}><Icon name="plus" size={20} /> เพิ่มบริการ</button>
        </div>
        {migrateFor && (
          <div className="card" style={{ marginBottom: 12 }}>
            <div className="name" style={{ fontWeight: 600 }}>ลบบริการ "{migrateFor.name}"</div>
            <div className="meta" style={{ marginTop: 4, marginBottom: 12 }}>
              บริการนี้มีประวัติการใช้งานในบิล{migrateFor._count != null ? ' (' + N(migrateFor._count) + ' รายการ)' : ''} จึงลบทันทีไม่ได้ — เลือกย้ายรายการเก่าไปบริการอื่น หรือปิดใช้งานเพื่อเก็บประวัติ
            </div>
            <label htmlFor="migrate-to">ย้ายรายการเก่าไปยัง</label>
            <select id="migrate-to" name="migrate-to" value={migrateTo} onChange={(e) => setMigrateTo(e.target.value)} style={{ width: '100%', padding: '13px 14px', borderRadius: 12, border: '1px solid var(--line)', fontSize: 16, fontFamily: 'inherit', background: '#fff', color: 'var(--ink)' }}>
              <option value="">— เลือกบริการ —</option>
              {(list || []).filter((x) => x.id !== migrateFor.id && x.active !== false).map((x) => (
                <option key={x.id} value={x.id}>{x.name}</option>
              ))}
            </select>
            <div className="btn-row">
              <button className="btn" disabled={busy || migrateTo === ''} onClick={doMigrate}>ย้ายและลบ</button>
              <button className="btn dark" disabled={busy} onClick={doArchive}>ปิดใช้งานแทน (เก็บประวัติ)</button>
            </div>
            <div className="btn-row" style={{ marginTop: 0 }}>
              <button className="btn ghost" disabled={busy} onClick={() => setMigrateFor(null)}>ยกเลิก</button>
            </div>
          </div>
        )}
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
  const [staffPrice, setStaffPrice] = useState(s && s.staff_price != null ? String(N(s.staff_price)) : '')
  const [durationMin, setDurationMin] = useState(s ? String(N(s.duration_min)) : '')
  const [description, setDescription] = useState(s ? (s.description || '') : '')
  const [active, setActive] = useState(s ? s.active !== false : true)
  const [saving, setSaving] = useState(false)

  // ── service images (#29, edit mode only) ──
  const [images, setImages] = useState([])
  const [uploading, setUploading] = useState(false)
  // id of the image whose "ตั้งเป็นเมนู" action is in flight (disables that button)
  const [settingMenuId, setSettingMenuId] = useState(null)
  const fileInputRef = useRef(null)

  // load existing images when editing an existing service
  useEffect(() => {
    if (!editing || !s || s.id == null) return
    api.getServiceImages(s.id)
      .then((r) => setImages((r && r.images) || []))
      .catch(() => { /* non-fatal: just show empty */ })
  }, [editing, s && s.id])

  const onPickImages = (e) => {
    const picked = Array.from(e.target.files || [])
    // allow re-selecting the same file later
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (picked.length === 0) return
    // client-side guard: jpeg/png/webp only + ≤5MB (server is authoritative — same allowlist)
    const MAX = 5 * 1024 * 1024
    const ALLOWED = ['image/jpeg', 'image/png', 'image/webp']
    const ok = []
    let skipped = 0
    for (const f of picked) {
      if (!ALLOWED.includes(f.type) || f.size > MAX) { skipped++; continue }
      ok.push(f)
    }
    if (skipped > 0) flash(`ข้ามไฟล์ที่ไม่รองรับ (jpeg/png/webp) หรือใหญ่เกิน 5MB (${skipped} ไฟล์)`)
    if (ok.length === 0) return
    setUploading(true)
    api.uploadServiceImages(s.id, ok)
      .then((r) => { setImages((r && r.images) || []); flash('อัปโหลดรูปแล้ว') })
      .catch((err) => flash(err.status === 403 ? err.message : 'อัปโหลดไม่สำเร็จ: ' + err.message))
      .finally(() => setUploading(false))
  }

  const removeImage = (img) => {
    api.deleteServiceImage(s.id, img.id)
      .then((r) => { setImages((r && r.images) || []); flash('ลบรูปแล้ว') })
      .catch((err) => flash(err.status === 403 ? err.message : 'ลบรูปไม่สำเร็จ: ' + err.message))
  }

  const setMenu = (img) => {
    setSettingMenuId(img.id)
    api.setMenuImage(s.id, img.id)
      .then((r) => { setImages((r && r.images) || []); flash('ตั้งเป็นรูปเมนูแล้ว') })
      .catch((err) => flash(err.status === 403 ? err.message : 'ตั้งรูปเมนูไม่สำเร็จ: ' + err.message))
      .finally(() => setSettingMenuId(null))
  }

  const save = () => {
    if (!name.trim()) { flash('กรุณากรอกชื่อบริการ'); return }
    setSaving(true)
    const body = {
      name: name.trim(),
      category: category.trim() || undefined,
      base_price: N(basePrice),
      staff_price: staffPrice === '' ? undefined : N(staffPrice),
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
    <div className="card form-card">
      <label htmlFor="svc-name">ชื่อบริการ *</label>
      <input id="svc-name" name="service-name" autoComplete="off" value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น ทาเจลสีพื้น" />

      <label htmlFor="svc-category">หมวด</label>
      <input id="svc-category" name="service-category" autoComplete="off" list="svc-cat-list" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="เช่น เจล, ต่อเล็บ, สปา" />
      <div className="meta" style={{ marginTop: -6, marginBottom: 8 }}>เลือกจากที่มี หรือพิมพ์หมวดใหม่ได้</div>
      <datalist id="svc-cat-list">
        {(categories || []).map((c) => <option key={c} value={c} />)}
      </datalist>

      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <label htmlFor="svc-base-price">ราคา (บาท)</label>
          <input id="svc-base-price" name="base-price" type="number" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} placeholder="0" />
        </div>
        <div style={{ flex: 1 }}>
          <label htmlFor="svc-staff-price">ราคาพนักงาน (บาท)</label>
          <input id="svc-staff-price" name="staff-price" type="number" value={staffPrice} onChange={(e) => setStaffPrice(e.target.value)} placeholder="0" />
          <div className="meta" style={{ marginTop: -6, marginBottom: 8 }}>ว่าง = ใช้ราคาปกติ</div>
        </div>
        <div style={{ flex: 1 }}>
          <label htmlFor="svc-duration">เวลา (นาที)</label>
          <input id="svc-duration" name="duration-min" type="number" value={durationMin} onChange={(e) => setDurationMin(e.target.value)} placeholder="0" />
          <div className="meta" style={{ marginTop: -6, marginBottom: 8 }}>เวลาโดยประมาณต่อ 1 ครั้ง</div>
        </div>
      </div>

      <label htmlFor="svc-description">รายละเอียด</label>
      <textarea id="svc-description" name="service-description" autoComplete="off" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="รายละเอียดงาน / เงื่อนไข / หมายเหตุ" rows={4} style={{ width: '100%', padding: '13px 14px', borderRadius: 12, border: '1px solid var(--line)', fontSize: 16, fontFamily: 'inherit', background: '#fff', color: 'var(--ink)', resize: 'vertical' }} />

      <label>สถานะ</label>
      <div className="segmented" role="group" aria-label="สถานะ">
        <button type="button" className="seg" aria-pressed={active} onClick={() => setActive(true)}>ใช้งานอยู่</button>
        <button type="button" className="seg" aria-pressed={!active} onClick={() => setActive(false)}>ปิดใช้งาน</button>
      </div>

      <label>รูปบริการ</label>
      {editing ? (
        <div className="svc-images">
          <div className="svc-images-bar">
            <input
              ref={fileInputRef}
              id="svc-images-input"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              disabled={uploading}
              onChange={onPickImages}
              style={{ display: 'none' }}
            />
            <label htmlFor="svc-images-input" className={'btn secondary svc-images-add' + (uploading ? ' is-disabled' : '')} aria-disabled={uploading}>
              {uploading
                ? <><Icon name="loader" size={20} className="spin" /> กำลังอัปโหลด…</>
                : <><Icon name="plus" size={20} /> เพิ่มรูป</>}
            </label>
            <div className="meta">JPG/PNG ไม่เกิน 5MB ต่อไฟล์ · เลือกได้หลายรูป</div>
          </div>

          {images.length === 0 ? (
            <div className="svc-images-empty">ยังไม่มีรูป</div>
          ) : (
            <div className="svc-image-grid">
              {images.map((img, i) => (
                <div className={'svc-thumb' + (img.is_menu ? ' is-menu' : '')} key={img.id}>
                  <img src={img.url} alt={'รูปบริการ ' + (i + 1)} loading="lazy" width={140} height={140} />
                  {img.is_menu && (
                    <span className="svc-thumb-menu-badge"><span aria-hidden="true">★</span> เมนู</span>
                  )}
                  {!img.is_menu && (
                    <button
                      type="button"
                      className="svc-thumb-set-menu"
                      aria-label="ตั้งเป็นรูปเมนู"
                      disabled={uploading || settingMenuId != null}
                      onClick={() => setMenu(img)}
                    ><span aria-hidden="true">★</span> ตั้งเป็นเมนู</button>
                  )}
                  <button
                    type="button"
                    className="svc-thumb-del"
                    aria-label="ลบรูป"
                    disabled={uploading || settingMenuId != null}
                    onClick={() => removeImage(img)}
                  >×</button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="meta svc-images-hint">บันทึกบริการก่อนเพื่อเพิ่มรูป</div>
      )}

      <div className="btn-row">
        <button className="btn ghost" disabled={saving} onClick={onCancel}>ยกเลิก</button>
        <button className="btn" disabled={saving} onClick={save}>{saving ? 'กำลังบันทึก…' : 'บันทึก'}</button>
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
            <div className="card form-card" key={o.id}>
              {ed ? (
                <>
                  <label htmlFor={`addon-${o.id}-name`}>ชื่อ</label>
                  <input id={`addon-${o.id}-name`} name={`addon-${o.id}-name`} value={ed.name} onChange={(e) => setEditField(o.id, 'name', e.target.value)} />
                  <label htmlFor={`addon-${o.id}-price`}>+ราคา (บาท)</label>
                  <input id={`addon-${o.id}-price`} name={`addon-${o.id}-price`} type="number" value={ed.price_delta} onChange={(e) => setEditField(o.id, 'price_delta', e.target.value)} />
                  <label htmlFor={`addon-${o.id}-minute`}>+เวลา (นาที)</label>
                  <input id={`addon-${o.id}-minute`} name={`addon-${o.id}-minute`} type="number" value={ed.minute_delta} onChange={(e) => setEditField(o.id, 'minute_delta', e.target.value)} />
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
      <div className="card form-card">
        <label htmlFor="new-addon-name">ชื่อ add-on</label>
        <input id="new-addon-name" name="new-addon-name" autoComplete="off" value={oName} onChange={(e) => setOName(e.target.value)} placeholder="เช่น เพิ่มลาย, ถอดเก่า" />
        <label htmlFor="new-addon-price">+ราคา (บาท)</label>
        <input id="new-addon-price" name="new-addon-price" type="number" value={oPrice} onChange={(e) => setOPrice(e.target.value)} placeholder="0" />
        <label htmlFor="new-addon-minute">+เวลา (นาที)</label>
        <input id="new-addon-minute" name="new-addon-minute" type="number" value={oMin} onChange={(e) => setOMin(e.target.value)} placeholder="0" />
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
        <button type="button" className="li" key={t.id} onClick={() => openTicket(t.id)}>
          <div className="avatar">{(t.member_name || t.staff_name || '?').charAt(0).toUpperCase()}</div>
          <div className="grow">
            <div className="name">{t.member_name || 'ลูกค้าทั่วไป'}</div>
            <div className="meta">โดย {t.staff_name || '-'} · <StatusBadge status={t.status} /></div>
          </div>
          <div className="price tnum">{baht(t.total)}</div>
          <span className="chev"><Icon name="chevron-right" size={20} /></span>
        </button>
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

  // owner = manager only (cannot take jobs) → never show on the queue board
  // (server already excludes them; this is a belt-and-suspenders guard).
  const techs = (q.technicians || []).filter((t) => t.role !== 'owner')
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
          <button type="button" className="li" key={w.ticket_id} onClick={() => openTicket(w.ticket_id)}>
            <div className="avatar">{(w.member_name || '?').charAt(0).toUpperCase()}</div>
            <div className="grow">
              <div className="name">{w.member_name || 'ลูกค้าทั่วไป'}</div>
              <div className="meta">
                ช่าง: {w.assigned_name || 'ยังไม่มอบหมาย'} · <Icon name="clock" size={14} className="ico-inline" /> ~<span className="tnum">{N(w.est_minutes)}</span> นาที
              </div>
            </div>
            <span className="chev"><Icon name="chevron-right" size={20} /></span>
          </button>
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
    // technician picker = staff who are checked in today (attendance.staff is already staff-only)
    api.attendanceToday()
      .then((d) => setTechs((d.staff || []).filter((s) => s.checked_in).map((s) => ({ id: s.user_id, name: s.name }))))
      .catch(() => setTechs([]))
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
      {techs.length === 0 && <div className="meta" style={{ marginTop: 4 }}>ยังไม่มีพนักงานเข้างาน</div>}
      {selBusy && (
        <div className="note-warn">
          <Icon name="alert-triangle" size={18} className="ico-inline" /> ช่างไม่ว่างถึง {fmtTime(selBusy.busy_until)} — มอบหมายได้ (เข้าคิว)
        </div>
      )}
      <div className="btn-row">
        <button className="btn" disabled={creating} onClick={create}>{creating ? 'กำลังเปิด…' : 'เปิดบิล'}</button>
      </div>
    </div>
  )
}

/* ───────────────────────── Owner-PIN override modal ─────────────────────────
 * Shown when a STAFF action exceeds the discount ceiling / quota and the server
 * returns 403 need_override. The owner types their PIN to approve the action.
 * The caller re-opens with `err` set to keep the modal up after override_failed. */
function OverridePinModal({ title, reason, err, busy, onSubmit, onCancel }) {
  const [pin, setPin] = useState('')
  const reasonTH = reason === 'limit' ? 'เกินเพดานที่ตั้งไว้' : reason === 'quota' ? 'เกินโควต้าวันนี้' : ''
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16, overscrollBehavior: 'contain', touchAction: 'manipulation' }}
      onClick={onCancel}
    >
      <div className="card" style={{ width: '100%', maxWidth: 360, margin: 0 }} onClick={(e) => e.stopPropagation()}>
        <div className="name" style={{ fontSize: 17, marginBottom: 4 }}>{title || 'ต้องการอนุมัติจากเจ้าของร้าน'}</div>
        {reasonTH && <div className="meta" style={{ marginBottom: 6 }}>{reasonTH}</div>}
        <label>PIN ของเจ้าของร้าน</label>
        <input
          type="password"
          inputMode="numeric"
          value={pin}
          autoFocus
          onChange={(e) => setPin(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && pin) onSubmit(pin) }}
          placeholder="••••"
        />
        {err && <div className="pin-err">{err}</div>}
        <div className="btn-row">
          <button className="btn ghost" disabled={busy} onClick={onCancel}>ยกเลิก</button>
          <button className="btn" disabled={busy || !pin} onClick={() => onSubmit(pin)}>ยืนยัน</button>
        </div>
      </div>
    </div>
  )
}

/* ───────────────────────── Ticket / checkout ───────────────────────── */
function TicketView({ id, flash, isOwner, canManage, ownerPhone, onClosed }) {
  // owner-on-phone = read-only summary: hide all mutate controls
  const readOnly = !!ownerPhone
  const [t, setT] = useState(null)
  const [loadErr, setLoadErr] = useState('') // §v1.4 — 403 = someone else's bill (staff)
  const [services, setServices] = useState([])
  const [busy, setBusy] = useState(false)
  const [bolt, setBolt] = useState(null) // Beam Bolt card/QR panel: { payment_id, boltIntentId, deepLinkUrl, mode, mock } | null
  const [boltErr, setBoltErr] = useState('') // inline Bolt failure message (failure enum)
  const [boltPaired, setBoltPaired] = useState(false) // shop has a paired EDC device → default PAIRING + offer QR fallback
  const [boltNotPaired, setBoltNotPaired] = useState(false) // create returned 400 ร้านยังไม่ได้ pair → owner-must-pair hint
  const [priceEdits, setPriceEdits] = useState({}) // itemId -> string
  const [minutesEdits, setMinutesEdits] = useState({}) // itemId -> string
  const [optSel, setOptSel] = useState({}) // itemId -> { [optionId]: true } selected add-ons
  const [techs, setTechs] = useState([]) // [{id,name,role}] for assign prompt
  const [reconcile, setReconcile] = useState(null) // pid that needs manual reconcile (key expired)
  // free-style "ตามสั่ง" line item inline form
  const [customOpen, setCustomOpen] = useState(false)
  const [cName, setCName] = useState('')
  const [cPrice, setCPrice] = useState('')
  const [cMin, setCMin] = useState('')
  // bill-level discount inline form: type '%'|'baht', value string
  const [billDiscType, setBillDiscType] = useState('percent')
  const [billDiscVal, setBillDiscVal] = useState('')
  // per-item discount inline forms: itemId -> { type, value }
  const [itemDisc, setItemDisc] = useState({})
  // owner-PIN override modal. pendingOverride records the action to retry once
  // a PIN is supplied: { run: (pin) => Promise, reason }. overrideErr keeps the
  // modal open with a message after override_failed.
  const [pendingOverride, setPendingOverride] = useState(null)
  const [overrideErr, setOverrideErr] = useState('')

  const refresh = () => api.ticket(id).then(setT)

  // shared 403-need_override detector for discount / staff-price actions
  const needsOverride = (e) => e && e.status === 403 && e.body && e.body.need_override
  const overrideReason = (e) => (e && e.body && e.body.reason) || undefined

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
    api.ticket(id).then(setT).catch((e) => {
      if (e && e.status === 403) setLoadErr('คุณเข้าถึงได้เฉพาะบิลของตัวเอง')
      else { setLoadErr('โหลดบิลไม่สำเร็จ'); flash('โหลดบิลไม่สำเร็จ') }
    })
    api.services().then(setServices).catch(() => setServices([]))
    // start/assign picker = staff who are checked in today (attendance.staff is already staff-only)
    api.attendanceToday()
      .then((d) => setTechs((d.staff || []).filter((s) => s.checked_in).map((s) => ({ id: s.user_id, name: s.name }))))
      .catch(() => setTechs([]))
    // know if this shop has a paired EDC device → drives default Bolt mode (PAIRING) + QR fallback offer
    api.boltConnection().then((c) => setBoltPaired(!!(c && c.paired))).catch(() => setBoltPaired(false))
  }, [id])

  // Beam Bolt PoC — real mode auto-poll every ~2.5s while the panel is open.
  // Stop on success/failure (handled inside handleBoltResult) and clear on unmount/close.
  // Mock mode does NOT auto-poll (staff drives it with the simulate buttons).
  useEffect(() => {
    if (!bolt || bolt.mock || boltErr) return
    let cancelled = false
    const iv = setInterval(() => {
      api.pollBoltIntent(id, bolt.payment_id)
        .then((res) => { if (!cancelled) handleBoltResult(res) })
        .catch(() => { /* transient — keep polling */ })
    }, 2500)
    return () => { cancelled = true; clearInterval(iv) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bolt, boltErr, id])

  if (!t) return loadErr
    ? (
      <>
        {onClosed && <button className="btn ghost" style={{ width: 'auto', marginBottom: 12 }} onClick={onClosed}><Icon name="chevron-left" size={18} /> กลับ</button>}
        <div className="empty"><div className="big"><Icon name="lock" size={32} /></div>{loadErr}</div>
      </>
    )
    : <Loading />

  const total = N(t.total)
  const paid = N(t.paid)
  const isPaid = paid >= total && total > 0
  const outstanding = Math.max(0, total - paid) || total // amount still due (fallback to total)
  const isClosed = t.status === 'closed'
  const items = t.items || []
  const payments = t.payments || []
  const quote = t.quote
  const inProgress = t.status === 'in_progress'
  const estMinutes = N(t.est_minutes) || items.reduce((a, it) => a + N(it.minutes) * (N(it.qty) || 1), 0)
  const itemCount = (sid) => items.filter((it) => N(it.service_id) === N(sid)).reduce((a, it) => a + N(it.qty), 0)

  // #31 — group services by category (null/empty → "อื่นๆ") for the picker grid
  const servicesByCategory = Object.entries(
    services.reduce((acc, s) => {
      const cat = (s.category && s.category.trim()) || 'อื่นๆ'
      ;(acc[cat] = acc[cat] || []).push(s)
      return acc
    }, {})
  )

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
      if (techs.length === 0) { flash('ยังไม่มีพนักงานเข้างาน'); return }
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

  // add a service at its staff price (server swaps in staff_price + flags it).
  // STAFF may exceed the daily staff-price quota → 403 need_override → owner PIN.
  const addStaffPrice = (s, override_pin) => {
    setBusy(true)
    api.addItem(id, { service_id: s.id, qty: 1, quoted_price: N(s.staff_price), is_staff_price: true, ...(override_pin ? { override_pin } : {}) })
      .then((d) => {
        setT(d); setBusy(false)
        setPendingOverride(null); setOverrideErr('')
      })
      .catch((e) => {
        setBusy(false)
        if (needsOverride(e)) {
          setOverrideErr(override_pin ? 'PIN ไม่ถูกต้องหรืออนุมัติไม่สำเร็จ' : '')
          setPendingOverride({ reason: overrideReason(e), run: (pin) => addStaffPrice(s, pin) })
          return
        }
        flash('เพิ่มไม่สำเร็จ: ' + e.message)
      })
  }

  // bill-level discount. type 'percent'|'baht'. STAFF over ceiling/quota → owner PIN.
  const applyBillDiscount = (type, value, override_pin) => {
    setBusy(true)
    api.setBillDiscount(id, { discount_type: type, discount_value: N(value), ...(override_pin ? { override_pin } : {}) })
      .then((d) => {
        setT(d); setBusy(false)
        setPendingOverride(null); setOverrideErr('')
        flash('ใช้ส่วนลดบิลแล้ว')
      })
      .catch((e) => {
        setBusy(false)
        if (needsOverride(e)) {
          setOverrideErr(override_pin ? 'PIN ไม่ถูกต้องหรืออนุมัติไม่สำเร็จ' : '')
          setPendingOverride({ reason: overrideReason(e), run: (pin) => applyBillDiscount(type, value, pin) })
          return
        }
        flash('ใช้ส่วนลดไม่สำเร็จ: ' + e.message)
      })
  }

  const clearBillDiscount = () => {
    setBusy(true)
    api.setBillDiscount(id, { discount_type: null, discount_value: 0 })
      .then((d) => { setT(d); setBusy(false); setBillDiscVal(''); flash('ล้างส่วนลดบิลแล้ว') })
      .catch((e) => { setBusy(false); flash('ล้างส่วนลดไม่สำเร็จ: ' + e.message) })
  }

  // per-item discount. Same override flow as the bill discount.
  const applyItemDiscount = (it, type, value, override_pin) => {
    setBusy(true)
    api.setItemDiscount(id, it.id, { discount_type: type, discount_value: N(value), ...(override_pin ? { override_pin } : {}) })
      .then((d) => {
        setT(d); setBusy(false)
        setPendingOverride(null); setOverrideErr('')
        flash('ใช้ส่วนลดรายการแล้ว')
      })
      .catch((e) => {
        setBusy(false)
        if (needsOverride(e)) {
          setOverrideErr(override_pin ? 'PIN ไม่ถูกต้องหรืออนุมัติไม่สำเร็จ' : '')
          setPendingOverride({ reason: overrideReason(e), run: (pin) => applyItemDiscount(it, type, value, pin) })
          return
        }
        flash('ใช้ส่วนลดไม่สำเร็จ: ' + e.message)
      })
  }

  const clearItemDiscount = (it) => {
    setBusy(true)
    api.setItemDiscount(id, it.id, { discount_type: null, discount_value: 0 })
      .then((d) => { setT(d); setBusy(false); flash('ล้างส่วนลดรายการแล้ว') })
      .catch((e) => { setBusy(false); flash('ล้างส่วนลดไม่สำเร็จ: ' + e.message) })
  }

  const addCustom = () => {
    if (!cName.trim()) { flash('กรอกชื่อรายการ'); return }
    if (cPrice === '' || isNaN(N(cPrice))) { flash('กรอกราคา'); return }
    setBusy(true)
    api.addCustomItem(id, { name: cName.trim(), quoted_price: N(cPrice), qty: 1, minutes: cMin === '' ? undefined : N(cMin) })
      .then((d) => { setT(d); setBusy(false); setCName(''); setCPrice(''); setCMin(''); setCustomOpen(false); flash('เพิ่มรายการตามสั่งแล้ว') })
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

  // Cash / unpaid only. Card payments go through the Beam Bolt flow (startBolt).
  const doPay = (method) => {
    setBusy(true)
    api.pay(id, { method, amount: total })
      .then((d) => {
        setT(d); setBusy(false)
        // §issue#31 Part 4 — server auto-closes once fully paid → bounce back.
        if (d.status === 'closed') { flash('ชำระครบ — ปิดบิลแล้ว'); onClosed && onClosed() }
        else flash(method === 'cash' ? 'ชำระเงินสดสำเร็จ' : 'บันทึกเป็นค้างชำระแล้ว')
      })
      .catch((e) => {
        setBusy(false)
        flash('ชำระไม่สำเร็จ: ' + e.message)
        // refresh to capture any payment row the backend may have stored
        refresh().catch(() => {})
      })
  }

  /* ── Beam Bolt deep-link PoC ──────────────────────────────
     start: create a pending beam_edc payment + Bolt intent, open the panel.
     A failure result is one of CH_PROCESSING_FAILED / CH_INSUFFICIENT_FUNDS /
     CH_AUTHENTICATION_FAILED / BI_EXPIRED / BI_CANCELED. '' = still pending,
     CH_SUCCEEDED = paid. */
  const BOLT_FAIL_TH = {
    CH_PROCESSING_FAILED: 'ประมวลผลการชำระไม่สำเร็จ',
    CH_INSUFFICIENT_FUNDS: 'ยอดเงินไม่เพียงพอ',
    CH_AUTHENTICATION_FAILED: 'ยืนยันตัวตนไม่สำเร็จ',
    BI_EXPIRED: 'ลิงก์ชำระเงินหมดอายุ',
    BI_CANCELED: 'ลูกค้ายกเลิกการชำระเงิน',
  }

  // start a Bolt intent in a given mode.
  //  PAIRING   → รูดบัตรที่เครื่อง EDC (no link); requires the shop be paired.
  //  DEEP_LINK → QR PromptPay link on the customer's phone.
  // Omitting mode lets the server pick (PAIRING when paired else DEEP_LINK).
  const startBolt = (mode, paymentMethodType) => {
    setBusy(true)
    setBoltErr('')
    setBoltNotPaired(false)
    const body = { amount: outstanding }
    if (mode) body.mode = mode
    // PAIRING (EDC device) can take card OR an on-device QR; pass the chosen method.
    if (paymentMethodType) body.paymentMethodType = paymentMethodType
    api.createBoltIntent(id, body)
      .then((d) => { setBolt(d); setBusy(false) })
      .catch((e) => {
        setBusy(false)
        // PAIRING requested but shop has no paired device → friendly owner-must-pair hint
        if (e.status === 400 && e.body && e.body.error === 'ร้านยังไม่ได้ pair เครื่องรูดบัตร') {
          setBoltNotPaired(true)
          return
        }
        flash('สร้างรายการ Bolt ไม่สำเร็จ: ' + e.message)
      })
  }

  // apply a poll result: success → ticket paid; failure → inline error + retry; '' → keep waiting
  const handleBoltResult = (res) => {
    // '' / absent result = still pending (waiting for card tap) → keep polling.
    // res is always an object while pending, so guard on res.result, not just res.
    if (!res || !res.result) return false // still pending
    if (res.result === 'CH_SUCCEEDED') {
      if (res.ticket) setT(res.ticket)
      setBolt(null)
      setBoltErr('')
      // §issue#31 Part 4 — fully paid → server closed the bill → bounce back.
      if (res.ticket && res.ticket.status === 'closed') { flash('ชำระครบ — ปิดบิลแล้ว'); onClosed && onClosed() }
      else flash('ชำระผ่าน Bolt สำเร็จ')
      return true
    }
    // any non-empty, non-success result is a failure enum
    setBoltErr(BOLT_FAIL_TH[res.result] || res.result || 'การชำระล้มเหลว')
    return true // stop polling on failure
  }

  // mock mode: staff taps จำลองสำเร็จ / จำลองล้มเหลว
  const simulateBolt = (which) => {
    if (!bolt) return
    setBusy(true)
    api.pollBoltIntent(id, bolt.payment_id, which)
      .then((res) => { setBusy(false); handleBoltResult(res) })
      .catch((e) => { setBusy(false); flash('จำลองไม่สำเร็จ: ' + e.message) })
  }

  // Cancel: propagate to Beam so the paired EDC stops waiting for a card tap,
  // THEN clear local state. Best-effort — if the cancel API fails we still clear
  // the panel (so the cashier isn't stuck) but flash a warning. busy guards
  // against double-taps. A live (non-mock) intent with a boltIntentId is what we
  // need to cancel; mock / not-yet-created intents just clear locally.
  const clearBolt = () => { setBolt(null); setBoltErr(''); setBoltNotPaired(false) }
  const cancelBolt = () => {
    const b = bolt
    if (!b || b.mock || !b.boltIntentId) { clearBolt(); return }
    setBusy(true)
    api.cancelBoltIntent(id, b.payment_id)
      .then((d) => {
        setBusy(false)
        if (d && d.ticket) setT(d.ticket)
        if (d && d.beamError) flash('ยกเลิกที่เครื่องอาจไม่สำเร็จ: ' + d.beamError)
        else flash('ยกเลิกการชำระแล้ว')
        clearBolt()
      })
      .catch((e) => { setBusy(false); flash('ยกเลิกไม่สำเร็จ: ' + e.message); clearBolt() })
  }
  const retryBolt = () => { const mode = bolt && bolt.mode; const pm = bolt && bolt.paymentMethodType; setBolt(null); setBoltErr(''); startBolt(mode, pm) }

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

      {/* #31 SERVICE PICKER (image grid, grouped by category) — hidden in read-only summary */}
      {!readOnly && (
        <>
          <div className="section-title">เพิ่มบริการ</div>
          {services.length === 0 ? (
            <div className="empty">ไม่มีบริการ</div>
          ) : (
            servicesByCategory.map(([cat, list]) => (
              <div key={cat}>
                <div className="section-title svc-grid-cat">{cat}</div>
                <div className="svc-grid">
                  {list.map((s) => {
                    const c = itemCount(s.id)
                    return (
                      <div className="svc-card" key={s.id}>
                        {c > 0 && <span className="svc-card-badge tnum" aria-hidden="true">{c}</span>}
                        <button type="button" className="svc-card-body" disabled={busy} onClick={() => addService(s)} aria-label={'เพิ่ม ' + s.name}>
                          <div className="svc-card-thumb">
                            {s.menu_image_url ? (
                              <img src={s.menu_image_url} alt={s.name} loading="lazy" width="240" height="240" />
                            ) : (
                              <div className="svc-card-ph"><Icon name="sparkles" size={28} /></div>
                            )}
                          </div>
                          <div className="svc-card-name">{s.name}</div>
                          <div className="svc-card-meta tnum">{baht(s.base_price)} · {N(s.duration_min)} นาที</div>
                        </button>
                        <div className="svc-card-foot">
                          <button type="button" className="svc-step" disabled={busy || c === 0} onClick={() => removeOneOfService(s)} aria-label="ลดจำนวน"><Icon name="minus" size={18} /></button>
                          <span className="svc-step-count tnum">{c}</span>
                          <button type="button" className="svc-step" disabled={busy} onClick={() => addService(s)} aria-label="เพิ่มจำนวน"><Icon name="plus" size={18} /></button>
                        </div>
                        {s.staff_price != null && (
                          <button type="button" className="btn ghost svc-card-staff" disabled={busy} onClick={() => addStaffPrice(s)}>
                            <Icon name="plus" size={14} /> ราคาพนักงาน ({baht(s.staff_price)})
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))
          )}
          {/* FREE-STYLE "ตามสั่ง" line item */}
          {!customOpen ? (
            <button className="btn ghost" style={{ marginTop: 10 }} onClick={() => setCustomOpen(true)}><Icon name="plus" size={20} /> รายการตามสั่ง</button>
          ) : (
            <div className="card" style={{ marginTop: 10 }}>
              <label>ชื่อรายการ</label>
              <input value={cName} onChange={(e) => setCName(e.target.value)} placeholder="เช่น แต่งลายพิเศษ" />
              <label>ราคา (บาท)</label>
              <input type="number" value={cPrice} onChange={(e) => setCPrice(e.target.value)} placeholder="0" />
              <label>เวลา (นาที) — ไม่บังคับ</label>
              <input type="number" value={cMin} onChange={(e) => setCMin(e.target.value)} placeholder="0" />
              <div className="btn-row">
                <button className="btn ghost" disabled={busy} onClick={() => { setCustomOpen(false); setCName(''); setCPrice(''); setCMin('') }}>ยกเลิก</button>
                <button className="btn" disabled={busy} onClick={addCustom}>เพิ่ม</button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ITEMS in cart */}
      <div className="section-title">รายการในบิล</div>
      {items.length === 0 ? (
        <div className="empty">{readOnly ? 'ยังไม่มีรายการ' : 'ยังไม่มีรายการ — เลือกบริการด้านล่าง'}</div>
      ) : readOnly ? (
        items.map((it) => (
          <div className="li" key={it.id}>
            <div className="grow">
              <div className="name">{it.service_name} {it.is_custom && <span className="cat" style={{ fontSize: 12, color: 'var(--rose-dark)', background: 'var(--rose-soft)', padding: '2px 8px', borderRadius: 6 }}>ตามสั่ง</span>} {it.is_staff_price && <span className="cat" style={{ fontSize: 12, color: 'var(--rose-dark)', background: 'var(--rose-soft)', padding: '2px 8px', borderRadius: 6 }}>ราคาพนักงาน</span>} {it.category && <span className="cat" style={{ fontSize: 12, color: 'var(--rose-dark)', background: 'var(--rose-soft)', padding: '2px 8px', borderRadius: 6 }}>{it.category}</span>}</div>
              <div className="meta">จำนวน <span className="tnum">{N(it.qty)}</span> · <Icon name="clock" size={14} className="ico-inline" /> <span className="tnum">{N(it.minutes)}</span> นาที</div>
            </div>
            <div className="price tnum">
              {N(it.discount_amount) > 0 ? (
                <>
                  <span style={{ textDecoration: 'line-through', color: 'var(--muted)', fontWeight: 400, marginRight: 6 }}>{baht(N(it.quoted_price) * N(it.qty))}</span>
                  {baht(N(it.net))}
                </>
              ) : baht(N(it.quoted_price) * N(it.qty))}
            </div>
          </div>
        ))
      ) : (
        items.map((it) => (
          <div className="card" key={it.id}>
            <div className="row">
              <div className="grow">
                <div className="name">{it.service_name} {it.is_custom && <span className="cat" style={{ fontSize: 12, color: 'var(--rose-dark)', background: 'var(--rose-soft)', padding: '2px 8px', borderRadius: 6 }}>ตามสั่ง</span>} {it.is_staff_price && <span className="cat" style={{ fontSize: 12, color: 'var(--rose-dark)', background: 'var(--rose-soft)', padding: '2px 8px', borderRadius: 6 }}>ราคาพนักงาน</span>} {it.category && <span className="cat" style={{ fontSize: 12, color: 'var(--rose-dark)', background: 'var(--rose-soft)', padding: '2px 8px', borderRadius: 6 }}>{it.category}</span>}</div>
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
            <label>ส่วนลดรายการ</label>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <button
                className={'btn ' + ((itemDisc[it.id] ? itemDisc[it.id].type : 'percent') === 'percent' ? 'secondary' : 'ghost')}
                style={{ width: 'auto', padding: '8px 12px' }}
                disabled={busy}
                onClick={() => setItemDisc((p) => ({ ...p, [it.id]: { ...(p[it.id] || { value: '' }), type: 'percent' } }))}
              >
                %
              </button>
              <button
                className={'btn ' + ((itemDisc[it.id] ? itemDisc[it.id].type : 'percent') === 'baht' ? 'secondary' : 'ghost')}
                style={{ width: 'auto', padding: '8px 12px' }}
                disabled={busy}
                onClick={() => setItemDisc((p) => ({ ...p, [it.id]: { ...(p[it.id] || { value: '' }), type: 'baht' } }))}
              >
                ฿
              </button>
              <input
                type="number"
                style={{ flex: 1, minWidth: 80 }}
                value={itemDisc[it.id] ? itemDisc[it.id].value : ''}
                onChange={(e) => setItemDisc((p) => ({ ...p, [it.id]: { type: (p[it.id] && p[it.id].type) || 'percent', value: e.target.value } }))}
                placeholder="0"
              />
              <button
                className="btn"
                style={{ width: 'auto', padding: '8px 14px' }}
                disabled={busy || !itemDisc[it.id] || itemDisc[it.id].value === ''}
                onClick={() => applyItemDiscount(it, (itemDisc[it.id] && itemDisc[it.id].type) || 'percent', itemDisc[it.id].value)}
              >
                ใช้
              </button>
            </div>
            {N(it.discount_amount) > 0 && (
              <div className="meta" style={{ marginTop: 4 }}>
                ลด: <span className="tnum" style={{ color: 'var(--rose-dark)' }}>-{baht(N(it.discount_amount))}</span> · เหลือ <span className="tnum">{baht(N(it.net))}</span>
                <button className="btn ghost" style={{ width: 'auto', padding: '4px 10px', marginLeft: 8 }} disabled={busy} onClick={() => clearItemDiscount(it)}>ล้าง</button>
              </div>
            )}
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

      {/* MONEY BREAKDOWN + BILL DISCOUNT (server-computed; never recompute client-side) */}
      {!readOnly && items.length > 0 && (
        <>
          <div className="li">
            <div className="grow"><div className="name">ราคารวม</div></div>
            <div className="price tnum">{baht(t.items_gross)}</div>
          </div>
          {N(t.discount_total) > 0 && (
            <div className="li">
              <div className="grow"><div className="name">ส่วนลด</div></div>
              <div className="price tnum" style={{ color: 'var(--rose-dark)' }}>-{baht(t.discount_total)}</div>
            </div>
          )}
          <div className="card" style={{ marginTop: 8 }}>
            <label>ส่วนลดบิล</label>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <button
                className={'btn ' + (billDiscType === 'percent' ? 'secondary' : 'ghost')}
                style={{ width: 'auto', padding: '8px 12px' }}
                disabled={busy}
                onClick={() => setBillDiscType('percent')}
              >
                %
              </button>
              <button
                className={'btn ' + (billDiscType === 'baht' ? 'secondary' : 'ghost')}
                style={{ width: 'auto', padding: '8px 12px' }}
                disabled={busy}
                onClick={() => setBillDiscType('baht')}
              >
                ฿
              </button>
              <input
                type="number"
                style={{ flex: 1, minWidth: 80 }}
                value={billDiscVal}
                onChange={(e) => setBillDiscVal(e.target.value)}
                placeholder="0"
              />
              <button
                className="btn"
                style={{ width: 'auto', padding: '8px 14px' }}
                disabled={busy || billDiscVal === ''}
                onClick={() => applyBillDiscount(billDiscType, billDiscVal)}
              >
                ใช้ส่วนลด
              </button>
            </div>
            {t.discount_type && N(t.bill_discount_amount) > 0 && (
              <div className="meta" style={{ marginTop: 6 }}>
                ส่วนลดบิลปัจจุบัน: <span className="tnum">{t.discount_type === 'percent' ? N(t.discount_value) + '%' : baht(t.discount_value)}</span> (<span className="tnum" style={{ color: 'var(--rose-dark)' }}>-{baht(t.bill_discount_amount)}</span>)
                <button className="btn ghost" style={{ width: 'auto', padding: '4px 10px', marginLeft: 8 }} disabled={busy} onClick={clearBillDiscount}>ล้างส่วนลด</button>
              </div>
            )}
          </div>
        </>
      )}

      {/* TOTAL */}
      <div className="total-bar">
        <div className="t">ยอดสุทธิ</div>
        <div className="v tnum">{baht(total)}</div>
      </div>
      {estMinutes > 0 && (
        <div className="meta center" style={{ marginTop: 2 }}><Icon name="clock" size={14} className="ico-inline" /> ~<span className="tnum">{estMinutes}</span> นาที</div>
      )}

      {/* OWNER-PIN OVERRIDE MODAL — shared by bill / item discount + staff price */}
      {pendingOverride && (
        <OverridePinModal
          reason={pendingOverride.reason}
          err={overrideErr}
          busy={busy}
          onSubmit={(pin) => pendingOverride.run(pin)}
          onCancel={() => { setPendingOverride(null); setOverrideErr('') }}
        />
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
            bolt ? (
              <div className="card">
                {(() => {
                  // active mode drives the panel header + body. DEEP_LINK shows the
                  // QR PromptPay link; PAIRING shows "รูดบัตรที่เครื่อง EDC" (no link).
                  const isDeepLink = bolt.mode === 'DEEP_LINK'
                  const isQrOnDevice = bolt.mode === 'PAIRING' && bolt.paymentMethodType === 'QR_PROMPT_PAY'
                  const header = isDeepLink ? '📱 สแกน QR PromptPay (มือถือ)'
                    : isQrOnDevice ? '💳 สแกน QR บนเครื่อง EDC…'
                    : '💳 กรุณารูดบัตรที่เครื่อง EDC…'
                  return (
                    <>
                      <div className="center" style={{ fontSize: 32 }}>{isDeepLink ? '📱' : '💳'}</div>
                      <div className="center" style={{ fontWeight: 700 }}>{header}</div>
                      <div className="center muted" style={{ marginBottom: 12 }}>
                        ยอดชำระ {baht(outstanding)}
                        {bolt.mock && <span className="badge" style={{ marginLeft: 8 }}>MOCK</span>}
                      </div>

                      {isDeepLink ? (
                        <>
                          <div className="btn-row">
                            <a
                              className="btn"
                              href={bolt.deepLinkUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ textAlign: 'center', textDecoration: 'none' }}
                            >
                              📲 เปิด/สแกน QR PromptPay
                            </a>
                          </div>
                          <div className="center muted" style={{ fontSize: 12, wordBreak: 'break-all', margin: '4px 0 12px' }}>
                            intent: {bolt.boltIntentId}
                          </div>
                        </>
                      ) : (
                        <div className="center muted" style={{ fontSize: 12, wordBreak: 'break-all', margin: '4px 0 12px' }}>
                          รอผลที่เครื่องรูดบัตร · intent: {bolt.boltIntentId}
                        </div>
                      )}
                    </>
                  )
                })()}

                {boltErr ? (
                  <>
                    <div className="center" style={{ fontSize: 28 }}>⚠️</div>
                    <div className="center" style={{ color: 'var(--bad)', fontWeight: 700 }}>ชำระผ่าน Bolt ไม่สำเร็จ</div>
                    <div className="center muted" style={{ marginBottom: 10 }}>{boltErr}</div>
                    <div className="btn-row">
                      <button className="btn" disabled={busy} onClick={retryBolt}>🔁 ลองใหม่</button>
                      <button className="btn ghost" disabled={busy} onClick={cancelBolt}>ปิด</button>
                    </div>
                  </>
                ) : bolt.mock ? (
                  <>
                    <div className="center muted" style={{ marginBottom: 8 }}>โหมดสาธิต — ไม่มี Beam creds จริง</div>
                    <div className="btn-row">
                      <button className="btn" disabled={busy} onClick={() => simulateBolt('success')}>✅ จำลองสำเร็จ</button>
                      <button className="btn dark" disabled={busy} onClick={() => simulateBolt('fail')}>⚠️ จำลองล้มเหลว</button>
                    </div>
                    <div className="btn-row">
                      <button className="btn ghost" disabled={busy} onClick={cancelBolt}>ยกเลิก</button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="center muted" style={{ marginBottom: 10 }}>⏳ กำลังรอผลชำระ…</div>
                    <div className="btn-row">
                      <button className="btn ghost" disabled={busy} onClick={cancelBolt}>ยกเลิก</button>
                    </div>
                  </>
                )}
              </div>
            ) : boltNotPaired ? (
              <div className="card">
                <div className="center" style={{ fontSize: 28 }}>💳</div>
                <div className="center" style={{ fontWeight: 700 }}>ยังไม่ได้จับคู่เครื่องรูดบัตร</div>
                <div className="note-warn" style={{ marginTop: 8 }}>
                  ⚠️ เจ้าของร้านต้อง pair เครื่อง EDC ก่อน (ที่หน้า “ผู้ใช้”) จึงจะรับชำระแบบรูดบัตรที่เครื่องได้
                </div>
                <div className="btn-row">
                  <button className="btn" disabled={busy} onClick={() => startBolt('DEEP_LINK')}>📱 ใช้ QR (มือถือ) แทน</button>
                  <button className="btn ghost" disabled={busy} onClick={() => setBoltNotPaired(false)}>ปิด</button>
                </div>
              </div>
            ) : (
              <div className="pay-grid">
                <button type="button" className="pay" onClick={() => doPay('cash')}>
                  <div className="ico"><Icon name="banknote" size={20} /></div>
                  <div className="grow"><div>เงินสด</div><div className="desc">รับเป็นเงินสด</div></div>
                  <div className="price tnum">{baht(total)}</div>
                </button>
                {boltPaired ? (
                  <>
                    <button type="button" className="pay" onClick={() => startBolt('PAIRING', 'CARD')}>
                      <div className="ico"><Icon name="credit-card" size={20} /></div>
                      <div className="grow"><div>บัตร (รูดที่เครื่อง EDC)</div><div className="desc">เสียบ/แตะบัตรที่เครื่องที่จับคู่ไว้</div></div>
                    </button>
                    <button type="button" className="pay" onClick={() => startBolt('PAIRING', 'QR_PROMPT_PAY')}>
                      <div className="ico"><Icon name="qr-code" size={20} /></div>
                      <div className="grow"><div>QR ที่เครื่อง EDC</div><div className="desc">โชว์ QR PromptPay บนหน้าจอเครื่อง</div></div>
                    </button>
                    <button type="button" className="pay" onClick={() => startBolt('DEEP_LINK')}>
                      <div className="ico"><Icon name="smartphone" size={20} /></div>
                      <div className="grow"><div>QR PromptPay (มือถือ)</div><div className="desc">ให้ลูกค้าสแกนบนมือถือ</div></div>
                    </button>
                  </>
                ) : (
                  <button type="button" className="pay" onClick={() => startBolt('DEEP_LINK')}>
                    <div className="ico"><Icon name="qr-code" size={20} /></div>
                    <div className="grow"><div>บัตร / QR PromptPay</div><div className="desc">สแกน QR PromptPay เพื่อชำระ</div></div>
                  </button>
                )}
                <button type="button" className="pay" onClick={() => doPay('unpaid')}>
                  <div className="ico"><Icon name="clock" size={20} /></div>
                  <div className="grow"><div>ค้างชำระ</div><div className="desc">ไว้จ่ายภายหลัง</div></div>
                </button>
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
          <div key={it.id}>
            <div className="rl">
              <span>{it.service_name} ×{N(it.qty)}{it.is_staff_price ? ' (ราคาพนักงาน)' : ''}</span>
              <span className="tnum">{baht(N(it.quoted_price) * N(it.qty))}</span>
            </div>
            {N(it.discount_amount) > 0 && (
              <div className="rl"><span style={{ paddingLeft: 10, color: 'var(--rose-dark)' }}>ส่วนลดรายการ</span><span className="tnum" style={{ color: 'var(--rose-dark)' }}>-{baht(it.discount_amount)}</span></div>
            )}
          </div>
        ))}
        <div className="div" />
        <div className="rl"><span>ราคารวม</span><span className="tnum">{baht(t.items_gross)}</span></div>
        {N(t.discount_total) > 0 && (
          <div className="rl"><span style={{ color: 'var(--rose-dark)' }}>ส่วนลดรวม</span><span className="tnum" style={{ color: 'var(--rose-dark)' }}>-{baht(t.discount_total)}</span></div>
        )}
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

/* ───────────────────────── Settings (owner) ─────────────────────────
 * The four limits a พนักงาน can do WITHOUT owner approval. เจ้าของไม่จำกัด. */
function Settings({ flash }) {
  const [maxPct, setMaxPct] = useState('')
  const [maxBaht, setMaxBaht] = useState('')
  const [discQuota, setDiscQuota] = useState('')
  const [staffQuota, setStaffQuota] = useState('')
  const [usage, setUsage] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // per-staff settings
  const [storeDefaults, setStoreDefaults] = useState(null) // store effective defaults (from getStaffSettings)
  const [staffList, setStaffList] = useState([]) // [{ user_id, name, active, override, effective }]
  const [staffEdits, setStaffEdits] = useState({}) // { [user_id]: { max_discount_percent, max_discount_baht, daily_discount_quota, daily_staff_price_quota } }
  const [staffSaving, setStaffSaving] = useState({}) // { [user_id]: bool }

  const blank = (v) => (v == null ? '' : String(v))

  const loadStaff = () =>
    api.getStaffSettings()
      .then((d) => {
        setStoreDefaults(d.store)
        setStaffList(d.staff || [])
        const edits = {}
        for (const st of d.staff || []) {
          edits[st.user_id] = {
            max_discount_percent: blank(st.override.max_discount_percent),
            max_discount_baht: blank(st.override.max_discount_baht),
            daily_discount_quota: blank(st.override.daily_discount_quota),
            daily_staff_price_quota: blank(st.override.daily_staff_price_quota),
          }
        }
        setStaffEdits(edits)
      })
      .catch(() => flash('โหลดการตั้งค่าต่อพนักงานไม่สำเร็จ'))

  useEffect(() => {
    api.getSettings()
      .then((s) => {
        setMaxPct(String(N(s.max_discount_percent)))
        setMaxBaht(String(N(s.max_discount_baht)))
        setDiscQuota(String(N(s.daily_discount_quota)))
        setStaffQuota(String(N(s.daily_staff_price_quota)))
        setLoading(false)
      })
      .catch(() => { setLoading(false); flash('โหลดการตั้งค่าไม่สำเร็จ') })
    api.usageToday().then(setUsage).catch(() => setUsage(null))
    loadStaff()
  }, [])

  const save = () => {
    setSaving(true)
    api.updateSettings({
      max_discount_percent: N(maxPct),
      max_discount_baht: N(maxBaht),
      daily_discount_quota: N(discQuota),
      daily_staff_price_quota: N(staffQuota),
    })
      .then(() => { setSaving(false); flash('บันทึกการตั้งค่าแล้ว'); loadStaff() })
      .catch((e) => { setSaving(false); flash(e.status === 403 ? e.message : 'บันทึกไม่สำเร็จ: ' + e.message) })
  }

  const setEdit = (userId, field, value) => {
    setStaffEdits((prev) => ({ ...prev, [userId]: { ...prev[userId], [field]: value } }))
  }

  const saveStaff = (st) => {
    const userId = st.user_id
    const e = staffEdits[userId] || {}
    setStaffSaving((prev) => ({ ...prev, [userId]: true }))
    api.updateStaffSettings(userId, {
      max_discount_percent: e.max_discount_percent,
      max_discount_baht: e.max_discount_baht,
      daily_discount_quota: e.daily_discount_quota,
      daily_staff_price_quota: e.daily_staff_price_quota,
    })
      .then(() => { setStaffSaving((prev) => ({ ...prev, [userId]: false })); flash('บันทึกค่าของ ' + st.name + ' แล้ว'); loadStaff() })
      .catch((err) => { setStaffSaving((prev) => ({ ...prev, [userId]: false })); flash(err.status === 403 ? err.message : 'บันทึกไม่สำเร็จ: ' + err.message) })
  }

  if (loading) return <Loading />

  const store = storeDefaults || {}

  return (
    <>
      <div className="card form-card">
        <h3 style={{ margin: '0 0 8px' }}>ค่าเริ่มต้นทั้งร้าน</h3>
        <div className="meta" style={{ marginBottom: 10 }}>เพดาน/โควต้าที่พนักงานทำได้เองโดยไม่ต้องขออนุมัติเจ้าของ (เจ้าของไม่จำกัด)</div>

        <label htmlFor="store-max-pct">เพดานส่วนลด (%)</label>
        <input id="store-max-pct" name="store-max-pct" type="number" value={maxPct} onChange={(e) => setMaxPct(e.target.value)} placeholder="0" />

        <label htmlFor="store-max-baht">เพดานส่วนลด (บาท)</label>
        <input id="store-max-baht" name="store-max-baht" type="number" value={maxBaht} onChange={(e) => setMaxBaht(e.target.value)} placeholder="0" />

        <label htmlFor="store-disc-quota">โควต้าส่วนลดต่อวัน (ครั้ง)</label>
        <input id="store-disc-quota" name="store-disc-quota" type="number" value={discQuota} onChange={(e) => setDiscQuota(e.target.value)} placeholder="0" />

        <label htmlFor="store-staff-quota">โควต้าราคาพนักงานต่อวัน (ครั้ง)</label>
        <input id="store-staff-quota" name="store-staff-quota" type="number" value={staffQuota} onChange={(e) => setStaffQuota(e.target.value)} placeholder="0" />

        {usage && (
          <div className="meta" style={{ marginTop: 10 }}>
            วันนี้: ส่วนลด <span className="tnum">{N(usage.discount)}</span> ครั้ง · ราคาพนักงาน <span className="tnum">{N(usage.staff_price)}</span> ครั้ง · อนุมัติ <span className="tnum">{N(usage.override)}</span> ครั้ง
          </div>
        )}

        <div className="btn-row">
          <button className="btn" disabled={saving} onClick={save}>{saving ? 'กำลังบันทึก…' : 'บันทึก'}</button>
        </div>
      </div>

      <div className="card form-card">
        <h3 style={{ margin: '0 0 8px' }}>ตั้งค่าต่อพนักงาน</h3>
        <div className="meta" style={{ marginBottom: 10 }}>กำหนดเพดาน/โควต้าเฉพาะรายคน · ว่าง = ใช้ค่าร้าน</div>

        {staffList.length === 0 ? (
          <div className="meta">ยังไม่มีพนักงาน</div>
        ) : (
          staffList.map((st) => {
            const e = staffEdits[st.user_id] || {}
            const fields = [
              { key: 'max_discount_percent', label: 'เพดานส่วนลด (%)' },
              { key: 'max_discount_baht', label: 'เพดานส่วนลด (฿)' },
              { key: 'daily_discount_quota', label: 'โควต้าส่วนลด/วัน' },
              { key: 'daily_staff_price_quota', label: 'โควต้าราคาพนักงาน/วัน' },
            ]
            return (
              <div key={st.user_id} style={{ borderTop: '1px solid var(--line, #eee)', paddingTop: 10, marginTop: 10 }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>{st.name}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {fields.map((f) => (
                    <div key={f.key} style={{ flex: '1 1 120px', minWidth: 120 }}>
                      <label htmlFor={`staff-${st.user_id}-${f.key}`}>{f.label}</label>
                      <input
                        id={`staff-${st.user_id}-${f.key}`}
                        name={`staff-${st.user_id}-${f.key}`}
                        type="number"
                        value={e[f.key] ?? ''}
                        onChange={(ev) => setEdit(st.user_id, f.key, ev.target.value)}
                        placeholder={store[f.key] == null ? '0' : String(store[f.key])}
                      />
                    </div>
                  ))}
                </div>
                <div className="btn-row">
                  <button className="btn" disabled={!!staffSaving[st.user_id]} onClick={() => saveStaff(st)}>
                    {staffSaving[st.user_id] ? 'กำลังบันทึก…' : 'บันทึก'}
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>
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

          <div className="section-title" id="shop-code-label">รหัสร้าน (Shop code)</div>
          <input
            id="shop-code"
            name="shop-code"
            autoComplete="off"
            spellCheck={false}
            aria-labelledby="shop-code-label"
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
            <label htmlFor="signup-shop-name">ชื่อร้าน *</label>
            <input id="signup-shop-name" name="shop-name" autoComplete="organization" value={shopName} onChange={(e) => { setSignupErr(''); setShopName(e.target.value) }} placeholder="เช่น Lazy Nail สาขาทองหล่อ" />
            <label htmlFor="signup-owner-name">ชื่อเจ้าของ *</label>
            <input id="signup-owner-name" name="owner-name" autoComplete="name" value={ownerName} onChange={(e) => { setSignupErr(''); setOwnerName(e.target.value) }} placeholder="ชื่อเจ้าของร้าน" />
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
              <button type="button" className="li" key={u.id} onClick={() => { setPicked(u); setPin(''); setErr(''); setStep('pin') }}>
                <div className="avatar">{(u.name || '?').charAt(0).toUpperCase()}</div>
                <div className="grow">
                  <div className="name">{u.name}</div>
                  <div className="meta"><RoleBadge role={u.role} /></div>
                </div>
                <span className="chev"><Icon name="chevron-right" size={20} /></span>
              </button>
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
/* ── Beam Bolt device pairing (owner, on the Users page) ──
   Load this shop's connection status, then let the owner pair the EDC device by
   typing the 8-character code shown on the device screen. Mock backend returns
   boltConnectionId "boltc_mock". */
function BoltPairing({ flash, canManage }) {
  const [conn, setConn] = useState(null) // null=loading | { paired, boltConnectionId, deviceId }
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const load = () => api.boltConnection()
    .then(setConn)
    .catch(() => setConn({ paired: false }))
  useEffect(() => { load() }, [])

  const pair = () => {
    const c = code.trim()
    if (c.length !== 8) { setErr('กรุณากรอกรหัสจับคู่ 8 หลักจากหน้าจอเครื่องรูดบัตร'); return }
    setBusy(true)
    setErr('')
    api.pairBolt(c)
      .then((d) => {
        setBusy(false)
        setCode('')
        setConn({ paired: !!d.paired, boltConnectionId: d.boltConnectionId, deviceId: d.deviceId })
        flash && flash('จับคู่เครื่องรูดบัตรสำเร็จ')
      })
      .catch((e) => {
        setBusy(false)
        setErr(e.status === 403 ? e.message : (e.message || 'จับคู่ไม่สำเร็จ'))
      })
  }

  const paired = conn && conn.paired

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="row">
        <div className="grow">
          <div className="name" style={{ fontSize: 16 }}>💳 เครื่องรูดบัตร (Beam Bolt)</div>
          <div className="meta">จับคู่เครื่อง EDC เพื่อรับชำระแบบรูดบัตรที่เครื่อง</div>
        </div>
        {conn == null ? (
          <span className="badge pending">…</span>
        ) : paired ? (
          <span className="badge done">✓ จับคู่แล้ว</span>
        ) : (
          <span className="badge closed">ยังไม่ได้ pair</span>
        )}
      </div>

      {conn != null && paired && (
        <div className="meta" style={{ marginTop: 8 }}>
          อุปกรณ์: <b>{conn.deviceId || '-'}</b>
          {conn.boltConnectionId && <> · connection: <span style={{ wordBreak: 'break-all' }}>{conn.boltConnectionId}</span></>}
        </div>
      )}

      {!canManage ? (
        <div className="meta" style={{ marginTop: 10 }}>📱 เปิดบน iPad/คอมเพื่อจับคู่เครื่อง</div>
      ) : (
        <>
          <label style={{ marginTop: 12 }}>รหัสจับคู่ (8 หลักจากหน้าจอเครื่อง)</label>
          <div className="row">
            <input
              value={code}
              maxLength={8}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="เช่น A1B2C3D4"
              style={{ letterSpacing: 2, fontVariantNumeric: 'tabular-nums' }}
            />
            <button
              className="btn"
              style={{ width: 'auto', padding: '12px 18px' }}
              disabled={busy || code.trim().length !== 8}
              onClick={pair}
            >
              {busy ? 'กำลัง pair…' : (paired ? 'Pair ใหม่' : 'Pair เครื่อง')}
            </button>
          </div>
          {err && <div className="note-warn" style={{ marginTop: 8 }}>⚠️ {err}</div>}
        </>
      )}
    </div>
  )
}

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
        <BoltPairing flash={flash} canManage={canManage} />
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
      <BoltPairing flash={flash} canManage={canManage} />
      {ownerPhone ? (
        <ManageHint />
      ) : (
        canManage && <button className="btn" onClick={onNewUser}><Icon name="plus" size={20} /> เพิ่มผู้ใช้ใหม่</button>
      )}
      <div className="spacer" />
      {list.map((u) => (
        <button type="button" className="li" key={u.id} disabled={ownerPhone} onClick={ownerPhone ? undefined : () => onEditUser(u)} style={ownerPhone ? { cursor: 'default' } : undefined}>
          <div className="avatar">{(u.name || '?').charAt(0).toUpperCase()}</div>
          <div className="grow">
            <div className="name" style={u.active === false ? { color: 'var(--muted)', textDecoration: 'line-through' } : undefined}>{u.name}</div>
            <div className="meta">
              <RoleBadge role={u.role} />{' '}
              {u.active === false ? <span className="badge closed">ปิดใช้งาน</span> : <span className="badge done">ใช้งานอยู่</span>}
            </div>
          </div>
          {!ownerPhone && <span className="chev"><Icon name="chevron-right" size={20} /></span>}
        </button>
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
    <div className="card form-card">
      <label htmlFor="user-name">ชื่อ *</label>
      <input id="user-name" name="user-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="ชื่อผู้ใช้" />

      <label htmlFor="user-role">บทบาท (Role)</label>
      <select id="user-role" name="user-role" value={role} onChange={(e) => setRole(e.target.value)}>
        <option value="owner">เจ้าของร้าน (owner)</option>
        <option value="staff">พนักงาน (staff)</option>
      </select>

      <label htmlFor="user-pin">{editing ? 'PIN ใหม่ (เว้นว่าง = ไม่เปลี่ยน)' : 'PIN (4–6 หลัก) *'}</label>
      <input
        id="user-pin"
        type="tel"
        inputMode="numeric"
        autoComplete="off"
        value={pin}
        onChange={(e) => { setPinErr(''); setPin(e.target.value.replace(/\D/g, '').slice(0, 6)) }}
        placeholder="••••"
      />
      {pinErr && <div className="pin-err">{pinErr}</div>}

      {editing && (
        <>
          <label>สถานะ</label>
          <div className="segmented" role="group" aria-label="สถานะ">
            <button type="button" className="seg" aria-pressed={active} onClick={() => setActive(true)}>ใช้งานอยู่</button>
            <button type="button" className="seg" aria-pressed={!active} onClick={() => setActive(false)}>ปิดใช้งาน</button>
          </div>
        </>
      )}

      <div className="btn-row">
        <button className="btn ghost" disabled={saving} onClick={onCancel}>ยกเลิก</button>
        <button className="btn" disabled={saving} onClick={save}>{saving ? 'กำลังบันทึก…' : 'บันทึก'}</button>
      </div>
    </div>
  )
}

/* ───────────────────────── Report (owner) ───────────────────────── */
// method code -> Thai label
const REPORT_METHOD_TH = { cash: 'เงินสด', beam_edc: 'บัตร/EDC' }

/* ── reports charts: inline SVG, no deps ──
   Colours come from the CI design tokens (var(--accent) orange + semantic
   ok/warn/bad/muted). No required animation → reduced-motion safe. */
const CHART_COLORS = ['var(--accent)', 'var(--ok)', 'var(--warn)', 'var(--bad)', 'var(--rose-dark)', 'var(--muted)']

// short day label e.g. '06-25' from 'YYYY-MM-DD'
const chartDayShort = (s) => (typeof s === 'string' && s.length >= 10 ? s.slice(5) : s)

// Daily revenue → line chart (sparkline-style with area + dots).
function DailyLineChart({ daily }) {
  const W = 600, H = 180, padL = 8, padR = 8, padT = 12, padB = 22
  const pts = daily.map((d) => N(d.amount))
  const max = pts.reduce((m, v) => Math.max(m, v), 0)
  const n = pts.length
  const innerW = W - padL - padR
  const innerH = H - padT - padB
  // x positions; with a single point centre it.
  const xAt = (i) => (n <= 1 ? W / 2 : padL + (innerW * i) / (n - 1))
  const yAt = (v) => padT + innerH - (max > 0 ? (v / max) * innerH : 0)
  const linePath = pts.map((v, i) => `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`).join(' ')
  const areaPath = `${linePath} L${xAt(n - 1).toFixed(1)},${(padT + innerH).toFixed(1)} L${xAt(0).toFixed(1)},${(padT + innerH).toFixed(1)} Z`
  const label = `กราฟแนวโน้มรายวัน ${n} วัน, ยอดสูงสุด ${baht(max)}`
  return (
    <div className="chart chart-line" role="img" aria-label={label}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" width="100%" height={H} focusable="false" aria-hidden="true">
        <path className="chart-area" d={areaPath} />
        <path className="chart-stroke" d={linePath} fill="none" />
        {pts.map((v, i) => (
          <circle key={i} className="chart-dot" cx={xAt(i)} cy={yAt(v)} r={n > 30 ? 1.5 : 3}>
            <title>{`${chartDayShort(daily[i].day)} · ${baht(v)}`}</title>
          </circle>
        ))}
      </svg>
      <div className="chart-xaxis" aria-hidden="true">
        <span className="tnum">{chartDayShort(daily[0]?.day)}</span>
        {n > 1 && <span className="tnum">{chartDayShort(daily[n - 1]?.day)}</span>}
      </div>
    </div>
  )
}

// Payment methods → donut chart with colour swatches + labels.
function PaymentDonutChart({ byMethod }) {
  const segs = byMethod.map((m) => ({ key: m.method, label: REPORT_METHOD_TH[m.method] || m.method, value: N(m.amount) }))
  const total = segs.reduce((s, x) => s + x.value, 0)
  const R = 60, stroke = 26, C = 2 * Math.PI * R, cx = 80, cy = 80
  let offset = 0
  const label = 'สัดส่วนยอดขายตามวิธีจ่าย: ' + segs.map((s) => `${s.label} ${baht(s.value)}`).join(', ')
  return (
    <div className="chart chart-donut" role="img" aria-label={label}>
      <svg viewBox="0 0 160 160" width="160" height="160" focusable="false" aria-hidden="true">
        <circle cx={cx} cy={cy} r={R} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
        {total > 0 && segs.map((s, i) => {
          const frac = s.value / total
          const dash = `${(frac * C).toFixed(2)} ${C.toFixed(2)}`
          const dashOffset = (-offset * C).toFixed(2)
          offset += frac
          return (
            <circle key={s.key} cx={cx} cy={cy} r={R} fill="none"
              stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={stroke}
              strokeDasharray={dash} strokeDashoffset={dashOffset}
              transform={`rotate(-90 ${cx} ${cy})`}>
              <title>{`${s.label} · ${baht(s.value)} · ${Math.round(frac * 100)}%`}</title>
            </circle>
          )
        })}
        <text x={cx} y={cy - 4} textAnchor="middle" className="chart-donut-total">{baht(total)}</text>
        <text x={cx} y={cy + 14} textAnchor="middle" className="chart-donut-cap">รวม</text>
      </svg>
      <ul className="chart-legend">
        {segs.map((s, i) => (
          <li key={s.key}>
            <span className="chart-swatch" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} aria-hidden="true" />
            <span className="chart-legend-label">{s.label}</span>
            <span className="chart-legend-val tnum">{baht(s.value)}</span>
            <span className="chart-legend-pct tnum">{total > 0 ? Math.round((s.value / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// Top services → horizontal bar chart (value-labelled).
function TopServicesBarChart({ byService, limit = 8 }) {
  const rows = byService.slice(0, limit).map((s) => ({ key: s.service_id ?? s.name, name: s.name, value: N(s.amount), qty: N(s.qty) }))
  const max = rows.reduce((m, r) => Math.max(m, r.value), 0)
  const label = 'บริการขายดี: ' + rows.map((r) => `${r.name} ${baht(r.value)}`).join(', ')
  return (
    <div className="chart chart-bars" role="img" aria-label={label}>
      {rows.map((r, i) => (
        <div className="chart-bar-row" key={r.key}>
          <span className="chart-bar-name">{r.name}</span>
          <span className="chart-bar-track">
            <span className="chart-bar-fill"
              style={{ width: (max > 0 ? (r.value / max) * 100 : 0) + '%', background: CHART_COLORS[i % CHART_COLORS.length] }} />
          </span>
          <span className="chart-bar-val price tnum">{baht(r.value)}</span>
        </div>
      ))}
    </div>
  )
}

// local date -> 'YYYY-MM-DD' (browser-local, padded)
function ymd(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// compute {from,to} for a preset key
function reportRange(preset) {
  const now = new Date()
  const today = ymd(now)
  if (preset === 'today') return { from: today, to: today }
  if (preset === 'week') {
    const d = new Date(now)
    // Monday of current week (getDay: 0=Sun..6=Sat)
    const dow = (d.getDay() + 6) % 7 // 0=Mon..6=Sun
    d.setDate(d.getDate() - dow)
    return { from: ymd(d), to: today }
  }
  if (preset === 'month') {
    const d = new Date(now.getFullYear(), now.getMonth(), 1)
    return { from: ymd(d), to: today }
  }
  return { from: today, to: today } // custom defaults to today until edited
}

function Report({ flash }) {
  const [preset, setPreset] = useState('today')
  const [from, setFrom] = useState(() => reportRange('today').from)
  const [to, setTo] = useState(() => reportRange('today').to)
  const [data, setData] = useState(null)

  const load = (f, t) => {
    setData(null)
    api.reports(f, t).then(setData).catch((e) => { setData(false); flash && flash(e.status === 403 ? e.message : 'โหลดรายงานไม่สำเร็จ') })
  }

  // on mount: load today
  useEffect(() => { load(from, to) }, [])

  const pickPreset = (p) => {
    setPreset(p)
    if (p === 'custom') return // wait for date inputs
    const r = reportRange(p)
    setFrom(r.from)
    setTo(r.to)
    load(r.from, r.to)
  }

  const onCustomFrom = (v) => {
    setFrom(v)
    if (v && to) load(v, to)
  }
  const onCustomTo = (v) => {
    setTo(v)
    if (from && v) load(from, v)
  }

  const presets = [
    { v: 'today', l: 'วันนี้' },
    { v: 'week', l: 'สัปดาห์นี้' },
    { v: 'month', l: 'เดือนนี้' },
    { v: 'custom', l: 'กำหนดเอง' },
  ]

  const filterBar = (
    <div className="card" style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {presets.map((p) => (
          <button
            key={p.v}
            className={'btn ' + (preset === p.v ? 'secondary' : 'ghost')}
            style={{ width: 'auto', padding: '8px 14px' }}
            onClick={() => pickPreset(p.v)}
          >
            {p.l}
          </button>
        ))}
      </div>
      {preset === 'custom' && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginTop: 10 }}>
          <input type="date" value={from} onChange={(e) => onCustomFrom(e.target.value)} style={{ width: 'auto' }} />
          <span className="meta">ถึง</span>
          <input type="date" value={to} onChange={(e) => onCustomTo(e.target.value)} style={{ width: 'auto' }} />
        </div>
      )}
    </div>
  )

  if (data === null) return <>{filterBar}<Loading /></>
  if (data === false) return <>{filterBar}<div className="empty"><div className="big"><Icon name="banknote" size={32} /></div>โหลดรายงานไม่สำเร็จ</div></>

  const totals = data.totals || {}
  const byMethod = data.by_method || []
  const outstanding = data.outstanding || {}
  const byStaff = data.by_staff || []
  const byService = data.by_service || []
  const discounts = data.discounts || {}
  const daily = data.daily || []
  const noRevenue = N(totals.revenue) === 0 && N(totals.paid_bills) === 0
  const maxDaily = daily.reduce((m, d) => Math.max(m, N(d.amount)), 0)

  return (
    <>
      {filterBar}

      {/* 1. สรุปยอด */}
      <div className="card" style={{ marginBottom: 12 }}>
        <h3 style={{ margin: '0 0 10px' }}>สรุปยอด</h3>
        <div className="stats">
          <div className="stat primary">
            <div className="v">{baht(totals.revenue)}</div>
            <div className="l">ยอดขายรวม</div>
          </div>
          <div className="stat">
            <div className="v">{N(totals.paid_bills)}</div>
            <div className="l">จำนวนบิล</div>
          </div>
          <div className="stat">
            <div className="v">{baht(totals.avg_per_bill)}</div>
            <div className="l">เฉลี่ย/บิล</div>
          </div>
        </div>
        <div className="meta" style={{ marginTop: 8, color: 'var(--muted)' }}>นับเฉพาะบิลที่ชำระแล้ว</div>
      </div>

      {/* 2. แยกตามวิธีจ่าย */}
      <div className="card" style={{ marginBottom: 12 }}>
        <h3 style={{ margin: '0 0 10px' }}>แยกตามวิธีจ่าย</h3>
        {byMethod.length > 0 && <PaymentDonutChart byMethod={byMethod} />}
        <table className="data-table">
          <thead>
            <tr>
              <th>วิธีจ่าย</th>
              <th className="num">ยอด</th>
              <th className="num">บิล</th>
            </tr>
          </thead>
          <tbody>
            {byMethod.map((m) => (
              <tr key={m.method}>
                <td className="strong">{REPORT_METHOD_TH[m.method] || m.method}</td>
                <td className="num tnum">{baht(m.amount)}</td>
                <td className="num tnum">{N(m.count)}</td>
              </tr>
            ))}
            <tr style={{ color: 'var(--muted)' }}>
              <td>ค้างชำระ (ยังไม่จ่าย)</td>
              <td className="num tnum">{baht(outstanding.amount)}</td>
              <td className="num tnum">{N(outstanding.count)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 3. แยกตามพนักงาน */}
      <div className="card" style={{ marginBottom: 12 }}>
        <h3 style={{ margin: '0 0 10px' }}>แยกตามพนักงาน</h3>
        {byStaff.length === 0 ? (
          <div className="meta" style={{ color: 'var(--muted)' }}>ไม่มีข้อมูลในช่วงนี้</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>พนักงาน</th>
                <th className="num">ยอด</th>
                <th className="num">บิล</th>
              </tr>
            </thead>
            <tbody>
              {byStaff.map((s) => (
                <tr key={s.user_id ?? s.name}>
                  <td className="strong">{!s.name || s.name === '—' ? 'ไม่ระบุ' : s.name}</td>
                  <td className="num tnum">{baht(s.amount)}</td>
                  <td className="num tnum">{N(s.bills)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 4. แยกตามบริการ */}
      <div className="card" style={{ marginBottom: 12 }}>
        <h3 style={{ margin: '0 0 10px' }}>บริการขายดี</h3>
        {byService.length === 0 ? (
          <div className="meta" style={{ color: 'var(--muted)' }}>ไม่มีข้อมูลในช่วงนี้</div>
        ) : (
          <>
          <TopServicesBarChart byService={byService} />
          <table className="data-table">
            <thead>
              <tr>
                <th>บริการ</th>
                <th className="num">ยอด</th>
                <th className="num">จำนวน</th>
              </tr>
            </thead>
            <tbody>
              {byService.map((s) => (
                <tr key={s.service_id ?? s.name}>
                  <td className="strong">
                    {s.name}
                    {s.category && <span className="cat" style={{ fontSize: 12, color: 'var(--rose-dark)', background: 'var(--rose-soft)', padding: '2px 8px', borderRadius: 6, marginLeft: 6 }}>{s.category}</span>}
                  </td>
                  <td className="num tnum">{baht(s.amount)}</td>
                  <td className="num tnum">{N(s.qty)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </>
        )}
      </div>

      {/* 5. ส่วนลดที่ให้ */}
      <div className="card" style={{ marginBottom: 12 }}>
        <h3 style={{ margin: '0 0 6px' }}>ส่วนลดที่ให้</h3>
        <div className="price tnum" style={{ fontSize: 22, fontWeight: 800, color: 'var(--rose-dark)' }}>{baht(discounts.total)}</div>
        <div className="meta" style={{ color: 'var(--muted)' }}>ลด {N(discounts.events)} ครั้ง</div>
      </div>

      {/* 6. แนวโน้มรายวัน */}
      <div className="card" style={{ marginBottom: 12 }}>
        <h3 style={{ margin: '0 0 10px' }}>แนวโน้มรายวัน</h3>
        {daily.length === 0 ? (
          <div className="meta" style={{ color: 'var(--muted)' }}>ไม่มีข้อมูลในช่วงนี้</div>
        ) : (
          <>
            <DailyLineChart daily={daily} />
            <div className="chart-daily-list" style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
              {daily.map((d) => (
                <div key={d.day} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div className="meta tnum" style={{ width: 92, flex: 'none', color: 'var(--muted)' }}>{d.day}</div>
                  <div style={{ flex: 1, background: 'var(--rose-soft)', borderRadius: 6, height: 18, overflow: 'hidden' }}>
                    <div style={{ width: (maxDaily > 0 ? (N(d.amount) / maxDaily * 100) : 0) + '%', background: 'var(--accent)', height: '100%', borderRadius: 6 }} />
                  </div>
                  <div className="price tnum" style={{ width: 96, flex: 'none', textAlign: 'right' }}>{baht(d.amount)}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {noRevenue && (
        <div className="empty"><div className="big"><Icon name="banknote" size={32} /></div>ไม่มีข้อมูลในช่วงนี้</div>
      )}
    </>
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
