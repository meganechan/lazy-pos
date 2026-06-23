# Screenshots — Lazy Nails POS

Mobile-first (iPhone 390×844 @3x), captured from the live Docker build.
Theme: muted/professional (aubergine + desaturated mauve, off-white) — re-shot
app-wide after the v0.4 redesign. RBAC requires login; 01–18 are shown logged in
as **owner**.

| # | File | Function |
|---|------|----------|
| 01 | `01-dashboard.png` | Dashboard — summary cards + quick actions + open tickets |
| 02 | `02-members-list.png` | Members list |
| 03 | `03-new-member-form.png` | New member form |
| 04 | `04-member-detail.png` | Member detail + visit history (spent) |
| 05 | `05-services.png` | Services catalog (grouped by category) |
| 06 | `06-new-ticket.png` | New ticket — pick member + staff |
| 07 | `07-ticket-checkout.png` | Checkout — add services, edit เสนอราคา, total |
| 08 | `08-line-quote-sent.png` | LINE quote sent (mock chat bubble) |
| 09 | `09-line-confirmed.png` | LINE customer confirmed |
| 10 | `10-edc-charging.png` | Beam EDC mock — charging (success/fail buttons) |
| 11 | `11-edc-fail-fallback.png` | EDC failed → decoupled fallback (bill not stuck) |
| 12 | `12-edc-success.png` | EDC success (after retry) — paid in full |
| 13 | `13-unpaid.png` | ค้างชำระ (unpaid) — close still allowed |
| 14 | `14-receipt-closed.png` | Receipt + closed ticket |
| 15 | `15-member-search.png` | Member search (filter by name/phone) |
| 16 | `16-edit-member.png` | Edit member (prefilled form) |
| 17 | `17-void-payment.png` | Void payment (row shows ยกเลิกแล้ว) |
| 18 | `18-edc-12h-reconcile.png` | EDC retry blocked >12h → manual reconcile (§4 INVARIANT 2) |
| 19 | `19-login.png` | Login — user picker (PIN auth, v0.4) |
| 20 | `20-login-pin.png` | Login — numeric PIN pad |
| 21 | `21-users-list.png` | Users page (owner) — role + active badges |
| 22 | `22-add-user.png` | Add user — name, role, PIN |
| 23 | `23-edit-user.png` | Edit user — role / PIN / activate-deactivate |
| 24 | `24-audit-log.png` | Audit log timeline (owner) + filter chips |
| 25 | `25-staff-blocked.png` | Logged in as **staff** — no Users/Audit tabs (UI gated) |
| 26 | `26-staff-no-void.png` | Staff ticket view — void button hidden (owner-only) |
| 27 | `27-queue-board.png` | Queue board (v0.6) — 🟢 available / 🔴 busy-until-HH:MM techs |
| 28 | `28-assign-busy-warning.png` | New ticket — assign technician + busy warning (override ok) |
| 29 | `29-ticket-time-tech.png` | Ticket — per-item ⏱️ minutes, est total, assigned tech, ▶️ start |
| 30 | `30-ticket-started-locked.png` | After start — เสร็จโดยประมาณ HH:MM (tech locked) |

> **RBAC (v0.4)**: PIN login per user (scrypt-hashed — separate from the SACRED
> idempotency hash), in-memory session token sent as `Authorization: Bearer`.
> Roles owner/staff; **server enforces every endpoint** (sensitive = owner-only →
> 403), UI gating is just UX. Demo PINs (demo-only, stored hashed): owner `1234`,
> staff `5678`. Audit log records login, user CRUD, service price change, payment
> void, ticket close.
>
> **Queue + service time (v0.6)**: each ticket_item has `minutes` (default from
> service.duration_min, editable); a ticket sums them into `est_minutes`. Starting a
> ticket with an assigned technician sets `started_at` → `busy_until = started_at +
> est_minutes`, locking that tech (🔴 busy) on the queue board until done/closed.
> Assigning a busy tech warns but allows override (queue).
>
> Payment is decoupled from closing the sale (spec §1): EDC failure offers
> cash / unpaid fallback so a ticket never gets stuck. Beam & LINE are mocked
> behind swappable adapters (`server/adapters/`) — no real credentials.
> §4 INVARIANT 2: a beam_edc key older than 12h is never reused — the charge is
> marked failed and flagged for manual reconcile (screenshot 18).
