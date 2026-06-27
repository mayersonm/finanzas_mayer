import { AreaChart, Badge, Card, ProgressBar, Text, Title, type Color } from '@tremor/react';
import { EmptyState } from '../../../components/common/EmptyState';
import { percent } from '../../../lib/finance';
import { formatMoney } from '../../../lib/formatters';
import { categoryColors } from '../../../lib/tremorColors';
import type { Budget, DashboardData } from '../../../types/dashboard';

function key(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function budgetForCategory(data: DashboardData, category: string): Budget | undefined {
  const categoryKey = key(category);
  const direct = data.presupuestos.find((item) => key(item.cat) === categoryKey);
  if (direct) return direct;

  const rule = data.budgetRules?.find((item) => key(item.includedCategory) === categoryKey);
  if (!rule) return undefined;

  return data.presupuestos.find((item) => key(item.cat) === key(rule.budgetCategory));
}

export function AnalysisSection({ data }: { data: DashboardData }) {
  const totalCategorias = data.categorias.reduce((total, item) => total + item.monto, 0);
  const alerts = data.alertas || [];
  const insights = data.insights || [];
  const alertColor = (level: string): Color => {
    if (level === 'danger') return 'rose';
    if (level === 'warning') return 'amber';
    return 'sky';
  };

  return (
    <section className="grid gap-3 sm:gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(300px,0.6fr)]">
      <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-4 sm:!p-6">
        <Title>Tendencia</Title>
        <Text>Ingresos y gastos por fecha real</Text>
        <AreaChart
          className="mt-4 h-56 sm:mt-6 sm:h-80"
          data={data.meses}
          index="mes"
          categories={['ingresos', 'gastos']}
          colors={['emerald', 'rose']}
          valueFormatter={formatMoney}
          yAxisWidth={56}
          curveType="monotone"
          showGradient
          showLegend
        />
      </Card>

      <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-4 sm:!p-6">
        <Title>Categorias</Title>
        <Text>Impacto por categoria y presupuesto</Text>
        <div className="mt-4 space-y-3 sm:mt-5 sm:space-y-4">
          {data.categorias.length ? (
            data.categorias.map((item, index) => {
              const budget = budgetForCategory(data, item.cat);
              const pct = budget ? percent(item.monto, budget.limite) : percent(item.monto, totalCategorias);
              const color = categoryColors[index % categoryColors.length];
              const detail = budget
                ? `${pct}% del presupuesto ${budget.cat}`
                : `${pct}% del gasto categorizado`;

              return (
                <div key={item.cat}>
                  <div className="flex items-center justify-between gap-4">
                    <Text className="truncate font-semibold text-slate-200">{item.cat}</Text>
                    <span className="font-mono text-sm text-slate-100">{formatMoney(item.monto)}</span>
                  </div>
                  <ProgressBar className="mt-2" value={pct} color={color} />
                  <Text className="mt-1">{detail}</Text>
                  {budget ? (
                    <Text className="mt-0.5 text-xs">
                      Presupuesto usado: {formatMoney(budget.gasto)} / {formatMoney(budget.limite)}
                    </Text>
                  ) : null}
                </div>
              );
            })
          ) : (
            <EmptyState>Sin categorias para analizar.</EmptyState>
          )}
        </div>
      </Card>

      <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-4 sm:!p-6 lg:col-span-2">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Title>Alertas inteligentes</Title>
            <Text>Riesgos y vencimientos que conviene mirar primero</Text>
          </div>
          <Badge color={alerts.length ? 'amber' : 'emerald'}>{alerts.length || 'OK'}</Badge>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {alerts.length ? (
            alerts.map((item) => (
              <div key={`${item.title}-${item.message}`} className="rounded-tremor-default border border-slate-800 bg-slate-900/60 p-3">
                <Badge color={alertColor(item.level)}>{item.level}</Badge>
                <Text className="mt-2 font-semibold text-slate-100">{item.title}</Text>
                <Text className="mt-1">{item.message}</Text>
              </div>
            ))
          ) : (
            <div className="sm:col-span-2 lg:col-span-3">
              <EmptyState>Sin alertas fuertes por ahora.</EmptyState>
            </div>
          )}
        </div>
      </Card>

      <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-4 sm:!p-6 lg:col-span-2">
        <Title>Insights</Title>
        <Text>Lecturas accionables sobre el ciclo actual</Text>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {insights.length ? (
            insights.map((item) => (
              <div key={`${item.title}-${item.message}`} className="rounded-tremor-default border border-slate-800 bg-slate-900/60 p-3">
                <Text className="font-semibold text-slate-100">{item.title}</Text>
                <Text className="mt-1">{item.message}</Text>
              </div>
            ))
          ) : (
            <div className="sm:col-span-2 lg:col-span-3">
              <EmptyState>Sin insights suficientes todavia.</EmptyState>
            </div>
          )}
        </div>
      </Card>

      
    </section>
  );
}
