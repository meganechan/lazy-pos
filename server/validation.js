// Compare a rounded number, not amount*100 integer-ness (e.g. 0.29).
export function validAmount(amount) {
  return typeof amount === 'number' && Number.isFinite(amount)
    && amount > 0 && Math.round(amount * 100) / 100 === amount;
}

export function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function validateDateRange(req, res, next) {
  for (const key of ['from', 'to']) {
    if (req.query[key] !== undefined && !validDate(req.query[key]))
      return res.status(400).json({ error: `${key} must be a valid YYYY-MM-DD date` });
  }
  next();
}
