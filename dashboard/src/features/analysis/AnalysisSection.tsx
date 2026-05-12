import { AreaChart, Card, ProgressBar, Text, Title } from '@tremor/react';
import { EmptyState } from '../../components/common/EmptyState';
import { percent } from '../../lib/finance';
import { formatMoney } from '../../lib/formatters';
import { categoryColors } from '../../lib/tremorColors';
import type { DashboardData } from '../../types/dashboard';

export function AnalysisSection({ data }: { data: DashboardData }) {
  const totalCategorias = data.categorias.reduce((total, item) => total + item.monto, 0);

  return (
    <section className="grid gap-3 sm:gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(300px,0.6fr)]">
      <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-4 sm:!p-6">
        <Title>Tendencia</Title>
        <Text>Ingresos y gastos por mes</Text>
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
        <Text>Distribucion del gasto actual</Text>
        <div className="mt-4 space-y-3 sm:mt-5 sm:space-y-4">
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
