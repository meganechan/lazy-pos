# Screenshots — Lazy Nails POS

Mobile-first (iPhone 390×844 @3x), captured from the live Docker build.

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

> Payment is decoupled from closing the sale (spec §1): EDC failure offers
> cash / unpaid fallback so a ticket never gets stuck. Beam & LINE are mocked
> behind swappable adapters (`server/adapters/`) — no real credentials.
> §4 INVARIANT 2: a beam_edc key older than 12h is never reused — the charge is
> marked failed and flagged for manual reconcile (screenshot 18).
