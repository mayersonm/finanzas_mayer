import { Badge, BarChart, Card, DonutChart, Metric, ProgressBar, Text, Title } from '@tremor/react';
import { KpiCard } from '../../components/dashboard/KpiCard';
import { EmptyState } from '../../components/common/EmptyState';
import { percent } from '../../lib/finance';
import { formatMoney } from '../../lib/formatters';
import { categoryColors } from '../../lib/tremorColors';
import type { DashboardData, RealExpenses } from '../../types/dashboard';

export function OverviewSection({
  data,
  realExpenses,
}: {
  data: DashboardData;
  realExpenses: RealExpenses;
}) {
  const totalCategorias = data.categorias.reduce((total, item) => total + item.monto, 0);
  const topCategory = data.categorias[0];
  const monthIncome = data.ingresosMes ?? data.ingresos;
  const monthBalance = data.balanceMes ?? monthIncome - data.gastosMes;
  const debtPending = data.deudaPendiente ?? 0;
  const generalNetBalance = data.balanceGeneralNeto ?? data.balanceNeto ?? data.balance - debtPending;
  const availableAfterCommitted = monthIncome - realExpenses.total;
  const spendingRate = monthIncome > 0 ? percent(data.gastosMes, monthIncome) : data.gastosMes > 0 ? 100 : 0;
  const commitmentRate = monthIncome > 0 ? percent(realExpenses.total, monthIncome) : realExpenses.total > 0 ? 100 : 0;

  return (
    <>
      <section className="grid gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          label="Balance general neto"
          value={formatMoney(generalNetBalance)}
          detail={`Deudas pendientes: ${formatMoney(debtPending)}`}
          color={generalNetBalance >= 0 ? 'emerald' : 'rose'}
        />
        <KpiCard
          label={`Balance ${data.mes}`}
          value={formatMoney(monthBalance)}
          detail={`${data.movimientos} movimientos registrados`}
          color={monthBalance >= 0 ? 'emerald' : 'rose'}
        />
        <KpiCard
          label="Gastos del mes"
          value={formatMoney(data.gastosMes)}
          detail={`${spendingRate}% de ingresos usados`}
          color={spendingRate >= 100 ? 'rose' : spendingRate >= 75 ? 'amber' : 'sky'}
        />
        <KpiCard
          label="Libre estimado"
          value={formatMoney(availableAfterCommitted)}
          detail="Ingresos menos fijos y presupuesto"
          color={availableAfterCommitted >= 0 ? 'emerald' : 'rose'}
        />
        <KpiCard
          label="Comprometido"
          value={formatMoney(realExpenses.total)}
          detail={`${commitmentRate}% de tus ingresos`}
          color={commitmentRate >= 100 ? 'rose' : commitmentRate >= 80 ? 'amber' : 'violet'}
        />
      </section>

      <section className="mt-4 grid gap-3 sm:mt-5 sm:gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
        <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-4 sm:!p-6">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <Title>Ultimos 6 meses</Title>
              <Text>Ingresos contra gastos</Text>
            </div>
            <Badge color="emerald">S/</Badge>
          </div>
          <BarChart
            className="mt-4 h-56 sm:mt-6 sm:h-72"
            data={data.meses}
            index="mes"
            categories={['ingresos', 'gastos']}
            colors={['emerald', 'rose']}
            valueFormatter={formatMoney}
            yAxisWidth={56}
            showLegend
          />
        </Card>

        <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-4 sm:!p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Title>Gastos por categoria</Title>
              <Text>{topCategory ? `Principal: ${topCategory.cat}` : 'Sin gastos este mes'}</Text>
            </div>
            <Badge color="cyan">{data.categorias.length}</Badge>
          </div>
          {data.categorias.length ? (
            <>
              <DonutChart
                className="mt-4 h-48 sm:mt-6 sm:h-56"
                data={data.categorias}
                category="monto"
                index="cat"
                colors={categoryColors}
                valueFormatter={formatMoney}
                showLabel
              />
              <div className="mt-4 space-y-3 sm:mt-5">
                {data.categorias.slice(0, 5).map((item, index) => (
                  <div key={item.cat} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-200">{item.cat}</p>
                      <ProgressBar className="mt-2" value={percent(item.monto, totalCategorias)} color={categoryColors[index % categoryColors.length]} />
                    </div>
                    <p className="font-mono text-sm font-semibold text-slate-100">{formatMoney(item.monto)}</p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="mt-6">
              <EmptyState>Sin gastos este mes.</EmptyState>
            </div>
          )}
        </Card>
      </section>

      <section className="mt-4 grid gap-3 sm:mt-5 sm:gap-4 md:grid-cols-3">
        <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-4 sm:!p-6">
          <Text>Ingresos del mes</Text>
          <Metric className="mt-2 truncate text-xl sm:text-2xl">{formatMoney(monthIncome)}</Metric>
        </Card>
        <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-4 sm:!p-6">
          <Text>Fijos pendientes</Text>
          <Metric className="mt-2 truncate text-xl sm:text-2xl">{formatMoney(realExpenses.totalFijos)}</Metric>
        </Card>
        <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-4 sm:!p-6">
          <Text>Presupuesto considerado</Text>
          <Metric className="mt-2 truncate text-xl sm:text-2xl">{formatMoney(realExpenses.totalPresupuesto)}</Metric>
        </Card>
      </section>
    </>
  );
}
