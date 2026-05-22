import type { Budget, DashboardData, FixedExpense, RealExpenses } from '../types/dashboard';

export function percent(value: number, total: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0) return 0;
  return Math.min(Math.round((value / total) * 100), 100);
}

export function getRealExpenses(data: DashboardData): RealExpenses {
  if (data.gastosReales) return data.gastosReales;

  const totalFijos = (data.fijos || []).reduce((total, item) => total + (item.montoPen ?? item.monto), 0);
  const totalPresupuesto = data.presupuestos.reduce((total, item) => {
    return total + (item.gasto > 0 ? item.gasto : item.limite);
  }, 0);

  return {
    totalFijos,
    totalPresupuesto,
    total: totalFijos + totalPresupuesto,
  };
}

export function getBudgetConsidered(item: Budget): number {
  return item.gasto > 0 ? item.gasto : item.limite;
}

export function fixedStatus(item: FixedExpense): string {
  return item.estado || (item.pagadoMes ? 'pagado' : item.saltadoMes ? 'saltado' : 'pendiente');
}
