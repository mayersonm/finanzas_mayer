import { useMemo, useState } from 'react';
import { RiArrowRightLine, RiBankLine, RiShieldCheckLine, RiShoppingBag3Line, RiSparklingLine } from '@remixicon/react';
import { Badge, Card, ProgressBar, Text, Title } from '@tremor/react';
import { formatDate, formatMoney } from '../../lib/formatters';
import type { DashboardData, FreeMoneyPlan } from '../../types/dashboard';

export function FreeMoneySection({ data }: { data: DashboardData }) {
  const plan = data.dineroLibre || fallbackFreeMoney(data);
  const actualSavings = plan.actualSavings ?? plan.savingsTarget;
  const [purchaseAmount, setPurchaseAmount] = useState('');
  const [purchaseName, setPurchaseName] = useState('');
  const purchase = useMemo(() => purchaseVerdict(plan, Number(purchaseAmount || 0), purchaseName), [plan, purchaseAmount, purchaseName]);
  const tone = toneFor(plan.status);
  const progressValue = plan.budgetLimit > 0 ? Math.min(Math.round((plan.availableToSpend / plan.budgetLimit) * 100), 100) : 100;

  return (
    <div className="grid gap-4">
      <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-4 sm:!p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge color={tone.badge}>{plan.statusLabel}</Badge>
              <Badge color="cyan">{plan.closeLabel}</Badge>
              <Badge color="slate">{plan.daysLeft} dias</Badge>
            </div>
            <Title>Dinero Libre</Title>
            <Text>{formatDate(plan.closeDate)} · ahorro real {formatMoney(actualSavings)} · sugerido {formatMoney(plan.recommendedSavings)}</Text>
          </div>
          <div className={`rounded-tremor-default border px-4 py-3 ${tone.panel}`}>
            <p className="text-xs font-semibold uppercase text-slate-400">Puedes gastar hoy</p>
            <p className={`mt-1 text-3xl font-bold ${tone.text}`}>{formatMoney(plan.daily.normal)}</p>
            <p className="mt-1 text-sm text-slate-400">Flexible hasta {formatMoney(plan.daily.flexible)}</p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Metric icon={RiShieldCheckLine} label="Modo seguro" value={formatMoney(plan.daily.safe)} sub="para cerrar mejor" tone="emerald" />
          <Metric icon={RiShoppingBag3Line} label="Libre del ciclo" value={formatMoney(plan.availableToSpend)} sub={`${plan.daysLeft} dias restantes`} tone="cyan" />
          <Metric icon={RiSparklingLine} label="Puedes ahorrar" value={formatMoney(plan.recommendedSavings)} sub="sugerencia del ciclo" tone="emerald" />
          <Metric icon={RiBankLine} label="Listo para invertir" value={formatMoney(plan.investment.amount)} sub={plan.investment.profile} tone="amber" />
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="rounded-tremor-default border border-slate-800 bg-slate-900/40 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-100">Reserva variable</p>
                <p className="text-sm text-slate-400">{formatMoney(plan.availableToSpend)} disponible de {formatMoney(plan.budgetLimit || plan.availableToSpend)}</p>
              </div>
              <p className="text-sm font-semibold text-cyan-200">{progressValue}%</p>
            </div>
            <ProgressBar className="mt-3" value={progressValue} color={tone.progress} />
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              <Mini label="Balance base" value={formatMoney(plan.baseBalance)} />
              <Mini label="Ahorro real" value={formatMoney(actualSavings)} />
              <Mini label="Sugerencia" value={formatMoney(plan.recommendedSavings)} />
              <Mini label="Fijos y deudas" value={formatMoney(plan.fixedPending + plan.debtPending)} />
              <Mini label="Colchon" value={formatMoney(plan.emergencyBuffer)} />
            </div>
          </div>

          <div className="rounded-tremor-default border border-slate-800 bg-slate-900/40 p-4">
            <p className="text-sm font-semibold text-slate-100">Probar compra</p>
            <div className="mt-3 grid gap-2">
              <input className="form-input" type="number" min="0" step="0.01" placeholder="Monto" value={purchaseAmount} onChange={(event) => setPurchaseAmount(event.target.value)} />
              <input className="form-input" placeholder="Descripcion" value={purchaseName} onChange={(event) => setPurchaseName(event.target.value)} />
            </div>
            <div className={`mt-3 rounded-tremor-default border px-3 py-2 ${purchase.panel}`}>
              <p className={`text-sm font-semibold ${purchase.text}`}>{purchase.title}</p>
              <p className="mt-1 text-xs text-slate-400">{purchase.message}</p>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-4 sm:!p-6">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-tremor-default bg-amber-500/15 text-amber-200">
              <RiSparklingLine className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <Title>{plan.investment.title}</Title>
              <Text>{plan.investment.message}</Text>
            </div>
          </div>

          <div className="mt-5 grid gap-3">
            {plan.investment.allocation.map((item) => (
              <div key={item.label}>
                <div className="mb-1 flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-slate-200">{item.label}</p>
                  <p className="text-sm font-semibold text-slate-300">{item.pct}%</p>
                </div>
                <ProgressBar value={item.pct} color="amber" />
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-tremor-default border border-amber-500/25 bg-amber-500/10 p-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-amber-200">
              <RiArrowRightLine className="h-4 w-4" aria-hidden="true" />
              {plan.investment.nextStep}
            </p>
            <p className="mt-2 text-xs text-slate-400">{plan.investment.riskNote}</p>
          </div>
        </Card>

        <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-4 sm:!p-6">
          <Title>Acciones</Title>
          <div className="mt-4 grid gap-3">
            {(plan.actions.length ? plan.actions : ['Mantén el gasto diario dentro del rango normal.']).map((item) => (
              <div key={item} className="rounded-tremor-default border border-slate-800 bg-slate-900/40 p-3 text-sm text-slate-300">
                {item}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value, sub, tone }: { icon: typeof RiShieldCheckLine; label: string; value: string; sub: string; tone: 'emerald' | 'cyan' | 'amber' }) {
  const colors = {
    emerald: 'bg-emerald-500/10 text-emerald-200 border-emerald-500/25',
    cyan: 'bg-cyan-500/10 text-cyan-200 border-cyan-500/25',
    amber: 'bg-amber-500/10 text-amber-200 border-amber-500/25',
  };
  return (
    <div className={`rounded-tremor-default border p-4 ${colors[tone]}`}>
      <Icon className="h-5 w-5" aria-hidden="true" />
      <p className="mt-3 text-xs font-semibold uppercase text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      <p className="mt-1 text-sm text-slate-400">{sub}</p>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-tremor-default border border-slate-800 bg-slate-950/60 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 font-semibold text-slate-100">{value}</p>
    </div>
  );
}

function toneFor(status: string) {
  if (status === 'danger') return { badge: 'rose' as const, progress: 'rose' as const, text: 'text-rose-300', panel: 'border-rose-500/30 bg-rose-500/10' };
  if (status === 'warning' || status === 'tight') return { badge: 'amber' as const, progress: 'amber' as const, text: 'text-amber-300', panel: 'border-amber-500/30 bg-amber-500/10' };
  return { badge: 'emerald' as const, progress: 'emerald' as const, text: 'text-emerald-300', panel: 'border-emerald-500/30 bg-emerald-500/10' };
}

function purchaseVerdict(plan: FreeMoneyPlan, amount: number, name: string) {
  if (!amount || amount <= 0) {
    return {
      title: 'Ingresa un monto',
      message: 'El simulador compara la compra contra tu margen diario y del ciclo.',
      panel: 'border-slate-700 bg-slate-900/40',
      text: 'text-slate-200',
    };
  }

  const label = name.trim() || 'esa compra';
  const remaining = Math.max(plan.availableToSpend - amount, 0);
  if (amount <= plan.purchaseLimits.green) {
    return {
      title: 'Compra sana',
      message: `${label} queda dentro del gasto normal de hoy. Libre restante: ${formatMoney(remaining)}.`,
      panel: 'border-emerald-500/30 bg-emerald-500/10',
      text: 'text-emerald-300',
    };
  }
  if (amount <= plan.purchaseLimits.amber) {
    return {
      title: 'Compra posible',
      message: `${label} entra en modo flexible. Compensa bajando el gasto de manana.`,
      panel: 'border-amber-500/30 bg-amber-500/10',
      text: 'text-amber-300',
    };
  }
  if (amount <= plan.purchaseLimits.hard) {
    return {
      title: 'Compra pesada',
      message: `${label} cabe en el ciclo, pero rompe el ritmo diario. Restarian ${formatMoney(remaining)}.`,
      panel: 'border-orange-500/30 bg-orange-500/10',
      text: 'text-orange-300',
    };
  }
  return {
    title: 'No conviene',
    message: `${label} supera tu dinero libre sin tocar ahorro real o compromisos.`,
    panel: 'border-rose-500/30 bg-rose-500/10',
    text: 'text-rose-300',
  };
}

function fallbackFreeMoney(data: DashboardData): FreeMoneyPlan {
  const available = Math.max((data.cierre?.queQueda ?? data.patrimonioDisponible ?? data.balanceMes ?? 0), 0);
  const daysLeft = 1;
  return {
    status: available > 0 ? 'healthy' : 'warning',
    statusLabel: available > 0 ? 'Plan sano' : 'Sin margen libre',
    closeDate: data.cycleEnd || data.mesKey || '',
    closeLabel: data.cierre?.label || 'Cierre',
    daysLeft,
    income: data.ingresosMes || 0,
    spent: data.gastosMes || 0,
    baseBalance: data.balanceMes || 0,
    commitments: 0,
    fixedPending: data.fijosPendientes || 0,
    debtPending: data.deudaPendiente || 0,
    savingsTarget: 0,
    actualSavings: 0,
    configuredSavingsGoal: 0,
    savingsConfigured: false,
    recommendedSavings: 0,
    emergencyBuffer: 0,
    budgetLimit: 0,
    budgetRemaining: available,
    variableReserve: available,
    freeAfterCommitments: available,
    availableToSpend: available,
    daily: { safe: available, normal: available, flexible: available, requiredSavings: 0 },
    purchaseLimits: { green: available, amber: available, hard: available },
    investment: {
      amount: 0,
      profile: 'conservador',
      horizon: 'corto',
      title: 'Calculando ruta',
      message: 'Cuando D1 devuelva el plan completo veras la sugerencia de inversion.',
      allocation: [{ label: 'Liquidez', pct: 100 }],
      nextStep: 'Actualiza el dashboard.',
      riskNote: 'Referencia educativa, no recomendacion personalizada.',
    },
    actions: [],
  };
}
