import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Badge, Card, Text, Title } from '@tremor/react';
import { RiAlarmWarningLine, RiBankCardLine, RiCloseLine, RiSave3Line, RiStackLine } from '@remixicon/react';
import { apiRequest } from '../../../app/apiClient';
import { EmptyState } from '../../../components/common/EmptyState';
import { Collapsible } from '../../../components/common/SummaryBar';
import { TransactionsTable } from '../../../components/dashboard/TransactionsTable';
import { convertCurrency, formatMoney } from '../../../lib/formatters';
import type { DashboardData, Transaction } from '../../../types/dashboard';

interface PaymentDraft {
  amount: string;
  currency: 'PEN' | 'USD';
  cardName: string;
  paymentDate: string;
  notes: string;
}

interface InstallmentDraft {
  amount: string;
  installments: string;
  currency: 'PEN' | 'USD';
  cardName: string;
  description: string;
  category: string;
  firstDueDate: string;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

const emptyPaymentDraft: PaymentDraft = {
  amount: '',
  currency: 'PEN',
  cardName: '',
  paymentDate: todayKey(),
  notes: '',
};

const emptyInstallmentDraft: InstallmentDraft = {
  amount: '',
  installments: '3',
  currency: 'PEN',
  cardName: '',
  description: '',
  category: 'otro',
  firstDueDate: todayKey(),
};

interface DueGroup {
  key: string;
  dueDate: string;
  items: Transaction[];
  total: number;
  paid: number;
  remaining: number;
}

interface CreditCardPayment {
  id: string;
  amount: number;
  currency: 'PEN' | 'USD';
  paymentDate: string;
}

export function TdcSection({
  data,
  authToken,
  chatId,
  onChanged,
}: {
  data: DashboardData;
  authToken?: string | null;
  chatId?: string;
  onChanged?: () => void;
}) {
  const [transactions, setTransactions] = useState<Transaction[]>(
    (data.transacciones || []).filter((tx) => tx.paymentMethod === 'credito'),
  );
  const [payments, setPayments] = useState<CreditCardPayment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const exchangeRate = data.exchangeRate ?? 3.85;

  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [payment, setPayment] = useState<PaymentDraft>(emptyPaymentDraft);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [paymentError, setPaymentError] = useState('');

  const [showInstallmentForm, setShowInstallmentForm] = useState(false);
  const [installment, setInstallment] = useState<InstallmentDraft>(emptyInstallmentDraft);
  const [savingInstallment, setSavingInstallment] = useState(false);
  const [installmentError, setInstallmentError] = useState('');

  const tdcLimite = data.cierre?.tdcLimite ?? 0;
  const tdcDisponible = data.cierre?.tdcDisponible ?? tdcLimite;

  const saveInstallmentPurchase = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!authToken) return;
    setSavingInstallment(true);
    setMessage('');
    setInstallmentError('');

