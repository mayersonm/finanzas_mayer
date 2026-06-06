
import { round } from './money.js';
import { normalizeCurrency } from './normalizers.js';

export function stableTransactionId({ rawId, chatId, fecha, hora, tipo, cat, monto, currency, desc }) {
  const provided = String(rawId || '').trim();
  if (provided && !/^\d+$/.test(provided) && !/^tx_[a-f0-9]{32}$/i.test(provided)) {
    return provided.slice(0, 180);
  }

  return [
    'tx',
    chatId,
    fecha,
    hora,
    tipo,
    cat,
    round(monto),
    normalizeCurrency(currency),
    desc,
  ].join(':').slice(0, 180);
}

export function cleanBase64(value) {
  return String(value || '')
    .replace(/^data:[^;]+;base64,/i, '')
    .replace(/\s/g, '');
}

export function base64ToBytes(value) {
  const cleaned = cleanBase64(value);

  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

export function normalizeImageContentType(value) {
  const contentType = String(value || '').toLowerCase();
  if (contentType === 'image/png') return 'image/png';
  if (contentType === 'image/webp') return 'image/webp';
  return 'image/jpeg';
}

export function imageExtension(contentType) {
  if (contentType === 'image/png') return 'png';
  if (contentType === 'image/webp') return 'webp';
  return 'jpg';
}

export function safeObjectSegment(value) {
  return String(value || 'item')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || 'item';
}

export function safeFileName(value) {
  const name = String(value || 'recibo')
    .split(/[\\/]/)
    .pop()
    .replace(/[\r\n"]/g, '')
    .trim();

  return name.slice(0, 120) || 'recibo';
}

export function safeHeaderFileName(value) {
  return safeFileName(value).replace(/[^\x20-\x7E]/g, '');
}
