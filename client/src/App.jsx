import { useState, useEffect } from 'react'
import { api, baht, getToken, getUser, setAuth, clearAuth } from './api'

const N = (v) => Number(v || 0)

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
  return <div className="note-warn manage-hint">📱 เปิดบน iPad/คอมเพื่อจัดการ</div>
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
          <button className="back" onClick={onBack}>‹</button>
        ) : (
          <span className="logo">💅</span>
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
          <button className="logout" onClick={doLogout} title="ออกจากระบบ">⎋</button>
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
        <button className="fab" onClick={() => setView({ kind: 'newTicket' })}>＋</button>
      )}

      {!view && (
        <div className="tabbar">
          <button className={tab === 'dashboard' ? 'active' : ''} onClick={() => goTab('dashboard')}>
            <span className="tico">📊</span>หน้าหลัก
          </button>
          <button className={tab === 'members' ? 'active' : ''} onClick={() => goTab('members')}>
            <span className="tico">👥</span>สมาชิก
          </button>
          <button className={tab === 'queue' ? 'active' : ''} onClick={() => goTab('queue')}>
            <span className="tico">⏱️</span>คิว
          </button>
          {/* staff pick services inside a ticket → hide the บริการ tab (lean) */}
          {isOwner && (
            <button className={tab === 'services' ? 'active' : ''} onClick={() => goTab('services')}>
              <span className="tico">💅</span>บริการ
            </button>
          )}
          <button className={tab === 'tickets' ? 'active' : ''} onClick={() => goTab('tickets')}>
            <span className="tico">🧾</span>บิล
          </button>
          {isOwner && (
            <button className={tab === 'users' ? 'active' : ''} onClick={() => goTab('users')}>
              <span className="tico">🔑</span>ผู้ใช้
            </button>
          )}
          {isOwner && (
            <button className={tab === 'audit' ? 'active' : ''} onClick={() => goTab('audit')}>
              <span className="tico">📜</span>บันทึก
            </button>
          )}
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

function Loading() {
  return <div className="empty"><div className="big">⏳</div>กำลังโหลด...</div>
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
        <button onClick={onNewTicket}><span className="ico">🧾</span>เปิดบิลใหม่</button>
        <button onClick={onNewMember}><span className="ico">➕</span>เพิ่มสมาชิก</button>
      </div>

      <div className="section-title">บิลที่เปิดอยู่</div>
      {!tickets ? (
        <Loading />
      ) : tickets.length === 0 ? (
        <div className="empty"><div className="big">✨</div>ยังไม่มีบิลที่เปิดอยู่</div>
      ) : (
        tickets.map((t) => (
          <div className="li" key={t.id} onClick={() => openTicket(t.id)}>
            <div className="avatar">{(t.member_name || t.staff_name || '?').charAt(0).toUpperCase()}</div>
            <div className="grow">
              <div className="name">{t.member_name || 'ลูกค้าทั่วไป'}</div>
              <div className="meta">โดย {t.staff_name || '-'} · <StatusBadge status={t.status} /></div>
            </div>
            <div className="price">{baht(t.total)}</div>
            <span className="chev">›</span>
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
        <button className="btn" onClick={onNewMember}>➕ เพิ่มสมาชิกใหม่</button>
      )}
      <div className="spacer" />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาชื่อ/เบอร์..." />
      <div className="spacer" />
      {!list ? (
        <Loading />
      ) : list.length === 0 ? (
        <div className="empty"><div className="big">👥</div>{q.trim() ? 'ไม่พบสมาชิกที่ค้นหา' : 'ยังไม่มีสมาชิก'}</div>
      ) : (
        list.map((m) => (
          <div className="li" key={m.id} onClick={() => openMember(m.id)}>
            <div className="avatar">{(m.name || '?').charAt(0).toUpperCase()}</div>
            <div className="grow">
              <div className="name">{m.name}</div>
              <div className="meta">{m.phone || 'ไม่มีเบอร์'}</div>
            </div>
            <span className="chev">›</span>
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
            <button className="btn" onClick={() => onNewTicket(m.id)}>🧾 เปิดบิลให้ลูกค้านี้</button>
          </div>
          <div className="btn-row">
            <button className="btn ghost" onClick={() => setEditing(true)}>✏️ แก้ไขข้อมูล</button>
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
            <div className="price">{baht(h.spent)}</div>
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
          <button className="btn" style={{ width: 'auto', padding: '12px 18px' }} onClick={() => setNav({ kind: 'new' })}>➕ เพิ่มบริการ</button>
        </div>
        {list.length === 0 ? (
          <div className="empty"><div className="big">💅</div>ยังไม่มีบริการ</div>
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
  if (list.length === 0) return <div className="empty"><div className="big">💅</div>ยังไม่มีบริการ</div>
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
                <div className="meta" style={{ fontSize: 13, color: 'var(--muted)' }}>{N(s.duration_min)} นาที</div>
              </div>
              <div className="price">{baht(s.base_price)}</div>
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
          <button className="btn secondary" style={{ width: 'auto', padding: '8px 14px' }} onClick={() => onEdit(s)}>✏️ แก้ไข</button>
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
          <button className="btn" disabled={busy} onClick={addOpt}>➕ เพิ่ม add-on</button>
        </div>
      </div>

      <div className="spacer" />
      <div className="btn-row">
        <button className="btn ghost" onClick={onBack}>‹ กลับไปรายการบริการ</button>
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
  if (list.length === 0) return <div className="empty"><div className="big">🧾</div>ยังไม่มีบิลที่เปิดอยู่</div>

  return (
    <>
      {list.map((t) => (
        <div className="li" key={t.id} onClick={() => openTicket(t.id)}>
          <div className="avatar">{(t.member_name || t.staff_name || '?').charAt(0).toUpperCase()}</div>
          <div className="grow">
            <div className="name">{t.member_name || 'ลูกค้าทั่วไป'}</div>
            <div className="meta">โดย {t.staff_name || '-'} · <StatusBadge status={t.status} /></div>
          </div>
          <div className="price">{baht(t.total)}</div>
          <span className="chev">›</span>
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
        <div className="empty"><div className="big">💁‍♀️</div>ยังไม่มีช่าง</div>
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
                {busy ? '🔴 ไม่ว่าง' : '🟢 ว่าง'}
              </span>
            </div>
          )
        })
      )}

      <div className="section-title">รอคิว / กำลังทำ</div>
      {waiting.length === 0 ? (
        <div className="empty"><div className="big">✨</div>ไม่มีงานในคิว</div>
      ) : (
        waiting.map((w) => (
          <div className="li" key={w.ticket_id} onClick={() => openTicket(w.ticket_id)}>
            <div className="avatar">{(w.member_name || '?').charAt(0).toUpperCase()}</div>
            <div className="grow">
              <div className="name">{w.member_name || 'ลูกค้าทั่วไป'}</div>
              <div className="meta">
                ช่าง: {w.assigned_name || 'ยังไม่มอบหมาย'} · ⏱️ ~{N(w.est_minutes)} นาที
              </div>
            </div>
            <span className="chev">›</span>
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
    api.authUsers().then(setTechs).catch(() => setTechs([]))
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
          ⚠️ ช่างไม่ว่างถึง {fmtTime(selBusy.busy_until)} — มอบหมายได้ (เข้าคิว)
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
  const [bolt, setBolt] = useState(null) // Beam Bolt PoC panel: { payment_id, boltIntentId, deepLinkUrl, mode, mock } | null
  const [boltErr, setBoltErr] = useState('') // inline Bolt failure message (failure enum)
  const [boltPaired, setBoltPaired] = useState(false) // shop has a paired EDC device → default PAIRING + offer QR fallback
  const [boltNotPaired, setBoltNotPaired] = useState(false) // create returned 400 ร้านยังไม่ได้ pair → owner-must-pair hint
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
    api.authUsers().then(setTechs).catch(() => setTechs([]))
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

  if (!t) return <Loading />

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
    if (!res) return false // still pending
    if (res.result === 'CH_SUCCEEDED') {
      if (res.ticket) setT(res.ticket)
      setBolt(null)
      setBoltErr('')
      flash('ชำระผ่าน Bolt สำเร็จ')
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

  const cancelBolt = () => { setBolt(null); setBoltErr(''); setBoltNotPaired(false) }
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
            ⏱️ เสร็จโดยประมาณ {fmtTime(t.busy_until)}
            {t.est_minutes ? ' (~' + N(t.est_minutes) + ' นาที)' : ''}
          </div>
        )}
        {!readOnly && !t.started_at && !isClosed && items.length > 0 && (
          <div className="btn-row">
            <button className="btn" disabled={busy} onClick={startWork}>▶️ เริ่มงาน</button>
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
              <div className="meta">จำนวน {N(it.qty)} · ⏱️ {N(it.minutes)} นาที</div>
            </div>
            <div className="price">{baht(N(it.quoted_price) * N(it.qty))}</div>
          </div>
        ))
      ) : (
        items.map((it) => (
          <div className="card" key={it.id}>
            <div className="row">
              <div className="grow">
                <div className="name">{it.service_name} {it.category && <span className="cat" style={{ fontSize: 12, color: 'var(--rose-dark)', background: 'var(--rose-soft)', padding: '2px 8px', borderRadius: 6 }}>{it.category}</span>}</div>
                <div className="meta">จำนวน {N(it.qty)} · ⏱️ {N(it.minutes)} นาที</div>
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
                    <div className="meta" style={{ fontSize: 13, color: 'var(--muted)' }}>{baht(s.base_price)} · {N(s.duration_min)} นาที</div>
                  </div>
                  <button disabled={busy || c === 0} onClick={() => removeOneOfService(s)}>−</button>
                  <span style={{ minWidth: 22, textAlign: 'center', fontWeight: 700 }}>{c}</span>
                  <button disabled={busy} onClick={() => addService(s)}>＋</button>
                </div>
              )
            })
          )}
        </>
      )}

      {/* TOTAL */}
      <div className="total-bar">
        <div className="t">ยอดรวม</div>
        <div className="v">{baht(total)}</div>
      </div>
      {estMinutes > 0 && (
        <div className="meta center" style={{ marginTop: 2 }}>⏱️ ~{estMinutes} นาที</div>
      )}

      {/* LINE QUOTE STEP */}
      {!(readOnly && !quote) && <div className="section-title">สรุปราคาทาง LINE</div>}
      {readOnly && !quote ? null : !quote ? (
        <button className="btn dark" disabled={busy || items.length === 0} onClick={sendQuote}>
          📲 ส่งสรุปราคาทาง LINE
        </button>
      ) : (
        <>
          <div className="line-chat">
            <div className="line-head">💬 {t.member ? t.member.name : 'ลูกค้า'}</div>
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
            <div className="center muted" style={{ marginTop: 10 }}>ลูกค้ายืนยันแล้ว ✅ ({fmtDate(quote.confirmed_at)})</div>
          ) : readOnly ? null : (
            <div className="btn-row">
              <button className="btn" disabled={busy} onClick={confirmQuote}>✅ ลูกค้า Confirm</button>
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
                      <div className="price" style={{ marginLeft: 8 }}>{baht(p.amount)}</div>
                    </div>
                    {!readOnly && !isVoided && (canRetry || canManage) && (
                      <div className="btn-row" style={{ marginTop: 6 }}>
                        {canRetry && (
                          <button className="btn secondary" style={{ width: 'auto', padding: '8px 14px' }} disabled={busy} onClick={() => retryPay(p)}>🔁 ลองรูดอีกครั้ง</button>
                        )}
                        {canManage && (
                          <button className="btn ghost" style={{ width: 'auto', padding: '8px 14px' }} disabled={busy} onClick={() => voidPay(p)}>ยกเลิก</button>
                        )}
                      </div>
                    )}
                    {reconcile === p.id && (
                      <div className="card" style={{ marginTop: 6, borderColor: 'var(--bad)' }}>
                        <div style={{ color: 'var(--bad)', fontWeight: 700 }}>⚠️ คีย์หมดอายุ (&gt;12 ชม.)</div>
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
            ) : edcStep ? (
              <div className="card">
                <div className="center" style={{ fontSize: 32 }}>💳</div>
                <div className="center muted" style={{ marginBottom: 10 }}>กำลังรูดบัตรผ่านเครื่อง Beam EDC / Bolt...</div>
                <div className="btn-row">
                  <button className="btn" disabled={busy} onClick={() => doPay('beam_edc')}>✅ จำลองสำเร็จ</button>
                  <button className="btn dark" disabled={busy} onClick={() => doPay('beam_edc', 'fail')}>⚠️ จำลองล้มเหลว</button>
                </div>
                <div className="btn-row">
                  <button className="btn ghost" disabled={busy} onClick={() => setEdcStep(false)}>ยกเลิก</button>
                </div>
              </div>
            ) : payFail ? (
              <div className="card">
                <div className="center" style={{ fontSize: 28 }}>⚠️</div>
                <div className="center" style={{ color: 'var(--bad)', fontWeight: 700 }}>EDC ล้มเหลว</div>
                <div className="center muted" style={{ marginBottom: 10 }}>บิลไม่ค้าง — เลือกวิธีสำรองได้เลย</div>
                <div className="pay-grid">
                  <div className="pay" onClick={() => doPay('cash')}>
                    <div className="ico">💵</div>
                    <div className="grow"><div>เงินสด</div><div className="desc">รับเป็นเงินสด</div></div>
                    <div className="price">{baht(total)}</div>
                  </div>
                  <div className="pay" onClick={() => doPay('unpaid')}>
                    <div className="ico">🕓</div>
                    <div className="grow"><div>ค้างชำระ</div><div className="desc">ไว้จ่ายภายหลัง</div></div>
                  </div>
                  <div className="pay" onClick={() => { setPayFail(false); setEdcStep(true) }}>
                    <div className="ico">🔁</div>
                    <div className="grow"><div>ลองรูดบัตรอีกครั้ง</div><div className="desc">Beam EDC</div></div>
                  </div>
                </div>
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
                <div className="pay" onClick={() => doPay('cash')}>
                  <div className="ico">💵</div>
                  <div className="grow"><div>เงินสด</div><div className="desc">Cash</div></div>
                  <div className="price">{baht(total)}</div>
                </div>
                <div className="pay" onClick={() => setEdcStep(true)}>
                  <div className="ico">💳</div>
                  <div className="grow"><div>บัตร (Beam EDC)</div><div className="desc">รูดบัตรเครดิต/เดบิต</div></div>
                </div>
                {boltPaired ? (
                  <>
                    <div className="pay" onClick={() => startBolt('PAIRING', 'CARD')}>
                      <div className="ico">💳</div>
                      <div className="grow"><div>รูดบัตรที่เครื่อง (Beam EDC) [PoC]</div><div className="desc">เครื่องที่จับคู่ไว้ — เสียบ/แตะบัตร</div></div>
                    </div>
                    <div className="pay" onClick={() => startBolt('PAIRING', 'QR_PROMPT_PAY')}>
                      <div className="ico">💳</div>
                      <div className="grow"><div>QR ที่เครื่อง (Beam EDC) [PoC]</div><div className="desc">โชว์ QR PromptPay บนเครื่อง EDC</div></div>
                    </div>
                    <div className="pay" onClick={() => startBolt('DEEP_LINK')}>
                      <div className="ico">📱</div>
                      <div className="grow"><div>QR (มือถือ) · PromptPay [PoC]</div><div className="desc">ให้ลูกค้าสแกน QR บนมือถือ</div></div>
                    </div>
                  </>
                ) : (
                  <div className="pay" onClick={() => startBolt('DEEP_LINK')}>
                    <div className="ico">📱</div>
                    <div className="grow"><div>บัตร (Beam Bolt · QR มือถือ) [PoC]</div><div className="desc">สแกน QR PromptPay เพื่อชำระ</div></div>
                  </div>
                )}
                <div className="pay" onClick={() => doPay('unpaid')}>
                  <div className="ico">🕓</div>
                  <div className="grow"><div>ค้างชำระ</div><div className="desc">Unpaid</div></div>
                </div>
              </div>
            )
          )}

          {isPaid && (
            <div className="center" style={{ color: 'var(--ok)', fontWeight: 700, margin: '8px 0' }}>✅ ชำระครบแล้ว {baht(paid)}</div>
          )}
        </>
      )}

      {/* CLOSE — available once paid OR an unpaid record exists (bill not stuck) */}
      {!readOnly && (isPaid || payments.length > 0) && (
        <div className="btn-row">
          <button className="btn dark" disabled={busy} onClick={closeBill}>🧾 ปิดบิล / Close</button>
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
            <span>{baht(N(it.quoted_price) * N(it.qty))}</span>
          </div>
        ))}
        <div className="div" />
        <div className="rl grand"><span>รวมทั้งสิ้น</span><span>{baht(total)}</span></div>
        <div className="rl"><span>ชำระแล้ว</span><span>{baht(paid)}</span></div>
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
        <button className="pinkey ghost" disabled={busy || pin.length === 0} onClick={onBack}>⌫</button>
        <button className="pinkey" disabled={busy} onClick={() => onPress('0')}>0</button>
        <button className="pinkey ok" disabled={busy || pin.length < minLen} onClick={onSubmit}>{busy ? '…' : okLabel}</button>
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
        <div className="login-logo">💅</div>
        <h1>Lazy Nail POS</h1>
        <div className="sub">
          {step === 'shop' ? 'เลือกร้านเพื่อเข้าสู่ระบบ'
            : step === 'signup' ? 'สมัครร้านใหม่'
            : step === 'user' ? 'เลือกผู้ใช้ของร้าน'
            : 'ใส่ PIN เพื่อเข้าสู่ระบบ'}
        </div>
      </div>

      {step === 'shop' ? (
        <div className="login-body">
          {newCode && (
            <div className="note-ok shop-code-banner">
              ✅ สร้างร้านสำเร็จ — ร้านของคุณคือรหัส: <b>{newCode}</b>
              <div className="meta" style={{ marginTop: 4 }}>เลือกร้านด้านล่างแล้วเข้าสู่ระบบด้วย PIN เจ้าของ</div>
            </div>
          )}

          <div className="section-title">เลือกร้าน</div>
          {!shops ? (
            <Loading />
          ) : shops.length === 0 ? (
            <div className="empty"><div className="big">🏪</div>ยังไม่มีร้าน</div>
          ) : (
            shops.map((s) => (
              <div className="li" key={s.id} onClick={() => chooseShop(s)}>
                <div className="avatar">🏪</div>
                <div className="grow">
                  <div className="name">{s.name}</div>
                  <div className="meta">รหัส: {s.code}</div>
                </div>
                <span className="chev">›</span>
              </div>
            ))
          )}

          <div className="section-title">หรือใส่ Shop code</div>
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
            <button className="btn ghost" onClick={() => { setSignupErr(''); setNewCode(''); setStep('signup') }}>➕ สมัครร้านใหม่</button>
          </div>
        </div>
      ) : step === 'signup' ? (
        <div className="login-body">
          <div className="btn-row" style={{ marginTop: 0, marginBottom: 6 }}>
            <button className="btn ghost" style={{ width: 'auto', padding: '8px 12px' }} onClick={() => { setSignupErr(''); setStep('shop') }}>‹ กลับ</button>
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
            <button className="btn ghost" style={{ width: 'auto', padding: '8px 12px' }} onClick={backToShop}>‹ เปลี่ยนร้าน</button>
          </div>
          <div className="li" style={{ marginBottom: 6 }}>
            <div className="avatar">🏪</div>
            <div className="grow">
              <div className="name">{shop ? shop.name : ''}</div>
              <div className="meta">รหัส: {shop ? shop.code : ''}</div>
            </div>
          </div>

          <div className="section-title">เลือกผู้ใช้</div>
          {!users ? (
            <Loading />
          ) : users.length === 0 ? (
            <div className="empty"><div className="big">🔒</div>ยังไม่มีผู้ใช้ในร้านนี้</div>
          ) : (
            users.map((u) => (
              <div className="li" key={u.id} onClick={() => { setPicked(u); setPin(''); setErr(''); setStep('pin') }}>
                <div className="avatar">{(u.name || '?').charAt(0).toUpperCase()}</div>
                <div className="grow">
                  <div className="name">{u.name}</div>
                  <div className="meta"><RoleBadge role={u.role} /></div>
                </div>
                <span className="chev">›</span>
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
              {busy ? 'กำลัง pair...' : (paired ? 'Pair ใหม่' : 'Pair เครื่อง')}
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
  if (list.length === 0) return <div className="empty"><div className="big">🔑</div>ยังไม่มีผู้ใช้</div>

  // owner + large → management table with inline edit
  if (wide && canManage) {
    return (
      <>
        <BoltPairing flash={flash} canManage={canManage} />
        <div className="btn-row" style={{ marginTop: 0, marginBottom: 12 }}>
          <button className="btn" style={{ width: 'auto', padding: '12px 18px' }} onClick={onNewUser}>➕ เพิ่มผู้ใช้ใหม่</button>
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
        canManage && <button className="btn" onClick={onNewUser}>➕ เพิ่มผู้ใช้ใหม่</button>
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
          {!ownerPhone && <span className="chev">›</span>}
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

  const save = () => {
    if (!name.trim()) { flash('กรุณากรอกชื่อ'); return }
    if (!editing && !/^\d{4,6}$/.test(pin)) { flash('PIN ต้องเป็นตัวเลข 4–6 หลัก'); return }
    if (editing && pin && !/^\d{4,6}$/.test(pin)) { flash('PIN ต้องเป็นตัวเลข 4–6 หลัก'); return }

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
        onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
        placeholder="••••"
      />

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
          <div className="empty"><div className="big">📜</div>ไม่มีบันทึกกิจกรรม</div>
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
        <div className="empty"><div className="big">📜</div>ไม่มีบันทึกกิจกรรม</div>
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
