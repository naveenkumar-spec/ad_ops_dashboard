export function toFiniteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function formatAbsoluteNumber(value, maximumFractionDigits = 2) {
  const n = toFiniteNumber(value);
  if (n === null) return "";
  return n.toLocaleString(undefined, { maximumFractionDigits });
}

export function formatAbsoluteInteger(value) {
  const n = toFiniteNumber(value);
  if (n === null) return "";
  return Math.round(n).toLocaleString();
}

export function formatAbsoluteCurrency(value, code = "USD") {
  const n = toFiniteNumber(value);
  if (n === null) return "";
  return `${code} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatAbsolutePercent(value, digits = 2) {
  const n = toFiniteNumber(value);
  if (n === null) return "";
  return `${n.toFixed(digits)}%`;
}

export function safeTitle(value) {
  if (value === undefined || value === null) return "";
  return String(value);
}
