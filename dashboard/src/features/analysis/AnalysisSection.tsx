import { AreaChart, Card, ProgressBar, Text, Title } from '@tremor/react';
import { EmptyState } from '../../components/common/EmptyState';
import { percent } from '../../lib/finance';
import { formatMoney } from '../../lib/formatters';
import { categoryColors } from '../../lib/tremorColors';
import type { DashboardData } from '../../types/dashboard';

export function AnalysisSection({ data }: { data: DashboardData }) {
  const totalCategorias = data.categorias.reduce((total, item) => total + item.monto, 0);

  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.6fr)]">
      <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70">
        <Title>Tendencia</Title>
        <Text>Ingresos y gastos por mes</Text>
        <AreaChart
          className="mt-6 h-80"
          data={data.meses}
          index="mes"
          categories={['ingresos', 'gastos']}
          colors={['emerald', 'rose']}
          valueFormatter={formatMoney}
          yAxisWidth={74}
          curveType="monotone"
          showGradient
          showLegend
        />
      </Card>

      <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70">
        <Title>Categorias</Title>
        <Text>Distribucion del gasto actual</Text>
        <div className="mt-5 space-y-4">
          {data.categorias.length ? (
            data.categorias.map((item, index) => {
              const pct = percent(item.monto, totalCategorias);
              const color = categoryColors[index % categoryColors.length];

              return (
                <div key={item.cat}>
                  <div className="flex items-center justify-between gap-4">
                    <Text className="truncate font-semibold text-slate-200">{item.cat}</Text>
                    <span className="font-mono text-sm text-slate-100">{formatMoney(item.monto)}</span>
                  </div>
                  <ProgressBar className="mt-2" value={pct} color={color} />
                  <Text className="mt-1">{pct}% del total</Text>
                </div>
              );
            })
          ) : (
            <EmptyState>Sin categorias para analizar.</EmptyState>
          )}
        </div>
      </Card>
    </section>
  );
}
