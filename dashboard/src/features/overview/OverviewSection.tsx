import { useState } from 'react';
import { RiSave3Line } from '@remixicon/react';
import { Badge, BarChart, Card, DonutChart, Metric, ProgressBar, Text, Title } from '@tremor/react';
import { apiEndpoint } from '../../app/api';
import { KpiCard } from '../../components/dashboard/KpiCard';
import { EmptyState } from '../../components/common/EmptyState';
import { percent } from '../../lib/finance';
import { formatMoney } from '../../lib/formatters';
import { categoryColors } from '../../lib/tremorColors';
import type { ClosureSummary, DashboardData, RealExpenses } from '../../types/dashboard';

export function OverviewSection({
  data,
  realExpenses,
  authToken,
  chatId,
  onChanged,
}: {
  data: DashboardData;
  realExpenses: RealExpenses;
  authToken?: string | null;
  chatId?: string;
  onChanged?: () => void;
}) {
  const [closing, setClosing] = useState(false);
  const [closeMessage, setCloseMessage] = useState('');
  const [closeError, setCloseError] = useState('');
  const totalCategorias = data.categorias.reduce((total, item) => total + item.monto, 0);
  const topCategory = data.categorias[0];
  const topFugas = data.topFugas || [];
  const monthIncome = data.ingresosMes ?? data.ingresos;
  const monthBalance = data.balanceMes ?? monthIncome - data.gastosMes;
  const cashBalance = data.balance ?? 0;
  const debtPending = data.deudaPendiente ?? 0;
  const patrimonioDisponible = data.patrimonioDisponible ?? data.patrimonio ?? data.balanceGeneralNeto ?? data.balanceNeto ?? cashBalance - debtPending;
  const fixedPending = data.fijosPendientes ?? realExpenses.totalFijos ?? 0;
  const budgetRemaining = data.presupuestos.reduce((total, item) => {
    return total + Math.max(Number(item.limite || 0) - Number(item.gasto || 0), 0);
  }, 0);
  const closure = getClosureSummary(data, {
    patrimonioDisponible,
    debtPending,
    fixedPending,
    budgetRemaining,
    monthIncome,
    monthBalance,
  });
  const periodLabel = data.cycleRange || closure.range || data.mes;
  const committedRemaining = closure.pendienteComprometido ?? fixedPending + budgetRemaining + debtPending;
  const projectedFree = closure.queQueda;
  const commitmentRate = percent(committedRemaining, Math.max(cashBalance, monthIncome));
  const closureBudgetPct = percent(closure.presupuestoUsado, closure.presupuestoLimite);

  async function saveClosure() {
    if (!authToken) return;

    setClosing(true);
    setCloseMessage('');
    setCloseError('');
    try {
      const url = new URL(apiEndpoint('closures'));
      if (chatId) url.searchParams.set('chat_id', chatId);

      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      const result = await response.json() as { ok?: boolean; error?: string; closure?: ClosureSummary };

      if (!response.ok || result.ok === false) {
        throw new Error(result.error || 'No se pudo guardar el cierre');
      }

      setCloseMessage(`Cierre guardado: ${result.closure?.label || closure.label}`);
      onChanged?.();
    } catch (error) {
      setCloseError(error instanceof Error ? error.message : 'No se pudo guardar el cierre');
    } finally {
      setClosing(false);
    }
  }

  return (
    <>
      <section className="grid gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          label="Caja actual"
          value={formatMoney(cashBalance)}
          detail="Saldo total registrado"
          color={cashBalance >= 0 ? 'emerald' : 'rose'}
        />
        <KpiCard
          label="Patrimonio disponible"
          value={formatMoney(patrimonioDisponible)}
          detail="Caja menos deudas y fijos"
          color={patrimonioDisponible >= 0 ? 'emerald' : 'rose'}
        />
        <KpiCard
          label="Libre proyectado"
          value={formatMoney(projectedFree)}
          detail="Patrimonio menos presupuesto"
          color={projectedFree >= 0 ? 'emerald' : 'rose'}
        />
        <KpiCard
          label="Pendiente comprometido"
          value={formatMoney(committedRemaining)}
          detail={`${commitmentRate}% de caja actual`}
          color={commitmentRate >= 100 ? 'rose' : commitmentRate >= 80 ? 'amber' : 'violet'}
        />
        <KpiCard
          label="Gastos del ciclo"
          value={formatMoney(data.gastosMes)}
          detail={`${periodLabel} - ${data.movimientosMes ?? data.movimientos} movimientos`}
          color={data.gastosMes > cashBalance ? 'amber' : 'sky'}
        />
      </section>

      <section className="mt-4 grid gap-3 sm:mt-5 sm:gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(300px,0.75fr)]">
        <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-4 sm:!p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <Title>{closure.label || 'Cierre 23'}</Title>
              <Text>{periodLabel} - cierre {formatDateLabel(closure.closeDate)}</Text>
              {closure.savedAt ? <Text>Guardado {formatSavedAt(closure.savedAt)}</Text> : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge color={closure.queQueda >= 0 ? 'emerald' : 'rose'}>
                {closure.movimientos ?? data.movimientosMes ?? 0} movimientos
              </Badge>
              <button
                type="button"
                className="inline-flex h-10 w-full min-w-[9.5rem] items-center justify-center gap-2 rounded-tremor-default border border-emerald-500/40 bg-emerald-500/10 px-3 text-sm font-semibold text-emerald-100 shadow-sm transition hover:border-emerald-400/60 hover:bg-emerald-500/15 focus:outline-none focus:ring-2 focus:ring-emerald-400/30 disabled:cursor-wait disabled:border-slate-700 disabled:bg-slate-900/70 disabled:text-slate-500 disabled:opacity-55 min-[420px]:w-auto"
                disabled={!authToken || closing}
                onClick={() => void saveClosure()}
              >
                <RiSave3Line className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{closing ? 'Guardando' : closure.saved ? 'Actualizar cierre' : 'Cerrar mes'}</span>
              </button>
            </div>
          </div>

          {closeMessage ? (
            <div className="mt-4 rounded-tremor-default border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-100">
              {closeMessage}
            </div>
          ) : null}

          {closeError ? (
            <div className="mt-4 rounded-tremor-default border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm font-medium text-rose-100">
              {closeError}
            </div>
          ) : null}

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <ClosureMetric label="Caja actual" value={formatMoney(cashBalance)} tone={cashBalance >= 0 ? 'text-emerald-300' : 'text-rose-300'} />
            <ClosureMetric label="Entro ciclo" value={formatMoney(closure.ingresos)} tone="text-emerald-300" />
            <ClosureMetric label="Salio ciclo" value={formatMoney(closure.gastos)} tone="text-rose-300" />
            <ClosureMetric label="Balance ciclo" value={formatMoney(closure.balance)} tone={closure.balance >= 0 ? 'text-emerald-300' : 'text-rose-300'} />
            <ClosureMetric label="Libre actual" value={formatMoney(closure.queQueda)} tone={closure.queQueda >= 0 ? 'text-emerald-300' : 'text-rose-300'} />
          </div>

          <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            <ClosureLine label="Fijos pagados" value={closure.fijosPagados} />
            <ClosureLine label="Fijos pendientes" value={closure.fijosPendientes} />
            <ClosureLine label="Presupuesto usado" value={closure.presupuestoUsado} />
            <ClosureLine label="Presupuesto pendiente" value={closure.presupuestoRestante} strong />
            <ClosureLine label="Deudas pendientes" value={closure.deudasPendientes} />
            <ClosureLine label="Total pendiente" value={closure.pendienteComprometido} strong />
          </div>
        </Card>

        <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-4 sm:!p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Title>Presupuesto pendiente</Title>
              <Text>{closureBudgetPct}% usado del limite</Text>
            </div>
            <Badge color={closure.presupuestoExcedido && closure.presupuestoExcedido > 0 ? 'rose' : closureBudgetPct >= 80 ? 'amber' : 'emerald'}>
              {formatMoney(closure.presupuestoRestante)}
            </Badge>
          </div>
          <ProgressBar className="mt-5" value={closureBudgetPct} color={closureBudgetPct >= 100 ? 'rose' : closureBudgetPct >= 80 ? 'amber' : 'emerald'} />
          <div className="mt-4 space-y-2 text-sm">
            <ClosureLine label="Limite" value={closure.presupuestoLimite} />
            <ClosureLine label="Usado" value={closure.presupuestoUsado} />
            <ClosureLine label="Pendiente" value={closure.presupuestoRestante} strong />
            {closure.presupuestoExcedido && closure.presupuestoExcedido > 0 ? (
              <ClosureLine label="Excedido" value={closure.presupuestoExcedido} danger />
            ) : null}
          </div>
        </Card>
      </section>

      <section className="mt-4 sm:mt-5">
        <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-4 sm:!p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <Title>Top fugas</Title>
              <Text>Los 5 gastos variables que mas pesan este ciclo.</Text>
            </div>
            <Badge color={topFugas.length ? 'amber' : 'emerald'}>{topFugas.length ? `${topFugas.length} alertas` : 'Sin fugas'}</Badge>
          </div>

          {topFugas.length ? (
            <div className="mt-4 grid gap-3 lg:grid-cols-5">
              {topFugas.map((item, index) => (
                <div key={`${item.label}-${item.category}`} className="min-w-0 border-t border-slate-800 pt-3 lg:border-l lg:border-t-0 lg:pl-3 lg:pt-0">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-200">#{index + 1}</span>
                    <span className="shrink-0 font-mono text-sm font-semibold text-slate-100">{formatMoney(item.amount)}</span>
                  </div>
                  <p className="truncate text-sm font-semibold text-slate-100">{item.label}</p>
                  <Text className="mt-1 truncate">{item.category}</Text>
                  <ProgressBar className="mt-3" value={item.sharePct} color={item.sharePct >= 35 ? 'rose' : item.sharePct >= 20 ? 'amber' : 'cyan'} />
                  <p className="mt-2 text-xs text-slate-400">{item.reason}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-5">
              <EmptyState>Sin fugas fuertes este ciclo.</EmptyState>
            </div>
          )}
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
              <Text>{topCategory ? `Principal: ${topCategory.cat}` : 'Sin gastos este ciclo'}</Text>
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
              <EmptyState>Sin gastos este ciclo.</EmptyState>
            </div>
          )}
        </Card>
      </section>

      <section className="mt-4 grid gap-3 sm:mt-5 sm:gap-4 md:grid-cols-3">
        <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-4 sm:!p-6">
          <Text>Ingresos del ciclo</Text>
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
    queQueda: fallback.patrimonioDisponible - fallback.budgetRemaining,
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

function formatSavedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
