import { describe, expect, it } from 'vitest';
import {
  dateInRange,
  dateKeyFromParts,
  dayBeforeKey,
  daysBetween,
  maxDateKey,
  minDateKey,
  monthRangeFromKey,
  nextFinancialClose,
  parseDateKeyParts,
  payCycleFromDate,
  payCycleRelative,
  salaryCycleWindow,
} from '../src/shared/dates.js';

describe('salaryCycleWindow (ciclo anclado al sueldo)', () => {
  const salaries = ['2026-06-23', '2026-05-22', '2026-04-21']; // desc, mas reciente primero

  it('offset 0 = desde el ultimo sueldo hasta hoy', () => {
    expect(salaryCycleWindow(salaries, '2026-06-28', 0)).toEqual({ startKey: '2026-06-23', endKey: '2026-06-28' });
  });

  it('offset -1 = entre el sueldo anterior y el dia previo al ultimo', () => {
    expect(salaryCycleWindow(salaries, '2026-06-28', -1)).toEqual({ startKey: '2026-05-22', endKey: '2026-06-22' });
  });

  it('offset -2 = ciclo mas viejo', () => {
    expect(salaryCycleWindow(salaries, '2026-06-28', -2)).toEqual({ startKey: '2026-04-21', endKey: '2026-05-21' });
  });

  it('devuelve null si no hay sueldo para ese offset', () => {
    expect(salaryCycleWindow(salaries, '2026-06-28', -3)).toBeNull();
    expect(salaryCycleWindow([], '2026-06-28', 0)).toBeNull();
  });
});

describe('dayBeforeKey', () => {
  it('resta un dia cruzando mes', () => {
    expect(dayBeforeKey('2026-06-01')).toBe('2026-05-31');
    expect(dayBeforeKey('2026-06-23')).toBe('2026-06-22');
  });
});

describe('payCycleFromDate (ciclo 22 a 22)', () => {
  it('un dia despues del 22 abre el ciclo del mes actual', () => {
    const cycle = payCycleFromDate(new Date('2026-05-23T12:00:00Z'));
    expect(cycle.startKey).toBe('2026-05-22');
    expect(cycle.endKey).toBe('2026-06-22');
    expect(cycle.closeDate).toBe('2026-06-22');
  });

  it('antes o en el 22 pertenece al ciclo que abrio el mes anterior', () => {
    const cycle = payCycleFromDate(new Date('2026-05-22T12:00:00Z'));
    expect(cycle.startKey).toBe('2026-04-22');
    expect(cycle.endKey).toBe('2026-05-22');
  });

  it('cruza el cambio de anio en diciembre', () => {
    const cycle = payCycleFromDate(new Date('2025-12-30T12:00:00Z'));
    expect(cycle.startKey).toBe('2025-12-22');
    expect(cycle.endKey).toBe('2026-01-22');
  });

  it('payCycleRelative retrocede y avanza ciclos completos', () => {
    const current = payCycleFromDate(new Date('2026-05-25T12:00:00Z'));
    expect(payCycleRelative(current, -1).startKey).toBe('2026-04-22');
    expect(payCycleRelative(current, 1).startKey).toBe('2026-06-22');
  });
});

describe('nextFinancialClose', () => {
  it('si hoy es antes del 22, cierra el 22 del mismo mes', () => {
    expect(nextFinancialClose(new Date('2026-05-10T12:00:00Z')).closeDate).toBe('2026-05-22');
  });

  it('si hoy es despues del 22, cierra el 22 del mes siguiente', () => {
    expect(nextFinancialClose(new Date('2026-05-25T12:00:00Z')).closeDate).toBe('2026-06-22');
  });

  it('daysLeft nunca es menor que 1', () => {
    expect(nextFinancialClose(new Date('2026-05-22T12:00:00Z')).daysLeft).toBeGreaterThanOrEqual(1);
  });
});

describe('helpers de fecha', () => {
  it('daysBetween cuenta dias calendario', () => {
    expect(daysBetween('2026-05-01', '2026-05-08')).toBe(7);
    expect(daysBetween('2026-05-08', '2026-05-01')).toBe(-7);
  });

  it('daysBetween devuelve 9999 ante fechas invalidas', () => {
    expect(daysBetween('no-es-fecha', '2026-05-01')).toBe(9999);
  });

  it('dateInRange respeta limites inclusivos', () => {
    expect(dateInRange('2026-05-10', '2026-05-01', '2026-05-31')).toBe(true);
    expect(dateInRange('2026-06-01', '2026-05-01', '2026-05-31')).toBe(false);
  });

  it('min/maxDateKey comparan lexicograficamente', () => {
    expect(minDateKey('2026-05-01', '2026-04-30')).toBe('2026-04-30');
    expect(maxDateKey('2026-05-01', '2026-04-30')).toBe('2026-05-01');
  });

  it('dateKeyFromParts normaliza desbordes de mes', () => {
    expect(dateKeyFromParts(2026, 12, 1)).toBe('2027-01-01');
    expect(dateKeyFromParts(2026, 0, 0)).toBe('2025-12-31');
  });

  it('parseDateKeyParts extrae anio, mes (0-index) y dia', () => {
    expect(parseDateKeyParts('2026-05-22')).toEqual({ year: 2026, monthIndex: 4, day: 22 });
  });

  it('monthRangeFromKey cubre el mes calendario completo', () => {
    const range = monthRangeFromKey('2026-02');
    expect(range.startKey).toBe('2026-02-01');
    expect(range.endKey).toBe('2026-02-28');
    expect(range.closeDate).toBe('2026-02-22');
  });
});
