
import { httpError } from './http.js';

export function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.trunc(value)));
}

export function normalizeKey(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizePaymentMethod(value) {
  const key = normalizeKey(value);
  if (!key || key === 'desconocido' || key === 'unknown') return '';

  if (/\b(credito|credit|tc)\b/.test(key)) return 'credito';
  if (/\b(debito|debit|td|efectivo|cash|yape|plin|transferencia)\b/.test(key)) return 'debito';

  return '';
}

export function normalizeDateOnly(value) {
  const text = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  return '';
}

export function normalizeMonthKey(value) {
  const text = String(value || '').trim();
  if (/^\d{4}-\d{2}$/.test(text)) return text;
  return '';
}

export function normalizeCurrency(value) {
  const currency = String(value || 'PEN').trim().toUpperCase();
  if (currency === 'USD') return 'USD';
  if (currency === 'PEN') return 'PEN';
  throw httpError(400, 'Moneda invalida. Solo se acepta PEN o USD.');
}

export function normalizeInvestorProfile(value) {
  const key = normalizeKey(value || 'conservador');
  if (key === 'agresivo') return 'agresivo';
  if (key === 'moderado') return 'moderado';
  return 'conservador';
}

export function normalizeInvestmentHorizon(value) {
  const key = normalizeKey(value || 'corto');
  if (key === 'largo') return 'largo';
  if (key === 'medio' || key === 'mediano') return 'medio';
  return 'corto';
}

export function title(value) {
  return normalizeKey(value)
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
