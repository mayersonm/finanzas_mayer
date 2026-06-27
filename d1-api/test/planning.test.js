import { describe, expect, it } from 'vitest';
import {
  budgetSummary,
  fixedExpensesSummary,
  freeMoneyPlan,
  realExpenses,
  weeklyGoalMessage,
} from '../src/modules/dashboard/planning.js';

describe('budgetSummary', () => {
  it('suma limites, gasto, restante (no negativo) y excedido', () => {
    const result = budgetSummary([
      { limite: 100, gasto: 120 },
      { limite: 200, gasto: 50 },
    ]);
    expect(result.limit).toBe(300);
    expect(result.spent).toBe(170);
    expect(result.remaining).toBe(150);
    expect(result.over).toBe(20);
  });

  it('devuelve ceros ante lista vacia', () => {
    expect(budgetSummary([])).toEqual({ limit: 0, spent: 0, remaining: 0, over: 0 });
  });
});

describe('fixedExpensesSummary', () => {
  it('separa pendientes, pagados manuales y saltados', () => {
    const result = fixedExpensesSummary([
      { estado: 'pendiente', monto: 100, currency: 'PEN' },
      { estado: 'pagado', monto: 50, currency: 'PEN', pagadoManual: true, pagadoPorTransaccion: false },
      { estado: 'saltado', monto: 30, currency: 'PEN' },
    ]);
    expect(result.pending).toBe(100);
    expect(result.paid).toBe(50);
    expect(result.skipped).toBe(30);
  });

  it('no cuenta como pagado manual lo pagado por transaccion', () => {
    const result = fixedExpensesSummary([
      { estado: 'pagado', monto: 80, currency: 'PEN', pagadoManual: false, pagadoPorTransaccion: true },
    ]);
    expect(result.paid).toBe(0);
  });

  it('convierte USD a PEN con la tasa', () => {
    const result = fixedExpensesSummary([{ estado: 'pendiente', monto: 10, currency: 'USD' }], 4);
    expect(result.pending).toBe(40);
  });
});

describe('realExpenses', () => {
  it('usa gasto si existe, si no el limite, y suma fijos pendientes', () => {
    const result = realExpenses(
      [{ estado: 'pendiente', monto: 100, currency: 'PEN' }],
      [{ limite: 200, gasto: 0 }, { limite: 100, gasto: 50 }],
    );
    expect(result.totalPresupuesto).toBe(250);
    expect(result.totalFijos).toBe(100);
    expect(result.total).toBe(350);
  });
});

describe('freeMoneyPlan', () => {
  const baseArgs = {
    now: new Date('2026-05-10T12:00:00Z'),
    settings: { savingsTargetAmount: 0, emergencyBufferAmount: 0, investorProfile: 'conservador', investmentHorizon: 'corto' },
    cierre: {},
    budget: { limit: 1000, remaining: 800 },
    fixedSummary: { pending: 0 },
    deudaPendiente: 0,
    goals: [],
    cashBalance: 2000,
    patrimonioDisponible: 2000,
    ingresosMes: 3000,
    gastosMes: 1000,
  };

  it('plan sano con caja suficiente', () => {
    const plan = freeMoneyPlan(baseArgs);
    expect(plan.status).toBe('healthy');
    expect(plan.baseBalance).toBe(2000);
    expect(plan.availableToSpend).toBe(800);
    expect(plan.daily.normal).toBeGreaterThan(0);
  });

  it('plan en rojo cuando el colchon supera la caja', () => {
    const plan = freeMoneyPlan({ ...baseArgs, cashBalance: 1000, settings: { ...baseArgs.settings, emergencyBufferAmount: 5000 } });
    expect(plan.status).toBe('danger');
    expect(plan.freeAfterCommitments).toBeLessThan(0);
  });

  it('el gasto diario nunca deja disponible negativo', () => {
    const plan = freeMoneyPlan(baseArgs);
    expect(plan.availableToSpend).toBeGreaterThanOrEqual(0);
    expect(plan.daily.safe).toBeLessThanOrEqual(plan.daily.normal);
  });

  it('reserva fijos pendientes antes del gasto disponible', () => {
    const plan = freeMoneyPlan({ ...baseArgs, fixedSummary: { pending: 1500 } });
    expect(plan.committedObligations).toBe(1500);
    expect(plan.freeAfterCommitments).toBe(500);
    expect(plan.availableToSpend).toBe(500);
  });

  it('incluye deudas que vencen en el ciclo dentro de las obligaciones', () => {
    const plan = freeMoneyPlan({ ...baseArgs, fixedSummary: { pending: 200 }, debtDueCycle: 300 });
    expect(plan.committedObligations).toBe(500);
    expect(plan.debtDueCycle).toBe(300);
    expect(plan.freeAfterCommitments).toBe(1500);
  });

  it('sin compromisos no cambia el calculo anterior', () => {
    const plan = freeMoneyPlan(baseArgs);
    expect(plan.committedObligations).toBe(0);
    expect(plan.freeAfterCommitments).toBe(2000);
    expect(plan.availableToSpend).toBe(800);
  });
});

describe('weeklyGoalMessage', () => {
  it('mensaje por estado', () => {
    expect(weeklyGoalMessage('empty', 0, 0, 0)).toMatch(/configura/i);
    expect(weeklyGoalMessage('over', 0, 50, 0)).toMatch(/50/);
    expect(weeklyGoalMessage('tight', 30, 0, 0)).toMatch(/30/);
    expect(weeklyGoalMessage('ok', 0, 0, 20)).toMatch(/20/);
  });
});
