import { Badge, Card, Text, Title } from '@tremor/react';
import { BudgetProgress } from '../../components/dashboard/BudgetProgress';
import { EmailPanel } from '../../components/dashboard/EmailPanel';
import { FixedExpenseRow } from '../../components/dashboard/FixedExpenseRow';
import { EmptyState } from '../../components/common/EmptyState';
import { formatMoney } from '../../lib/formatters';
import type { DashboardData, RealExpenses } from '../../types/dashboard';

export function CommitmentsSection({
  data,
  realExpenses,
}: {
  data: DashboardData;
  realExpenses: RealExpenses;
}) {
  const fixedExpenses = data.fijos || [];

  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Title>Gastos fijos</Title>
            <Text>{fixedExpenses.length} activos</Text>
          </div>
          <Badge color="amber">{formatMoney(realExpenses.totalFijos)}</Badge>
        </div>
        <div className="mt-5">
          {fixedExpenses.length ? (
            fixedExpenses.map((item) => <FixedExpenseRow key={item.nombre} item={item} />)
          ) : (
            <EmptyState>Sin gastos fijos registrados.</EmptyState>
          )}
        </div>
      </Card>

      <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Title>Presupuesto</Title>
            <Text>Si no hay gasto, se considera el limite completo.</Text>
          </div>
          <Badge color="sky">{formatMoney(realExpenses.totalPresupuesto)}</Badge>
        </div>
        <div className="mt-5">
          {data.presupuestos.length ? (
            data.presupuestos.map((item) => <BudgetProgress key={item.cat} item={item} />)
          ) : (
            <EmptyState>Sin presupuestos registrados.</EmptyState>
          )}
        </div>
      </Card>

      <div className="lg:col-span-2">
        <EmailPanel config={data.emailConfig} />
      </div>
    </section>
  );
}
