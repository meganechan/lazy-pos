export const outstandingAmount = (total, paid) => Math.max(0, Math.round((Number(total) - Number(paid)) * 100) / 100);
export function cashChange(received, outstanding) {
  if (!/^\d+(?:\.\d{0,2})?$/.test(String(received))) return null;
  const cents = Math.round(Number(received) * 100);
  const due = Math.round(outstanding * 100);
  return Number.isSafeInteger(cents) && due > 0 && cents >= due ? (cents - due) / 100 : null;
}
export const queueStateLabel = tech => tech.status !== 'busy' ? 'ว่าง' : tech.overrun ? 'เกินเวลา' : 'กำลังทำ';
