import { Badge, Card, Text, Title } from '@tremor/react';
import { BudgetProgress } from '../../components/dashboard/BudgetProgress';
import { DebtRow } from '../../components/dashboard/DebtRow';
import { EmailPanel } from '../../components/dashboard/EmailPanel';
import { FixedExpenseRow } from '../../components/dashboard/FixedExpenseRow';
import { EmptyState } from '../../components/common/EmptyState';
import { formatMoney, convertCurrency } from '../../lib/formatters';
import type { DashboardData, RealExpenses } from '../../types/dashboard';

export function CommitmentsSection({
  data,
  realExpenses,
  exchangeRate = 3.85,
}: {
  data: DashboardData;
  realExpenses: RealExpenses;
  exchangeRate?: number;
}) {
  const fixedExpenses = data.fijos || [];
  const debts = data.deudas || [];
  const activeDebtTotal = debts
    .filter((item) => item.estado !== 'pagada')
    .reduce((total, item) => {
      const currency = item.currency || 'PEN';
      const pendienteEnPEN = currency === 'USD' ? convertCurrency(item.pendiente, 'USD', 'PEN', exchangeRate) : item.pendiente;
      return total + pendienteEnPEN;
    }, 0);

  return (
    <section className="grid gap-3 sm:gap-4 lg:grid-cols-2">
      <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-4 sm:!p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Title>Gastos fijos</Title>
            <Text>{fixedExpenses.length} activos</Text>
          </div>
          <Badge color="amber">{formatMoney(realExpenses.totalFijos)}</Badge>
        </div>
        <div className="mt-4 sm:mt-5">
          {fixedExpenses.length ? (
            fixedExpenses.map((item) => <FixedExpenseRow key={item.nombre} item={item} />)
          ) : (
            <EmptyState>Sin gastos fijos registrados.</EmptyState>
          )}
        </div>
      </Card>

      <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-4 sm:!p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Title>Deudas</Title>
            <Text>{debts.filter((item) => item.estado !== 'pagada').length} activas</Text>
          </div>
          <Badge color="rose">{formatMoney(activeDebtTotal)}</Badge>
        </div>
        <div className="mt-4 sm:mt-5">
          {debts.length ? (
            debts.map((item) => <DebtRow key={item.id || item.nombre} item={item} exchangeRate={exchangeRate} />)
          ) : (
            <EmptyState>Sin deudas registradas.</EmptyState>
          )}
        </div>
      </Card>

      <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-4 sm:!p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Title>Presupuesto</Title>
            <Text>Si no hay gasto, se considera el limite completo.</Text>
          </div>
          <Badge color="sky">{formatMoney(realExpenses.totalPresupuesto)}</Badge>
        </div>
        <div className="mt-4 sm:mt-5">
          {data.presupuestos.length ? (
            data.presupuestos.map((item) => <BudgetProgress key={item.cat} item={item} />)
          ) : (
            <EmptyState>Sin presupuestos registrados.</EmptyState>
          )}
        </div>
      </Card>

      <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-4 sm:!p-6">
        <div className="lg:col-span-2">
          <EmailPanel config={data.emailConfig} />
        </div>
      </Card>
    </section>
  );
}
