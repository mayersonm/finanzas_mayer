
import { normalizeCurrency } from './normalizers.js';

export function round(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export function parseAmount(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;

  const cleaned = String(value || '')
    .replace(/[^0-9,.-]/g, '')
    .replace(',', '.');
  const parsed = Number(cleaned);

  return Number.isFinite(parsed) ? parsed : 0;
}

export function currencyToPen(value, currency, rate) {
  const normalized = normalizeCurrency(currency || 'PEN');
  return normalized === 'USD' ? Number(value || 0) * Number(rate || 3.85) : Number(value || 0);
}

export function formatCurrency(value, currency = 'PEN') {
  const normalized = normalizeCurrency(currency);
  const symbol = normalized === 'USD' ? 'US$' : 'S/';
  return `${symbol} ${round(value).toFixed(2)}`;
}
