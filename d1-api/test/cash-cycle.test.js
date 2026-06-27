import { describe, expect, it } from 'vitest';
import { computeCashBalance } from '../src/modules/transactions/service.js';
import { resolveCurrentCycle } from '../src/modules/dashboard/service.js';

// D1 falso: enruta cada consulta por una subcadena del SQL. `route(sql)` devuelve
// la fila para .first() (o { results } para .all()). Suficiente para validar la
// logica de ramas sin levantar una base real.
function fakeDb(route) {
  const exec = (sql, kind) => {
    const value = route(sql);
    if (kind === 'all') return value ?? { results: [] };
    if (kind === 'run') return value ?? { success: true };
    return value ?? null;
  };
  return {
    prepare(sql) {
      return {
        bind() {
          return {
            first: async () => exec(sql, 'first'),
            all: async () => exec(sql, 'all'),
            run: async () => exec(sql, 'run'),
          };
        },
        first: async () => exec(sql, 'first'),
        all: async () => exec(sql, 'all'),
        run: async () => exec(sql, 'run'),
      };
    },
  };
}

const RATE = 3.85;

describe('computeCashBalance', () => {
  it('sin cierre de caja usa el acumulado ingresos - gastos - fijos pagados', async () => {
    const db = fakeDb((sql) => {
      if (sql.includes('app_settings')) return null; // no hay cierre anclado
      return null;
    });
    const result = await computeCashBalance({ DB: db }, 'chat1', RATE, {
      ingresos: 1000,
      gastos: 300,
      fixedPaid: 200,
    });
    expect(result.balance).toBe(500);
    expect(result.opening).toBeNull();
  });

  it('con cierre de caja: saldo de apertura + neto - fijos pagados a mano despues del cierre', async () => {
    const opening = { balance: 1000, at: '2026-06-01 00:00:00' };
    const db = fakeDb((sql) => {
      if (sql.includes('app_settings')) return { value: JSON.stringify(opening) };
      if (sql.includes('fixed_expense_month_status')) return { pagado: 150 };
      if (sql.includes('AS neto')) return { neto: 200, movimientos: 3 };
      return null;
    });
    const result = await computeCashBalance({ DB: db }, 'chat1', RATE, {});
    // 1000 (apertura) + 200 (neto movimientos) - 150 (fijo pagado a mano) = 1050
    expect(result.balance).toBe(1050);
    expect(result.opening.balance).toBe(1000);
    expect(result.opening.since).toBe(200);
    expect(result.opening.movimientos).toBe(3);
  });

  it('con cierre y sin fijos pagados a mano: solo apertura + neto (regresion del fix)', async () => {
    const opening = { balance: 800, at: '2026-06-01 00:00:00' };
    const db = fakeDb((sql) => {
      if (sql.includes('app_settings')) return { value: JSON.stringify(opening) };
      if (sql.includes('fixed_expense_month_status')) return { pagado: 0 };
      if (sql.includes('AS neto')) return { neto: -120, movimientos: 2 };
      return null;
    });
    const result = await computeCashBalance({ DB: db }, 'chat1', RATE, {});
    expect(result.balance).toBe(680); // 800 - 120
  });
});

describe('resolveCurrentCycle (anclado al sueldo)', () => {
  const now = new Date('2026-06-24T12:00:00Z'); // 24/06 en America/Lima
  // El query de sueldos es "SELECT DISTINCT tx_date ... salario ... ORDER BY DESC".
  const salaryDb = (dates) => fakeDb((sql) => {
    if (sql.includes('tx_date') && sql.includes('salario')) return { results: dates.map((d) => ({ tx_date: d })) };
    return null;
  });

  it('sin sueldos usa la malla 22->22', async () => {
    const cycle = await resolveCurrentCycle({ DB: salaryDb([]) }, 'chat1', now);
    expect(cycle.awaitingSalary).toBeFalsy();
    expect(cycle.startKey).toBe('2026-06-22'); // malla por fecha
    expect(cycle.key).toBe('2026-06');
  });

  it('el ciclo arranca el dia del sueldo, no el 22', async () => {
    const cycle = await resolveCurrentCycle({ DB: salaryDb(['2026-06-24']) }, 'chat1', now);
    expect(cycle.awaitingSalary).toBe(false);
    expect(cycle.startKey).toBe('2026-06-24'); // empieza con el sueldo
    expect(cycle.key).toBe('2026-06');
  });

  it('si el ultimo sueldo es del ciclo anterior, sigue en el (extendido a hoy)', async () => {
    const cycle = await resolveCurrentCycle({ DB: salaryDb(['2026-05-22']) }, 'chat1', now);
    expect(cycle.awaitingSalary).toBe(true);
    expect(cycle.startKey).toBe('2026-05-22'); // sueldo anterior
    expect(cycle.key).toBe('2026-05');
    expect(cycle.endKey).toBe('2026-06-24'); // hasta hoy
  });
});
