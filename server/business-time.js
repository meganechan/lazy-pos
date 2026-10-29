// Shared by PostgreSQL sessions and browser report presets.
export const BUSINESS_TIME_ZONE = 'Asia/Bangkok';
export function businessDay(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
export function reportRange(preset, now = new Date()) {
  const today = businessDay(now);
  const day = new Date(`${today}T00:00:00Z`);
  if (preset === 'week') day.setUTCDate(day.getUTCDate() - (day.getUTCDay() + 6) % 7);
  if (preset === 'month') day.setUTCDate(1);
  return { from: day.toISOString().slice(0,10), to: today };
}
