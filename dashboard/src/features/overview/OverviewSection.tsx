import { Badge, BarChart, Card, DonutChart, Metric, ProgressBar, Text, Title } from '@tremor/react';
import { KpiCard } from '../../components/dashboard/KpiCard';
import { EmptyState } from '../../components/common/EmptyState';
import { percent } from '../../lib/finance';
import { formatMoney } from '../../lib/formatters';
import { categoryColors } from '../../lib/tremorColors';
import type { ClosureSummary, DashboardData, RealExpenses } from '../../types/dashboard';

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
  const patrimonioDisponible = data.patrimonioDisponible ?? data.patrimonio ?? data.balanceGeneralNeto ?? data.balanceNeto ?? data.balance - debtPending;
  const fixedPending = data.fijosPendientes ?? realExpenses.totalFijos ?? 0;
  const budgetRemaining = data.presupuestos.reduce((total, item) => {
    return total + Math.max(Number(item.limite || 0) - Number(item.gasto || 0), 0);
  }, 0);
  const committedRemaining = fixedPending + budgetRemaining + debtPending;
  const projectedFree = monthBalance - committedRemaining;
  const spendingRate = monthIncome > 0 ? percent(data.gastosMes, monthIncome) : data.gastosMes > 0 ? 100 : 0;
  const commitmentRate = monthIncome > 0 ? percent(data.gastosMes + committedRemaining, monthIncome) : committedRemaining > 0 ? 100 : 0;
  const closure = getClosureSummary(data, {
    patrimonioDisponible,
    debtPending,
    fixedPending,
    budgetRemaining,
    monthIncome,
    monthBalance,
  });
  const closureBudgetPct = percent(closure.presupuestoUsado, closure.presupuestoLimite);

  return (
    <>
      <section className="grid gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          label="Patrimonio disponible"
          value={formatMoney(patrimonioDisponible)}
          detail={`Lo que queda tras deudas y fijos`}
          color={patrimonioDisponible >= 0 ? 'emerald' : 'rose'}
        />
        <KpiCard
          label="Balance del mes"
          value={formatMoney(monthBalance)}
          detail={`${data.mes} · ${data.movimientosMes ?? data.movimientos} movimientos`}
          color={monthBalance >= 0 ? 'emerald' : 'rose'}
        />
        <KpiCard
          label="Gastos del mes"
          value={formatMoney(data.gastosMes)}
          detail={`${spendingRate}% de ingresos usados`}
          color={spendingRate >= 100 ? 'rose' : spendingRate >= 75 ? 'amber' : 'sky'}
        />
        <KpiCard
          label="Libre proyectado"
          value={formatMoney(projectedFree)}
          detail="Balance menos deudas y pendientes"
          color={projectedFree >= 0 ? 'emerald' : 'rose'}
        />
        <KpiCard
          label="Pendiente comprometido"
          value={formatMoney(committedRemaining)}
          detail={`${commitmentRate}% de ingresos usados o reservados`}
          color={commitmentRate >= 100 ? 'rose' : commitmentRate >= 80 ? 'amber' : 'violet'}
        />
      </section>

      <section className="mt-4 grid gap-3 sm:mt-5 sm:gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(300px,0.75fr)]">
        <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-4 sm:!p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <Title>{closure.label || 'Cierre 23'}</Title>
              <Text>{data.mes} · cierre mensual {formatDateLabel(closure.closeDate)}</Text>
            </div>
            <Badge color={closure.queQueda >= 0 ? 'emerald' : 'rose'}>
              {closure.movimientos ?? data.movimientosMes ?? 0} movimientos
            </Badge>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <ClosureMetric label="Entro" value={formatMoney(closure.ingresos)} tone="text-emerald-300" />
            <ClosureMetric label="Salio" value={formatMoney(closure.gastos)} tone="text-rose-300" />
            <ClosureMetric label="Balance" value={formatMoney(closure.balance)} tone={closure.balance >= 0 ? 'text-emerald-300' : 'text-rose-300'} />
            <ClosureMetric label="Queda" value={formatMoney(closure.queQueda)} tone={closure.queQueda >= 0 ? 'text-emerald-300' : 'text-rose-300'} />
          </div>

          <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            <ClosureLine label="Fijos pagados" value={closure.fijosPagados} />
            <ClosureLine label="Fijos pendientes" value={closure.fijosPendientes} />
            <ClosureLine label="Deudas pendientes" value={closure.deudasPendientes} />
            <ClosureLine label="Pendiente comprometido" value={closure.pendienteComprometido} strong />
          </div>
        </Card>

        <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-4 sm:!p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Title>Presupuesto del cierre</Title>
              <Text>{closureBudgetPct}% usado</Text>
            </div>
            <Badge color={closure.presupuestoExcedido && closure.presupuestoExcedido > 0 ? 'rose' : closureBudgetPct >= 80 ? 'amber' : 'emerald'}>
              {formatMoney(closure.presupuestoUsado)}
            </Badge>
          </div>
          <ProgressBar className="mt-5" value={closureBudgetPct} color={closureBudgetPct >= 100 ? 'rose' : closureBudgetPct >= 80 ? 'amber' : 'emerald'} />
          <div className="mt-4 space-y-2 text-sm">
            <ClosureLine label="Limite" value={closure.presupuestoLimite} />
            <ClosureLine label="Usado" value={closure.presupuestoUsado} />
            <ClosureLine label="Restante" value={closure.presupuestoRestante} strong />
            {closure.presupuestoExcedido && closure.presupuestoExcedido > 0 ? (
              <ClosureLine label="Excedido" value={closure.presupuestoExcedido} danger />
            ) : null}
          </div>
        </Card>
      </section>

      <section className="mt-4 grid gap-3 sm:mt-5 sm:gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
        <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-4 sm:!p-6">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <Title>Ultimos 6 meses</Title>
              <Text>Por fecha real del movimiento</Text>
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
          <Metric className="mt-2 truncate text-xl sm:text-2xl">{formatMoney(fixedPending)}</Metric>
        </Card>
        <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-4 sm:!p-6">
          <Text>Presupuesto restante</Text>
          <Metric className="mt-2 truncate text-xl sm:text-2xl">{formatMoney(budgetRemaining)}</Metric>
        </Card>
      </section>
    </>
  );
}

