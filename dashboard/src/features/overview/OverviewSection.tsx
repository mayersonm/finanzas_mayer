import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Badge, Card, ProgressBar, Text, Title, type Color } from '@tremor/react';
import { apiRequest } from '../../app/apiClient';
import { EmptyState } from '../../components/common/EmptyState';
import { Collapsible, SummaryBar } from '../../components/common/SummaryBar';
import { DatabaseIcon, SaveIcon } from '../../components/common/AppIcons';
import { percent } from '../../lib/finance';
import { formatMoney, formatUpdatedAt } from '../../lib/formatters';
import type { AutomationCenter, ClosureSummary, DashboardData, MonthTotal, RealExpenses } from '../../types/dashboard';

export function OverviewSection({
  data,
  realExpenses,
  authToken,
  chatId,
  onChanged,
  onSyncSheets,
  syncing,
}: {
  data: DashboardData;
  realExpenses: RealExpenses;
  authToken?: string | null;
  chatId?: string;
  onChanged?: () => void;
  onSyncSheets?: () => void;
  syncing?: boolean;
}) {
  const [closing, setClosing] = useState(false);
  const [closeMessage, setCloseMessage] = useState('');
  const [closeError, setCloseError] = useState('');
  const [showAdjust, setShowAdjust] = useState(false);
  const [realBalance, setRealBalance] = useState('');
  const [adjusting, setAdjusting] = useState(false);
  const [adjustError, setAdjustError] = useState('');
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
  const hasIncomeLead = Number(closure.incomeLeadDays || 0) > 0 && closure.incomeStart && closure.incomeStart !== closure.start;
  const incomePeriodLabel = closure.incomeStart && closure.incomeStart !== closure.start
    ? `${formatShortDateLabel(closure.incomeStart)} - ${formatShortDateLabel(closure.incomeEnd || closure.end)}`
    : periodLabel;
  const incomeMetricLabel = hasIncomeLead ? 'Ingreso disponible' : 'Ingresos ciclo';
  const incomeMetricDetail = hasIncomeLead ? `${incomePeriodLabel} · ajuste de ingreso` : incomePeriodLabel;
  const expensePeriodLabel = closure.start && closure.end
    ? `${formatShortDateLabel(closure.start)} - ${formatShortDateLabel(closure.end)}`
    : periodLabel;
  const committedRemaining = closure.pendienteComprometido ?? fixedPending + budgetRemaining + debtPending;
  const projectedFree = closure.queQueda;
  const commitmentRate = percent(committedRemaining, cashBalance);
  const closureBudgetPct = percent(closure.presupuestoUsado, closure.presupuestoLimite);
  const budgetStatusDetail = closure.presupuestoExcedido && closure.presupuestoExcedido > 0
    ? `Disponible en otras categorias; excedido ${formatMoney(closure.presupuestoExcedido)}`
    : `${closureBudgetPct}% del limite usado`;
  const automation = data.automatizacion;
  const closureClosed = Boolean(closure.closed || closure.status === 'closed' || closure.saved);
  const closureSuggestedSavings = Number(closure.suggestedSavings ?? data.cierreAutomatico?.suggestedSavings ?? data.dineroLibre?.recommendedSavings ?? 0);
  const closureNextBudget = closure.nextBudget || [];
  const closureNextCycleRange = closure.nextCycle?.range || '';

  async function saveClosure() {
    if (!authToken) return;

    setClosing(true);
    setCloseMessage('');
    setCloseError('');
    try {
      const result = await apiRequest<{ closure?: ClosureSummary }>('closures', {
        method: 'POST',
        token: authToken,
        query: { chat_id: chatId },
        body: data.cierreAutomatico?.active && !data.cierreAutomatico.saved
          ? { cycle_start: data.cierreAutomatico.targetCycleStart }
          : {},
      });

      const savedClosure = result.closure;
      const savingsText = savedClosure?.suggestedSavings && savedClosure.suggestedSavings > 0
        ? ` Ahorro sugerido: ${formatMoney(savedClosure.suggestedSavings)}.`
        : '';
      setCloseMessage(`Ciclo cerrado: ${savedClosure?.label || closure.label}.${savingsText}`);
      onChanged?.();
    } catch (error) {
      setCloseError(error instanceof Error ? error.message : 'No se pudo guardar el cierre');
    } finally {
      setClosing(false);
    }
  }

  async function adjustCash() {
    if (!authToken) return;
    const real = Number(realBalance);
    if (realBalance.trim() === '' || !Number.isFinite(real)) {
      setAdjustError('Ingresa tu saldo real del banco.');
      return;
    }
    setAdjusting(true);
    setAdjustError('');
    try {
      await apiRequest('cash/adjust', {
        method: 'POST',
        token: authToken,
        query: { chat_id: chatId },
        body: { currentBalance: cashBalance, realBalance: real },
      });
      setShowAdjust(false);
      setRealBalance('');
      onChanged?.();
    } catch (err) {
      setAdjustError(err instanceof Error ? err.message : 'No se pudo ajustar la caja.');
    } finally {
      setAdjusting(false);
    }
  }

  const adjustDiff = realBalance.trim() !== '' && Number.isFinite(Number(realBalance))
    ? Math.round((cashBalance - Number(realBalance)) * 100) / 100
    : null;

  return (
    <>
      <SummaryBar
        className="mb-4"
        stats={[
          { label: 'Caja registrada', value: formatMoney(cashBalance), tone: cashBalance >= 0 ? 'good' : 'bad', detail: data.cycleLabel || data.mes },
          { label: 'Libre proyectado', value: formatMoney(projectedFree), tone: projectedFree >= 0 ? 'good' : 'bad', detail: 'tras compromisos' },
          { label: 'Patrimonio', value: formatMoney(patrimonioDisponible), tone: patrimonioDisponible >= 0 ? 'good' : 'bad', detail: 'caja - deudas y fijos' },
          { label: 'Comprometido', value: `${commitmentRate}%`, tone: commitmentRate >= 100 ? 'bad' : commitmentRate >= 80 ? 'warn' : 'good', detail: `Cierre ${formatDateLabel(closure.closeDate)}` },
        ]}
      />

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
        <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-4 sm:!p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge color={cashBalance >= 0 ? 'emerald' : 'rose'}>{cashBalance >= 0 ? 'Caja positiva' : 'Caja negativa'}</Badge>
                <Badge color="slate">{data.cycleLabel || data.mes}</Badge>
              </div>
              <Title>Vista principal</Title>
              <Text>{periodLabel}</Text>
            </div>
            <Badge color="cyan">Cierre {formatDateLabel(closure.closeDate)}</Badge>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_17rem]">
            <div className="min-w-0">
              <Text>Caja registrada</Text>
              <p className={`mt-2 truncate font-mono text-4xl font-semibold sm:text-5xl ${cashBalance >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                {formatMoney(cashBalance)}
              </p>
              <Sparkline months={data.meses} />
              <p className="mt-3 max-w-2xl text-sm text-slate-400">
                Saldo calculado con movimientos en D1. No es lectura directa del banco.
              </p>
              <button
                type="button"
                className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-tremor-default border border-cyan-500/40 bg-cyan-500/10 px-3 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/15 disabled:opacity-60"
                onClick={() => { setShowAdjust(true); setAdjustError(''); setRealBalance(''); }}
                disabled={!authToken}
              >
                <DatabaseIcon className="h-4 w-4" aria-hidden="true" />
                Ajustar al saldo del banco
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <FocusMetric
                label="Libre proyectado"
                value={formatMoney(projectedFree)}
                detail="Caja menos compromisos y presupuesto"
                tone={projectedFree >= 0 ? 'text-emerald-300' : 'text-rose-300'}
              />
              <FocusMetric
                label="Patrimonio"
                value={formatMoney(patrimonioDisponible)}
                detail="Caja menos deudas y fijos"
                tone={patrimonioDisponible >= 0 ? 'text-emerald-300' : 'text-rose-300'}
              />
            </div>
          </div>
        </Card>

        <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-4 sm:!p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Title>Estado del ciclo</Title>
              <Text>Caja, compromisos y salidas actuales.</Text>
            </div>
            <Badge color={commitmentRate >= 100 ? 'rose' : commitmentRate >= 80 ? 'amber' : 'emerald'}>{commitmentRate}% de caja</Badge>
          </div>

          <div className="mt-4 grid gap-3">
            <StatusRow
              label="Compromisos pendientes"
              value={formatMoney(committedRemaining)}
              detail="Deudas + fijos + presupuesto por usar"
              tone={commitmentRate >= 100 ? 'text-rose-300' : commitmentRate >= 80 ? 'text-amber-300' : 'text-emerald-300'}
            />
            <StatusRow
              label="Salidas del ciclo"
              value={formatMoney(data.gastosMes)}
              detail={`Gastos + fijos pagados (${expensePeriodLabel})`}
              tone={data.gastosMes > cashBalance ? 'text-amber-300' : 'text-sky-300'}
            />
            <StatusRow
              label="Presupuesto disponible"
              value={formatMoney(closure.presupuestoRestante)}
              detail={budgetStatusDetail}
              tone={closure.presupuestoRestante < 0 ? 'text-rose-300' : closureBudgetPct >= 85 ? 'text-amber-300' : 'text-emerald-300'}
            />
          </div>

          <ProgressBar
            className="mt-5"
            value={Math.min(commitmentRate, 100)}
            color={commitmentRate >= 100 ? 'rose' : commitmentRate >= 80 ? 'amber' : 'emerald'}
          />
        </Card>
      </section>

      {automation ? (
        <AutomationPanel automation={automation} onSyncSheets={onSyncSheets} syncing={Boolean(syncing)} />
      ) : null}

      <section className="mt-4 grid gap-3 sm:mt-5 sm:gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)]">
        <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-4 sm:!p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <Title>Cierre financiero</Title>
              <Text>{closure.label || 'Cierre 22'} · {periodLabel}</Text>
              {closure.savedAt ? <Text>Guardado {formatSavedAt(closure.savedAt)}</Text> : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge color={closure.queQueda >= 0 ? 'emerald' : 'rose'}>
                {closure.movimientos ?? data.movimientosMes ?? 0} movimientos
              </Badge>
              {closureClosed ? <Badge color="emerald">Ciclo cerrado</Badge> : null}
              <button
                type="button"
                className="inline-flex h-10 w-full min-w-[9.5rem] items-center justify-center gap-2 rounded-tremor-default border border-emerald-500/40 bg-emerald-500/10 px-3 text-sm font-semibold text-emerald-100 shadow-sm transition hover:border-emerald-400/60 hover:bg-emerald-500/15 focus:outline-none focus:ring-2 focus:ring-emerald-400/30 disabled:cursor-wait disabled:border-slate-700 disabled:bg-slate-900/70 disabled:text-slate-500 disabled:opacity-55 min-[420px]:w-auto"
                disabled={!authToken || closing}
                onClick={() => void saveClosure()}
              >
                <SaveIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{closing ? 'Cerrando' : closureClosed ? 'Actualizar cierre' : 'Cerrar ciclo'}</span>
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

          {closureClosed ? (
            <div className="mt-4 rounded-tremor-default border border-emerald-500/25 bg-emerald-500/10 p-3 text-sm text-emerald-100">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-semibold">Cierre real guardado en D1</p>
                  <p className="mt-1 text-emerald-100/85">
                    {closure.closedAt ? `Cerrado ${formatSavedAt(closure.closedAt)}.` : 'El ciclo ya tiene snapshot cerrado.'}
                    {closureNextCycleRange ? ` Siguiente ciclo: ${closureNextCycleRange}.` : ''}
                  </p>
                </div>
                <Badge color={closureSuggestedSavings > 0 ? 'amber' : 'emerald'}>
                  {closureSuggestedSavings > 0 ? `Ahorro ${formatMoney(closureSuggestedSavings)}` : 'Sin ahorro pendiente'}
                </Badge>
              </div>

              {closureNextBudget.length ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  {closureNextBudget.slice(0, 3).map((item) => (
                    <div key={item.category} className="min-w-0 rounded-tremor-default border border-emerald-500/20 bg-slate-900/30 px-3 py-2">
                      <p className="truncate text-xs font-semibold text-emerald-100">{item.category}</p>
                      <p className="mt-1 font-mono text-sm text-slate-100">{formatMoney(item.suggestedLimit)}</p>
                      <p className="mt-1 truncate text-xs text-emerald-100/70">Sugerido siguiente ciclo</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {data.cierreAutomatico?.active && !data.cierreAutomatico.saved ? (
            <div className="mt-4 rounded-tremor-default border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
              <p className="font-semibold">{data.cierreAutomatico.title}</p>
              <p className="mt-1">{data.cierreAutomatico.message}</p>
              <p className="mt-1 text-xs text-slate-400">
                Ahorro sugerido: {formatMoney(data.cierreAutomatico.suggestedSavings)} - ciclo {data.cierreAutomatico.targetCycleRange}
              </p>
            </div>
          ) : null}

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <ClosureMetric label={incomeMetricLabel} value={formatMoney(closure.ingresos)} tone="text-emerald-300" detail={incomeMetricDetail} />
            <ClosureMetric label="Gastos ciclo" value={formatMoney(closure.gastos)} tone="text-rose-300" detail={expensePeriodLabel} />
            <ClosureMetric label="Resultado ciclo" value={formatMoney(closure.balance)} tone={closure.balance >= 0 ? 'text-emerald-300' : 'text-rose-300'} detail="Entradas menos salidas del ciclo" />
          </div>

          <Collapsible className="mt-4" summary="Ver desglose del cierre">
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <ClosureLine label="Caja registrada" value={cashBalance} strong />
              <ClosureLine label="Fijos pendientes" value={closure.fijosPendientes} />
              <ClosureLine label="Presupuesto pendiente" value={closure.presupuestoRestante} strong />
              <ClosureLine label="Deudas pendientes" value={closure.deudasPendientes} />
              <ClosureLine label="Total pendiente" value={closure.pendienteComprometido} strong />
            </div>
          </Collapsible>
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
          <Collapsible className="mt-4" summary="Ver desglose del presupuesto">
            <div className="space-y-2 text-sm">
              <ClosureLine label="Limite" value={closure.presupuestoLimite} />
              <ClosureLine label="Usado" value={closure.presupuestoUsado} />
              <ClosureLine label="Pendiente" value={closure.presupuestoRestante} strong />
              {closure.presupuestoExcedido && closure.presupuestoExcedido > 0 ? (
                <ClosureLine label="Excedido" value={closure.presupuestoExcedido} danger />
              ) : null}
            </div>
          </Collapsible>
        </Card>
      </section>

      <section className="mt-4 sm:mt-5">
        <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-4 sm:!p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <Title>Top fugas</Title>
              <Text>Solo los gastos variables que conviene mirar hoy.</Text>
            </div>
            <Badge color={topFugas.length ? 'amber' : 'emerald'}>{topFugas.length ? `${Math.min(topFugas.length, 3)} alertas` : 'Sin fugas'}</Badge>
          </div>

          {topFugas.length ? (
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {topFugas.slice(0, 3).map((item, index) => (
                <div key={`${item.label}-${item.category}`} className="min-w-0 rounded-tremor-default border border-slate-800 bg-slate-900/30 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-200">#{index + 1}</span>
                      <p className="mt-2 truncate text-sm font-semibold text-slate-100">{item.label}</p>
                      <Text className="truncate">{item.category}</Text>
                    </div>
                    <span className="shrink-0 font-mono text-sm font-semibold text-slate-100">{formatMoney(item.amount)}</span>
                  </div>
                  <ProgressBar className="mt-3" value={item.sharePct} color={item.sharePct >= 35 ? 'rose' : item.sharePct >= 20 ? 'amber' : 'cyan'} />
                  <p className="mt-2 line-clamp-2 text-xs text-slate-400">{item.reason}</p>
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

      {showAdjust ? createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-tremor-default border border-slate-700 bg-slate-950 p-5 shadow-2xl shadow-black/40">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">Ajustar caja</h2>
                <p className="mt-1 text-sm text-slate-400">Pon el saldo real de tu banco y cuadramos la caja con un movimiento de ajuste.</p>
              </div>
              <button type="button" className="grid h-9 w-9 shrink-0 place-items-center rounded-tremor-default border border-slate-700 text-lg text-slate-300 transition hover:bg-slate-900" onClick={() => setShowAdjust(false)} aria-label="Cerrar">×</button>
            </div>
            <div className="mt-4 grid gap-3">
              <div className="flex items-center justify-between gap-3 rounded-tremor-default border border-slate-800 bg-slate-900/40 px-3 py-2 text-sm">
                <span className="text-slate-400">Caja del dashboard hoy</span>
                <span className="font-mono font-semibold text-slate-100">{formatMoney(cashBalance)}</span>
              </div>
              <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Saldo real del banco
                <input className="form-input" type="number" step="0.01" value={realBalance} onChange={(event) => setRealBalance(event.target.value)} placeholder="Ej: 362.68" autoFocus />
              </label>
              {adjustDiff !== null && Math.abs(adjustDiff) >= 0.01 ? (
                <div className="rounded-tremor-default border border-cyan-500/25 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100">
                  Se creara un {adjustDiff > 0 ? 'gasto' : 'ingreso'} de ajuste de {formatMoney(Math.abs(adjustDiff))} para dejar la caja en {formatMoney(Number(realBalance))}.
                </div>
              ) : null}
              {adjustError ? <div className="rounded-tremor-default border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{adjustError}</div> : null}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="rounded-tremor-default border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200" onClick={() => setShowAdjust(false)}>Cancelar</button>
              <button type="button" className="rounded-tremor-default bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-60" disabled={adjusting} onClick={() => void adjustCash()}>{adjusting ? 'Ajustando...' : 'Ajustar caja'}</button>
            </div>
          </div>
        </div>,
        document.body
      ) : null}
    </>
  );
}

function Sparkline({ months }: { months: MonthTotal[] }) {
  const data = (months || []).filter(Boolean).slice(-6);
  if (data.length < 2) return null;
  const max = Math.max(...data.map((m) => Math.max(Number(m.ingresos || 0), Number(m.gastos || 0))), 1);

  return (
    <div className="mt-4 flex items-end gap-1.5" aria-hidden="true">
      {data.map((m, index) => {
        const height = Math.max(8, Math.round((Number(m.gastos || 0) / max) * 100));
        const isLast = index === data.length - 1;
        return (
          <div
            key={m.key || `${m.mes}-${index}`}
            className={`w-2 rounded-sm ${isLast ? 'bg-emerald-400' : 'bg-emerald-500/45'}`}
            style={{ height: `${(height / 100) * 44}px` }}
            title={`${m.mes}: ${formatMoney(m.gastos)}`}
          />
        );
      })}
      <span className="ml-2 self-center text-xs text-slate-500">gasto · {data.length} meses</span>
    </div>
  );
}

function FocusMetric({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: string }) {
  return (
    <div className="min-w-0 rounded-tremor-default border border-slate-800 bg-slate-900/30 px-3 py-3">
      <Text>{label}</Text>
      <p className={`mt-1 truncate font-mono text-xl font-semibold ${tone}`}>{value}</p>
      <p className="mt-1 truncate text-xs text-slate-500">{detail}</p>
    </div>
  );
}

function StatusRow({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-t border-slate-800 pt-3 first:border-t-0 first:pt-0">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-100">{label}</p>
        <p className="mt-1 truncate text-xs text-slate-500">{detail}</p>
      </div>
      <p className={`shrink-0 font-mono text-sm font-semibold ${tone}`}>{value}</p>
    </div>
  );
}

function AutomationPanel({
  automation,
  onSyncSheets,
  syncing,
}: {
  automation: AutomationCenter;
  onSyncSheets?: () => void;
  syncing: boolean;
}) {
  const primaryActions = automation.actions.slice(0, 2);

  return (
    <section className="mt-4 sm:mt-5">
      <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-4 sm:!p-6">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Title>Prioridad de hoy</Title>
              <Badge color={automationColor(automation.status)}>{automation.statusLabel}</Badge>
              <Badge color={automation.score >= 80 ? 'emerald' : automation.score >= 60 ? 'amber' : 'rose'}>{automation.score}/100</Badge>
            </div>
            <Text className="mt-1">{automation.message}</Text>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <FocusMetric
                label="Gasto diario"
                value={formatMoney(automation.daily.normal)}
                detail={`${automation.daily.daysLeft} dias restantes`}
                tone="text-cyan-300"
              />
              <FocusMetric
                label="Respaldo Sheets"
                value={automation.sync.statusLabel}
                detail={automation.sync.lastAt ? formatUpdatedAt(automation.sync.lastAt) : 'Sin registro'}
                tone={automation.sync.status === 'error' ? 'text-rose-300' : automation.sync.status === 'stale' ? 'text-slate-300' : 'text-emerald-300'}
              />
            </div>
          </div>

          <div className="min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Title>Acciones clave</Title>
                <Text>Maximo dos para no llenar la pantalla.</Text>
              </div>
              {automation.budgets.risky ? <Badge color="amber">{automation.budgets.risky} riesgos</Badge> : <Badge color="emerald">OK</Badge>}
            </div>

            {primaryActions.length ? (
              <div className="mt-4 grid gap-2">
                {primaryActions.map((action) => (
                  <div key={action.id} className="grid gap-3 rounded-tremor-default border border-slate-800 bg-slate-900/30 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="min-w-0 truncate text-sm font-semibold text-slate-100">{action.title}</p>
                        <Badge color={priorityColor(action.priority)}>{priorityLabel(action.priority)}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-slate-400">{action.message}</p>
                    </div>
                    {action.type === 'sync' && onSyncSheets ? (
                      <button
                        type="button"
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-tremor-default border border-cyan-500/40 bg-cyan-500/10 px-3 text-sm font-semibold text-cyan-100 transition hover:border-cyan-400/60 hover:bg-cyan-500/15 disabled:cursor-wait disabled:border-slate-700 disabled:bg-slate-900/70 disabled:text-slate-500 disabled:opacity-60"
                        disabled={syncing}
                        onClick={onSyncSheets}
                      >
                        <DatabaseIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                        {syncing ? 'Sincronizando' : action.cta}
                      </button>
                    ) : (
                      <span className="inline-flex h-9 items-center justify-center rounded-tremor-default border border-slate-800 px-3 text-sm font-semibold text-slate-300">
                        {action.cta}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4">
                <EmptyState>Sin acciones urgentes.</EmptyState>
              </div>
            )}
          </div>
        </div>
      </Card>
    </section>
  );
}

function automationColor(status: string): Color {
  if (status === 'ok') return 'emerald';
  if (status === 'watch') return 'amber';
  return 'rose';
}

function priorityColor(priority: string): Color {
  if (priority === 'high') return 'rose';
  if (priority === 'medium') return 'amber';
  return 'slate';
}

function priorityLabel(priority: string): string {
  if (priority === 'high') return 'Alta';
  if (priority === 'medium') return 'Media';
  return 'Baja';
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
    label: 'Cierre 22',
    range: data.cycleRange || [data.cycleStart, data.cycleEnd].filter(Boolean).join(' - '),
    start: data.cycleStart,
    end: data.cycleEnd,
    incomeStart: data.cycleIncomeStart,
    incomeEnd: data.cycleIncomeEnd,
    incomeLeadDays: data.cycleIncomeLeadDays,
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

function ClosureMetric({ label, value, tone, detail }: { label: string; value: string; tone: string; detail?: string }) {
  return (
    <div className="min-w-0 border-l border-slate-700 pl-3">
      <Text>{label}</Text>
      <p className={`mt-1 truncate font-mono text-lg font-semibold sm:text-xl ${tone}`}>{value}</p>
      {detail ? <p className="mt-1 truncate text-xs text-slate-400">{detail}</p> : null}
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
  if (!value) return '22';
  const [year, month, day] = value.split('-');
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

function formatShortDateLabel(value?: string) {
  if (!value) return '';
  const [, month, day] = value.split('-');
  if (!month || !day) return value;
  return `${day}/${month}`;
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