    try {
      await apiRequest('tdc/installment-purchase', {
        method: 'POST',
        token: authToken,
        query: { chat_id: chatId },
        body: {
          amount: Number(installment.amount),
          installments: Number(installment.installments),
          currency: installment.currency,
          cardName: installment.cardName,
          desc: installment.description,
          cat: installment.category,
          firstDueDate: installment.firstDueDate,
        },
      });
      setMessage('Compra a cuotas registrada.');
      setInstallment(emptyInstallmentDraft);
      setShowInstallmentForm(false);
      void loadCreditTransactions();
      onChanged?.();
    } catch (err) {
      setInstallmentError(err instanceof Error ? err.message : 'No se pudo registrar la compra');
    } finally {
      setSavingInstallment(false);
    }
  };

  const savePayment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!authToken) return;
    setSaving(true);
    setMessage('');
    setPaymentError('');

    try {
      await apiRequest('tdc/payments', {
        method: 'POST',
        token: authToken,
        query: { chat_id: chatId },
        body: {
          amount: Number(payment.amount),
          currency: payment.currency,
          cardName: payment.cardName,
          paymentDate: payment.paymentDate,
          notes: payment.notes,
        },
      });
      setMessage('Pago registrado.');
      setPayment(emptyPaymentDraft);
      setShowPaymentForm(false);
      void loadCreditTransactions();
      onChanged?.();
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : 'No se pudo registrar el pago');
    } finally {
      setSaving(false);
    }
  };

  const loadCreditTransactions = useCallback(async () => {
    if (!authToken) return;
    setLoading(true);
    setError('');
    try {
      const [txResult, paymentsResult] = await Promise.all([
        apiRequest<{ transacciones?: Transaction[] }>('transactions', {
          token: authToken,
          query: { chat_id: chatId, payment: 'credito', limit: '500' },
        }),
        apiRequest<{ payments?: CreditCardPayment[] }>('tdc/payments', {
          token: authToken,
          query: { chat_id: chatId },
        }),
      ]);
      setTransactions(txResult.transacciones || []);
      setPayments(paymentsResult.payments || []);
    } catch (err) {
      console.error('TDC transactions error:', err);
      setError('No pude cargar los gastos de tarjeta.');
    } finally {
      setLoading(false);
    }
  }, [authToken, chatId]);

  useEffect(() => {
    void loadCreditTransactions();
  }, [loadCreditTransactions]);

  const totalPaid = useMemo(
    () => payments.reduce((sum, p) => sum + convertCurrency(Number(p.amount || 0), p.currency || 'PEN', 'PEN', exchangeRate), 0),
    [payments, exchangeRate],
  );
  const groups = useMemo(() => applyPayments(buildDueGroups(transactions, exchangeRate), totalPaid), [transactions, exchangeRate, totalPaid]);
  const pendingGroups = groups.filter((group) => group.remaining > 0.005);
  const totalPending = pendingGroups.reduce((sum, group) => sum + group.remaining, 0);
  const todayKey = new Date().toISOString().slice(0, 10);
  const overdueGroups = pendingGroups.filter((group) => group.dueDate && group.dueDate < todayKey);
  const overdueTotal = overdueGroups.reduce((sum, group) => sum + group.remaining, 0);
  const nextGroup = pendingGroups.find((group) => group.dueDate && group.dueDate >= todayKey);

  return (
    <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-4 sm:!p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Title>Tarjeta de credito</Title>
          <Text>{loading ? 'Cargando…' : `${transactions.length} gasto(s) a credito registrados`}</Text>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-tremor-default border border-slate-700 bg-slate-900 px-4 text-sm font-semibold text-slate-100 transition hover:bg-slate-800"
            onClick={() => {
              setMessage('');
              setInstallmentError('');
              setShowInstallmentForm((current) => !current);
            }}
          >
            <RiStackLine className="h-4 w-4" />
            Compra a cuotas
          </button>
          <button
            type="button"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-tremor-default bg-emerald-500 px-4 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
            onClick={() => {
              setMessage('');
              setPaymentError('');
              setShowPaymentForm((current) => !current);
            }}
          >
            <RiBankCardLine className="h-4 w-4" />
            Pagar tarjeta
          </button>
        </div>
      </div>

      {showInstallmentForm ? (
        <form className="mt-4 grid gap-3 rounded-tremor-default border border-slate-700 bg-slate-900/40 p-3" onSubmit={saveInstallmentPurchase}>
          <div className="flex items-center justify-between gap-3">
            <Text className="font-semibold text-slate-100">Registrar compra a cuotas sin intereses</Text>
            <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-tremor-default border border-slate-700 text-slate-300" onClick={() => setShowInstallmentForm(false)} title="Cancelar">
              <RiCloseLine className="h-4 w-4" />
            </button>
          </div>
          <label className="grid gap-1 text-xs font-semibold text-slate-400">
            <span>Descripcion</span>
            <input className="form-input" value={installment.description} onChange={(event) => setInstallment((current) => ({ ...current, description: event.target.value }))} required />
          </label>
          <div className="grid gap-3 sm:grid-cols-4">
            <label className="grid gap-1 text-xs font-semibold text-slate-400">
              <span>Monto total</span>
              <input className="form-input" type="number" min="0.01" step="0.01" value={installment.amount} onChange={(event) => setInstallment((current) => ({ ...current, amount: event.target.value }))} required />
            </label>
            <label className="grid gap-1 text-xs font-semibold text-slate-400">
              <span>N cuotas</span>
              <input className="form-input" type="number" min="2" max="36" step="1" value={installment.installments} onChange={(event) => setInstallment((current) => ({ ...current, installments: event.target.value }))} required />
            </label>
            <label className="grid gap-1 text-xs font-semibold text-slate-400">
              <span>Moneda</span>
              <select className="form-input" value={installment.currency} onChange={(event) => setInstallment((current) => ({ ...current, currency: event.target.value as 'PEN' | 'USD' }))}>
                <option value="PEN">PEN</option>
                <option value="USD">USD</option>
              </select>
            </label>
            <label className="grid gap-1 text-xs font-semibold text-slate-400">
              <span>Tarjeta (opcional)</span>
              <input className="form-input" value={installment.cardName} onChange={(event) => setInstallment((current) => ({ ...current, cardName: event.target.value }))} />
            </label>
          </div>
          <label className="grid gap-1 text-xs font-semibold text-slate-400">
            <span>Fecha del primer corte</span>
            <input className="form-input" type="date" value={installment.firstDueDate} onChange={(event) => setInstallment((current) => ({ ...current, firstDueDate: event.target.value }))} required />
          </label>
          {installment.amount && installment.installments && Number(installment.installments) > 0 ? (
            <Text className="text-xs text-slate-500">
              {installment.installments} cuota(s) de aprox. {formatMoney(Number(installment.amount) / Number(installment.installments))}
            </Text>
          ) : null}
          {installmentError ? <div className="rounded-tremor-default border border-rose-500/30 bg-rose-500/10 p-2 text-sm text-rose-100">{installmentError}</div> : null}
          <button className="inline-flex h-10 items-center justify-center gap-2 rounded-tremor-default bg-slate-100 px-4 text-sm font-semibold text-slate-950 transition hover:bg-white disabled:opacity-60" disabled={savingInstallment || !authToken}>
            <RiSave3Line className="h-4 w-4" />
            Registrar compra
          </button>
        </form>
      ) : null}

      {showPaymentForm ? (
        <form className="mt-4 grid gap-3 rounded-tremor-default border border-emerald-500/20 bg-emerald-500/10 p-3" onSubmit={savePayment}>
          <div className="flex items-center justify-between gap-3">
            <Text className="font-semibold text-emerald-100">Registrar pago de tarjeta</Text>
            <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-tremor-default border border-emerald-500/30 text-emerald-100" onClick={() => setShowPaymentForm(false)} title="Cancelar">
              <RiCloseLine className="h-4 w-4" />
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            <label className="grid gap-1 text-xs font-semibold text-slate-400">
              <span>Monto</span>
              <input className="form-input" type="number" min="0.01" step="0.01" value={payment.amount} onChange={(event) => setPayment((current) => ({ ...current, amount: event.target.value }))} required />
            </label>
            <label className="grid gap-1 text-xs font-semibold text-slate-400">
              <span>Moneda</span>
              <select className="form-input" value={payment.currency} onChange={(event) => setPayment((current) => ({ ...current, currency: event.target.value as 'PEN' | 'USD' }))}>
                <option value="PEN">PEN</option>
                <option value="USD">USD</option>
              </select>
            </label>
            <label className="grid gap-1 text-xs font-semibold text-slate-400">
              <span>Tarjeta (opcional)</span>
              <input className="form-input" value={payment.cardName} onChange={(event) => setPayment((current) => ({ ...current, cardName: event.target.value }))} />
            </label>
            <label className="grid gap-1 text-xs font-semibold text-slate-400">
              <span>Fecha</span>
              <input className="form-input" type="date" value={payment.paymentDate} onChange={(event) => setPayment((current) => ({ ...current, paymentDate: event.target.value }))} required />
            </label>
          </div>
          <label className="grid gap-1 text-xs font-semibold text-slate-400">
            <span>Nota (opcional)</span>
            <input className="form-input" value={payment.notes} onChange={(event) => setPayment((current) => ({ ...current, notes: event.target.value }))} />
          </label>
          <button className="inline-flex h-10 items-center justify-center gap-2 rounded-tremor-default bg-emerald-500 px-4 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-60" disabled={saving || !authToken}>
            <RiSave3Line className="h-4 w-4" />
            Registrar pago
          </button>
        </form>
      ) : null}

      {message ? <div className="mt-3 rounded-tremor-default border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-100">{message}</div> : null}
      {paymentError ? <div className="mt-3 rounded-tremor-default border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-100">{paymentError}</div> : null}

      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <CreditCardVisual
          disponible={tdcDisponible}
          limite={tdcLimite}
          totalPending={totalPending}
          overdueCount={overdueGroups.length}
        />
        <div className="grid grid-cols-2 gap-3">
          <MiniStat
            label="Vencido"
            value={formatMoney(overdueTotal)}
            tone={overdueTotal > 0 ? 'bad' : 'good'}
            detail={overdueGroups.length ? `${overdueGroups.length} corte(s) pasado(s)` : 'sin cortes vencidos'}
            icon={<RiAlarmWarningLine className="h-4 w-4" />}
          />
          <MiniStat
            label="Proximo pago"
            value={nextGroup ? formatMoney(nextGroup.total) : formatMoney(0)}
            tone="info"
            detail={nextGroup ? `pagar ${formatDateLabel(nextGroup.dueDate)}` : 'sin pagos programados'}
            icon={<RiBankCardLine className="h-4 w-4" />}
          />
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-tremor-default border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      {!transactions.length && !loading ? (
        <div className="mt-5">
          <EmptyState>Sin gastos a credito registrados.</EmptyState>
        </div>
      ) : (
        <div className="mt-5 grid gap-3">
          {groups.map((group) => {
            const isPaid = group.remaining <= 0.005;
            const isOverdue = !isPaid && Boolean(group.dueDate && group.dueDate < todayKey);
            const pct = group.total > 0 ? Math.min(100, Math.round((group.paid / group.total) * 100)) : 0;
            const barColor = isPaid ? 'bg-emerald-500' : isOverdue ? 'bg-rose-500' : 'bg-amber-400';
            return (
              <Collapsible
                key={group.key}
                defaultOpen={isOverdue || group.key === nextGroup?.key}
                className={isOverdue ? 'border-rose-500/30 bg-rose-500/[0.03]' : ''}
                summary={
                  <div className="flex w-full flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-100">
                        {group.dueDate ? `Pago ${formatDateLabel(group.dueDate)}` : 'Sin fecha de pago'}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">{group.items.length} gasto(s)</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {isPaid ? (
                        <Badge color="emerald">Pagado</Badge>
                      ) : isOverdue ? (
                        <Badge color="rose">Vencido</Badge>
                      ) : group.dueDate ? (
                        <Badge color="emerald">Programado</Badge>
                      ) : (
                        <Badge color="slate">Sin fecha</Badge>
                      )}
                      <span className="font-mono text-sm font-semibold text-slate-100">{formatMoney(group.remaining)}</span>
                    </div>
                  </div>
                }
              >
                <div className="mb-3">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                    <div className={`h-full rounded-full ${barColor}`} style={{ width: `${isPaid ? 100 : pct}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {formatMoney(group.paid)} pagado de {formatMoney(group.total)}
                  </p>
                </div>
                <TransactionsTable
                  transactions={group.items}
                  authToken={authToken}
                  chatId={chatId}
                  onChanged={() => {
                    void loadCreditTransactions();
                    onChanged?.();
                  }}
                />
              </Collapsible>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function CreditCardVisual({
  disponible,
  limite,
  totalPending,
  overdueCount,
}: {
  disponible: number;
  limite: number;
  totalPending: number;
  overdueCount: number;
}) {
  const used = Math.max(0, limite - disponible);
  const usedPct = limite > 0 ? Math.min(100, Math.round((used / limite) * 100)) : 0;
  const barColor = usedPct >= 90 ? 'bg-rose-400' : usedPct >= 70 ? 'bg-amber-400' : 'bg-emerald-400';
  return (
    <div className="relative overflow-hidden rounded-tremor-default border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 p-4 sm:p-5">
      <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-indigo-500/10 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-12 -left-8 h-32 w-32 rounded-full bg-emerald-500/10 blur-2xl" />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-[0.68rem] font-medium uppercase tracking-wide text-slate-400">Disponible</p>
          <p className={`mt-1 font-mono text-2xl font-semibold sm:text-3xl ${disponible < 0 ? 'text-rose-300' : 'text-slate-50'}`}>
            {formatMoney(disponible)}
          </p>
        </div>
        <RiBankCardLine className="h-8 w-8 text-slate-600" />
      </div>
      <div className="relative mt-4">
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800/80">
          <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${usedPct}%` }} />
        </div>
        <div className="mt-1.5 flex items-center justify-between text-xs text-slate-500">
          <span>{usedPct}% usado</span>
          <span>limite {formatMoney(limite)}</span>
        </div>
      </div>
      <div className="relative mt-4 flex items-center justify-between border-t border-slate-800/70 pt-3">
        <div>
          <p className="text-[0.68rem] font-medium uppercase tracking-wide text-slate-500">Total a pagar</p>
          <p className={`font-mono text-sm font-semibold ${totalPending > 0 ? 'text-rose-300' : 'text-emerald-300'}`}>
            {formatMoney(totalPending)}
          </p>
        </div>
        {overdueCount > 0 ? (
          <Badge color="rose" icon={RiAlarmWarningLine}>
            {overdueCount} vencido(s)
          </Badge>
        ) : (
          <Badge color="emerald">Al dia</Badge>
        )}
      </div>
    </div>
  );
}

const miniStatTone: Record<'good' | 'bad' | 'info', string> = {
  good: 'text-emerald-300',
  bad: 'text-rose-300',
  info: 'text-slate-200',
};

function MiniStat({
  label,
  value,
  tone,
  detail,
  icon,
}: {
  label: string;
  value: string;
  tone: 'good' | 'bad' | 'info';
  detail: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-tremor-default border border-slate-800 bg-slate-900/40 p-3.5">
      <div className="flex items-center gap-1.5 text-slate-500">
        {icon}
        <p className="truncate text-[0.68rem] font-medium uppercase tracking-wide">{label}</p>
      </div>
      <p className={`mt-1.5 truncate font-mono text-lg font-semibold sm:text-xl ${miniStatTone[tone]}`}>{value}</p>
      <p className="mt-0.5 truncate text-xs text-slate-500">{detail}</p>
    </div>
  );
}

function buildDueGroups(transactions: Transaction[], exchangeRate: number): DueGroup[] {
  const map = new Map<string, DueGroup>();
  for (const tx of transactions) {
    const dueDate = tx.paymentDueDate || '';
    const key = dueDate || 'sin-fecha';
    const group = map.get(key) || { key, dueDate, items: [], total: 0, paid: 0, remaining: 0 };
    group.items.push(tx);
    group.total += convertCurrency(Number(tx.monto || 0), tx.currency || 'PEN', 'PEN', exchangeRate);
    map.set(key, group);
  }
  return Array.from(map.values()).sort((a, b) => {
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return a.dueDate.localeCompare(b.dueDate);
  });
}

// Los pagos de tarjeta no estan ligados a un corte especifico, se registran
// como monto global (ver addCreditCardPayment). Se aplican FIFO a los cortes
// mas antiguos primero para que "Vencido" refleje lo realmente pendiente.
function applyPayments(groups: DueGroup[], totalPaid: number): DueGroup[] {
  let remainingPayment = totalPaid;
  return groups.map((group) => {
    const paid = Math.min(group.total, remainingPayment);
    remainingPayment -= paid;
    return { ...group, paid, remaining: round2(group.total - paid) };
  });
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatDateLabel(value?: string): string {
  if (!value) return '';
  const [year, month, day] = value.split('-');
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}
