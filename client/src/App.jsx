import { useState, useEffect } from 'react'
import { api, baht } from './api'

const N = (v) => Number(v || 0)

// status -> Thai label
const statusTH = {
  open: 'เปิดบิล',
  in_progress: 'กำลังทำ',
  done: 'เสร็จแล้ว',
  closed: 'ปิดบิล',
}

export default function App() {
  const [tab, setTab] = useState('dashboard') // dashboard | members | services | tickets
  const [view, setView] = useState(null) // null | {kind:'member',id} | {kind:'ticket',id} | {kind:'newTicket'} | {kind:'newMember'}
  const [toast, setToast] = useState(null)

  const flash = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2200)
  }

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
  } else {
    if (tab === 'members') { title = 'สมาชิก'; sub = 'Members' }
    else if (tab === 'services') { title = 'บริการ'; sub = 'Services' }
    else if (tab === 'tickets') { title = 'บิลทั้งหมด'; sub = 'Tickets' }
  }

  // which tabs get a FAB (new ticket)
  const showFab = !view && (tab === 'dashboard' || tab === 'tickets')

  return (
    <div className="app">
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
      </div>

      <div className="content">
        {view ? (
          view.kind === 'member' ? (
            <MemberDetail id={view.id} onNewTicket={(mid) => setView({ kind: 'newTicket', preMember: mid })} flash={flash} openTicket={openTicket} />
          ) : view.kind === 'newMember' ? (
            <NewMember flash={flash} onDone={() => { setView(null); setTab('members') }} />
          ) : view.kind === 'newTicket' ? (
            <NewTicket flash={flash} preMember={view.preMember} onCreated={(t) => setView({ kind: 'ticket', id: t.id })} />
          ) : (
            <TicketView id={view.id} flash={flash} onClosed={() => goTab('tickets')} />
          )
        ) : tab === 'dashboard' ? (
          <Dashboard flash={flash} openTicket={openTicket} onNewTicket={() => setView({ kind: 'newTicket' })} onNewMember={() => setView({ kind: 'newMember' })} />
        ) : tab === 'members' ? (
          <Members openMember={openMember} onNewMember={() => setView({ kind: 'newMember' })} />
        ) : tab === 'services' ? (
          <Services />
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
          <button className={tab === 'services' ? 'active' : ''} onClick={() => goTab('services')}>
            <span className="tico">💅</span>บริการ
          </button>
          <button className={tab === 'tickets' ? 'active' : ''} onClick={() => goTab('tickets')}>
            <span className="tico">🧾</span>บิล
          </button>
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
function Dashboard({ flash, openTicket, onNewTicket, onNewMember }) {
  const [sum, setSum] = useState(null)
  const [tickets, setTickets] = useState(null)

  const load = () => {
    api.summary().then(setSum).catch(() => flash('โหลดสรุปไม่สำเร็จ'))
    api.tickets().then(setTickets).catch(() => setTickets([]))
  }
  useEffect(load, [])

  if (!sum) return <Loading />

  return (
    <>
      <div className="stats">
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
function Members({ openMember, onNewMember }) {
  const [list, setList] = useState(null)
  useEffect(() => {
    api.members().then(setList).catch(() => setList([]))
  }, [])

  if (!list) return <Loading />

  return (
    <>
      <button className="btn" onClick={onNewMember}>➕ เพิ่มสมาชิกใหม่</button>
      <div className="spacer" />
      {list.length === 0 ? (
        <div className="empty"><div className="big">👥</div>ยังไม่มีสมาชิก</div>
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

function MemberDetail({ id, flash, onNewTicket, openTicket }) {
  const [m, setM] = useState(null)
  useEffect(() => {
    api.member(id).then(setM).catch(() => flash('โหลดข้อมูลสมาชิกไม่สำเร็จ'))
  }, [id])

  if (!m) return <Loading />

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

      <div className="btn-row">
        <button className="btn" onClick={() => onNewTicket(m.id)}>🧾 เปิดบิลให้ลูกค้านี้</button>
      </div>

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

/* ───────────────────────── Services ───────────────────────── */
function Services() {
  const [list, setList] = useState(null)
  useEffect(() => {
    api.services().then(setList).catch(() => setList([]))
  }, [])

  if (!list) return <Loading />
  if (list.length === 0) return <div className="empty"><div className="big">💅</div>ยังไม่มีบริการ</div>

  const cats = groupByCat(list)

  return (
    <>
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

/* ───────────────────────── New ticket ───────────────────────── */
function NewTicket({ flash, preMember, onCreated }) {
  const [members, setMembers] = useState(null)
  const [memberId, setMemberId] = useState(preMember ? String(preMember) : '')
  const [staff, setStaff] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    api.members().then(setMembers).catch(() => setMembers([]))
  }, [])

  const create = () => {
    setCreating(true)
    const body = {}
    if (memberId) body.member_id = Number(memberId)
    if (staff.trim()) body.staff_name = staff.trim()
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
      <label>ช่างผู้ทำ</label>
      <input value={staff} onChange={(e) => setStaff(e.target.value)} placeholder="ชื่อช่าง" />
      <div className="btn-row">
        <button className="btn" disabled={creating} onClick={create}>{creating ? 'กำลังเปิด...' : 'เปิดบิล'}</button>
      </div>
    </div>
  )
}

/* ───────────────────────── Ticket / checkout ───────────────────────── */
function TicketView({ id, flash, onClosed }) {
  const [t, setT] = useState(null)
  const [services, setServices] = useState([])
  const [busy, setBusy] = useState(false)
  const [edcStep, setEdcStep] = useState(false) // showing EDC simulate buttons
  const [payFail, setPayFail] = useState(false) // EDC failed -> show fallback
  const [priceEdits, setPriceEdits] = useState({}) // itemId -> string

  const refresh = () => api.ticket(id).then(setT)

  useEffect(() => {
    api.ticket(id).then(setT).catch(() => flash('โหลดบิลไม่สำเร็จ'))
    api.services().then(setServices).catch(() => setServices([]))
  }, [id])

  if (!t) return <Loading />

  const total = N(t.total)
  const paid = N(t.paid)
  const isPaid = paid >= total && total > 0
  const isClosed = t.status === 'closed'
  const items = t.items || []
  const payments = t.payments || []
  const quote = t.quote
  const itemCount = (sid) => items.filter((it) => N(it.service_id) === N(sid)).reduce((a, it) => a + N(it.qty), 0)

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
            <div className="meta">ช่าง: {t.staff_name || '-'} · บิล #{t.id}</div>
          </div>
          <StatusBadge status={t.status} />
        </div>
      </div>

      {/* ITEMS in cart */}
      <div className="section-title">รายการในบิล</div>
      {items.length === 0 ? (
        <div className="empty">ยังไม่มีรายการ — เลือกบริการด้านล่าง</div>
      ) : (
        items.map((it) => (
          <div className="card" key={it.id}>
            <div className="row">
              <div className="grow">
                <div className="name">{it.service_name} {it.category && <span className="cat" style={{ fontSize: 12, color: 'var(--rose-dark)', background: 'var(--rose-soft)', padding: '2px 8px', borderRadius: 6 }}>{it.category}</span>}</div>
                <div className="meta">จำนวน {N(it.qty)}</div>
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
          </div>
        ))
      )}

      {/* SERVICE PICKER */}
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

      {/* TOTAL */}
      <div className="total-bar">
        <div className="t">ยอดรวม</div>
        <div className="v">{baht(total)}</div>
      </div>

      {/* LINE QUOTE STEP */}
      <div className="section-title">สรุปราคาทาง LINE</div>
      {!quote ? (
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
          ) : (
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
              {payments.map((p) => (
                <div className="li" key={p.id}>
                  <div className="grow">
                    <div className="name">{payMethodTH(p.method)} #{p.payment_seq}</div>
                    <div className="meta">{fmtDate(p.created_at)}</div>
                  </div>
                  <span className={'badge ' + (p.status || 'pending')}>{p.status || 'pending'}</span>
                  <div className="price" style={{ marginLeft: 8 }}>{baht(p.amount)}</div>
                </div>
              ))}
            </div>
          )}

          {!isPaid && (
            edcStep ? (
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
      {(isPaid || payments.length > 0) && (
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
