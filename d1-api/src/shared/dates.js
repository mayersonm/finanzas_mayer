
import { DEFAULT_TZ } from './constants.js';

export function formatMonth(date) {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}`;
}

export function monthLongName(date) {
  return [
    'Enero',
    'Febrero',
    'Marzo',
    'Abril',
    'Mayo',
    'Junio',
    'Julio',
    'Agosto',
    'Septiembre',
    'Octubre',
    'Noviembre',
    'Diciembre',
  ][date.getMonth()];
}

export function monthShortNameFromKey(value) {
  const part = parseDateKeyParts(value);
  return ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'][part.monthIndex];
}

export function monthLongNameFromKey(value) {
  const part = parseDateKeyParts(value);
  return [
    'Enero',
    'Febrero',
    'Marzo',
    'Abril',
    'Mayo',
    'Junio',
    'Julio',
    'Agosto',
    'Septiembre',
    'Octubre',
    'Noviembre',
    'Diciembre',
  ][part.monthIndex];
}

export function localIso(date) {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: DEFAULT_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date).replace(' ', 'T');
}

export function localDateKey(date) {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: DEFAULT_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function dateKeyFromParts(year, monthIndex, day) {
  const date = new Date(Date.UTC(year, monthIndex, day));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

export function parseDateKeyParts(value) {
  const match = String(value || '').slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    const now = new Date();
    const key = localDateKey(now);
    return parseDateKeyParts(key);
  }
  return {
    year: Number(match[1]),
    monthIndex: Number(match[2]) - 1,
    day: Number(match[3]),
  };
}

export function payCycleFromDate(date) {
  const parts = parseDateKeyParts(localDateKey(date || new Date()));
  const startMonthIndex = parts.day > 22 ? parts.monthIndex : parts.monthIndex - 1;
  const startYear = parts.year;
  const startKey = dateKeyFromParts(startYear, startMonthIndex, 22);
  const start = parseDateKeyParts(startKey);
  const endKey = dateKeyFromParts(start.year, start.monthIndex + 1, 22);
  const closeKey = endKey;
  return {
    key: startKey.slice(0, 7),
    closeKey: closeKey.slice(0, 7),
    startKey,
    endKey,
    closeDate: closeKey,
    label: monthLongNameFromKey(startKey),
    shortLabel: monthShortNameFromKey(startKey),
    rangeLabel: `${startKey.slice(8, 10)}/${startKey.slice(5, 7)}/${startKey.slice(0, 4)} - ${endKey.slice(8, 10)}/${endKey.slice(5, 7)}/${endKey.slice(0, 4)}`,
  };
}

export function dayBeforeKey(key) {
  const p = parseDateKeyParts(key);
  return dateKeyFromParts(p.year, p.monthIndex, p.day - 1);
}

// Ventana de un ciclo anclado al sueldo. `salaryDatesDesc` son las fechas de
// los sueldos (mas reciente primero, todas <= hoy). offset 0 = ciclo actual
// (desde el ultimo sueldo hasta hoy); -1 = anterior (entre dos sueldos); etc.
// Devuelve null si no hay sueldo para ese offset (el caller usa la malla 22).
export function salaryCycleWindow(salaryDatesDesc, todayKey, offset) {
  const idx = -Number(offset || 0);
  if (!Array.isArray(salaryDatesDesc) || idx < 0 || idx >= salaryDatesDesc.length) return null;
  const startKey = salaryDatesDesc[idx];
  const endKey = idx === 0 ? todayKey : dayBeforeKey(salaryDatesDesc[idx - 1]);
  return { startKey, endKey };
}

export function payCycleRelative(cycle, offset) {
  const start = parseDateKeyParts(cycle.startKey);
  return payCycleFromDate(new Date(Date.UTC(start.year, start.monthIndex + offset, 23, 12)));
}

export function monthRangeFromKey(monthKey) {
  const part = parseDateKeyParts(`${String(monthKey || '').slice(0, 7)}-01`);
  const startKey = dateKeyFromParts(part.year, part.monthIndex, 1);
  const endKey = dateKeyFromParts(part.year, part.monthIndex + 1, 0);
  const closeDate = dateKeyFromParts(part.year, part.monthIndex, 22);
  return {
    key: startKey.slice(0, 7),
    startKey,
    endKey,
    closeDate,
    label: monthLongNameFromKey(startKey),
    shortLabel: monthShortNameFromKey(startKey),
    rangeLabel: `${startKey.slice(8, 10)}/${startKey.slice(5, 7)}/${startKey.slice(0, 4)} - ${endKey.slice(8, 10)}/${endKey.slice(5, 7)}/${endKey.slice(0, 4)}`,
  };
}

export function daysBetween(fromDateKey, toDateKey) {
  const from = Date.parse(`${fromDateKey}T00:00:00Z`);
  const to = Date.parse(`${toDateKey}T00:00:00Z`);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return 9999;
  return Math.round((to - from) / 86400000);
}

export function weekRangeFromDate(today, cycle) {
  const parts = parseDateKeyParts(today);
  const date = new Date(Date.UTC(parts.year, parts.monthIndex, parts.day));
  const weekday = date.getUTCDay();
  const mondayOffset = (weekday + 6) % 7;
  const start = dateKeyFromParts(parts.year, parts.monthIndex, parts.day - mondayOffset);
  const end = dateKeyFromParts(parts.year, parts.monthIndex, parts.day + (6 - mondayOffset));
  return {
    startKey: maxDateKey(start, cycle.startKey),
    endKey: minDateKey(end, cycle.endKey),
  };
}

export function dateFromKey(value) {
  const parts = parseDateKeyParts(value);
  return new Date(Date.UTC(parts.year, parts.monthIndex, parts.day, 12));
}

export function dateInRange(value, start, end) {
  const date = String(value || '').slice(0, 10);
  return date && date >= start && date <= end;
}

export function minDateKey(a, b) {
  return String(a || '') <= String(b || '') ? a : b;
}

export function maxDateKey(a, b) {
  return String(a || '') >= String(b || '') ? a : b;
}

export function nextFinancialClose(date) {
  const today = localDateKey(date || new Date());
  const parts = parseDateKeyParts(today);
  const thisMonthClose = dateKeyFromParts(parts.year, parts.monthIndex, 22);
  const closeDate = today <= thisMonthClose
    ? thisMonthClose
    : dateKeyFromParts(parts.year, parts.monthIndex + 1, 22);

  return {
    closeDate,
    daysLeft: Math.max(1, daysBetween(today, closeDate) + 1),
  };
}