function getClosureSummary(
  data: DashboardData,
  fallback: {
    patrimonioDisponible: number;
    debtPending: number;
    fixedPending: number;
    budgetRemaining: number;
    monthIncome: number;
    monthBalance: number;
  },
): ClosureSummary {
  if (data.cierre) return data.cierre;

  const presupuestoLimite = data.presupuestos.reduce((total, item) => total + Number(item.limite || 0), 0);
  const presupuestoUsado = data.presupuestos.reduce((total, item) => total + Number(item.gasto || 0), 0);
  const pendienteComprometido = fallback.debtPending + fallback.fixedPending + fallback.budgetRemaining;

  return {
    label: 'Cierre 23',
    range: data.cycleRange || [data.cycleStart, data.cycleEnd].filter(Boolean).join(' - '),
    start: data.cycleStart,
    end: data.cycleEnd,
    ingresos: fallback.monthIncome,
    gastos: data.gastosMes,
    balance: fallback.monthBalance,
    movimientos: data.movimientosMes,
    fijosPagados: data.fijosPagadosMes || 0,
    fijosPendientes: fallback.fixedPending,
    deudasPendientes: fallback.debtPending,
    presupuestoLimite,
    presupuestoUsado,
    presupuestoRestante: fallback.budgetRemaining,
    presupuestoExcedido: Math.max(presupuestoUsado - presupuestoLimite, 0),
    pendienteComprometido,
    queQueda: fallback.monthBalance - pendienteComprometido,
    patrimonioDisponible: fallback.patrimonioDisponible,
  };
}

function ClosureMetric({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="min-w-0 border-l border-slate-700 pl-3">
      <Text>{label}</Text>
      <p className={`mt-1 truncate font-mono text-lg font-semibold sm:text-xl ${tone}`}>{value}</p>
    </div>
  );
}

function ClosureLine({ label, value, strong, danger }: { label: string; value: number; strong?: boolean; danger?: boolean }) {
  const valueClass = danger
    ? 'text-rose-300'
    : strong
      ? 'text-slate-100'
      : 'text-slate-200';

  return (
    <div className="flex items-center justify-between gap-3 border-t border-slate-800 py-2">
      <span className="min-w-0 truncate text-slate-400">{label}</span>
      <span className={`shrink-0 font-mono ${strong || danger ? 'font-semibold' : ''} ${valueClass}`}>{formatMoney(value)}</span>
    </div>
  );
}

function formatDateLabel(value?: string) {
  if (!value) return '23';
  const [year, month, day] = value.split('-');
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}
