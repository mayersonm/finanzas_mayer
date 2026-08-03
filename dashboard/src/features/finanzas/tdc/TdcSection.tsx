import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Card, Text, Title } from '@tremor/react';
import { apiRequest } from '../../../app/apiClient';
import { EmptyState } from '../../../components/common/EmptyState';
import { SummaryBar } from '../../../components/common/SummaryBar';
import { TransactionsTable } from '../../../components/dashboard/TransactionsTable';
import { convertCurrency, formatMoney } from '../../../lib/formatters';
import type { DashboardData, Transaction } from '../../../types/dashboard';

interface DueGroup {
  key: string;
  dueDate: string;
  items: Transaction[];
  total: number;
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const exchangeRate = data.exchangeRate ?? 3.85;

  const loadCreditTransactions = useCallback(async () => {
    if (!authToken) return;
    setLoading(true);
    setError('');
    try {
      const result = await apiRequest<{ transacciones?: Transaction[] }>('transactions', {
        token: authToken,
        query: { chat_id: chatId, payment: 'credito', limit: '500' },
      });
      setTransactions(result.transacciones || []);
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

  const groups = useMemo(() => buildDueGroups(transactions, exchangeRate), [transactions, exchangeRate]);
  const totalPending = groups.reduce((sum, group) => sum + group.total, 0);
  const todayKey = new Date().toISOString().slice(0, 10);
  const overdueGroups = groups.filter((group) => group.dueDate && group.dueDate < todayKey);
  const overdueTotal = overdueGroups.reduce((sum, group) => sum + group.total, 0);
  const nextGroup = groups.find((group) => group.dueDate && group.dueDate >= todayKey);

  return (
    <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-4 sm:!p-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Title>Tarjeta de credito</Title>
          <Text>{loading ? 'Cargando…' : `${transactions.length} gasto(s) a credito registrados`}</Text>
        </div>
      </div>

      <SummaryBar
        className="mt-4"
        stats={[
          { label: 'Total a pagar', value: formatMoney(totalPending), tone: totalPending > 0 ? 'bad' : 'good', detail: 'todos los cortes con gasto a credito' },
          {
            label: 'Vencido',
            value: formatMoney(overdueTotal),
            tone: overdueTotal > 0 ? 'bad' : 'good',
            detail: overdueGroups.length ? `${overdueGroups.length} corte(s) pasado(s)` : 'sin cortes vencidos',
          },
          {
            label: 'Proximo pago',
            value: nextGroup ? formatMoney(nextGroup.total) : formatMoney(0),
            tone: 'info',
            detail: nextGroup ? `pagar ${formatDateLabel(nextGroup.dueDate)}` : 'sin pagos programados',
          },
        ]}
      />

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
        <div className="mt-5 grid gap-4">
          {groups.map((group) => {
            const isOverdue = Boolean(group.dueDate && group.dueDate < todayKey);
            return (
              <div key={group.key} className="rounded-tremor-default border border-slate-800 bg-slate-900/30 p-3 sm:p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-100">
                      {group.dueDate ? `Pago ${formatDateLabel(group.dueDate)}` : 'Sin fecha de pago'}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">{group.items.length} gasto(s)</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isOverdue ? (
                      <Badge color="rose">Vencido</Badge>
                    ) : group.dueDate ? (
                      <Badge color="emerald">Programado</Badge>
                    ) : (
                      <Badge color="slate">Sin fecha</Badge>
                    )}
                    <span className="font-mono text-sm font-semibold text-slate-100">{formatMoney(group.total)}</span>
                  </div>
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
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function buildDueGroups(transactions: Transaction[], exchangeRate: number): DueGroup[] {
  const map = new Map<string, DueGroup>();
  for (const tx of transactions) {
    const dueDate = tx.paymentDueDate || '';
    const key = dueDate || 'sin-fecha';
    const group = map.get(key) || { key, dueDate, items: [], total: 0 };
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

function formatDateLabel(value?: string): string {
  if (!value) return '';
  const [year, month, day] = value.split('-');
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}
