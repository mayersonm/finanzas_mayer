import { useCallback, useEffect, useMemo, useState } from 'react';
import { RiArrowLeftSLine, RiArrowRightSLine, RiCloseLine, RiDownloadLine, RiSearchLine } from '@remixicon/react';
import { Card, Text, Title } from '@tremor/react';
import { apiRequest } from '../../app/apiClient';
import { TransactionsTable } from '../../components/dashboard/TransactionsTable';
import { SummaryBar } from '../../components/common/SummaryBar';
import { formatMoney } from '../../lib/formatters';
import type { DashboardData, Transaction } from '../../types/dashboard';

export function MovementsSection({
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
  const [transactions, setTransactions] = useState<Transaction[]>(data.transacciones);
  const [filters, setFilters] = useState({
    q: '',
    month: currentMonthKey(),
    category: '',
    type: '',
    payment: '',
    currency: '',
  });
  const [loading, setLoading] = useState(false);
  const categories = useMemo(() => Array.from(new Set(data.categorias.map((item) => item.cat.toLowerCase()))).sort(), [data.categorias]);
  const totals = useMemo(() => transactions.reduce((acc, tx) => {
    const amount = Number(tx.monto || 0);
    if (tx.tipo === 'ingreso') acc.ingresos += amount; else acc.gastos += amount;
    return acc;
  }, { ingresos: 0, gastos: 0 }), [transactions]);

  const setFilter = (key: keyof typeof filters, value: string) => setFilters((current) => ({ ...current, [key]: value }));
  const shiftMonth = (offset: number) => setFilters((current) => ({ ...current, month: addMonths(current.month || currentMonthKey(), offset) }));
  const toggleAllMonths = () => setFilters((current) => ({ ...current, month: current.month ? '' : currentMonthKey() }));
  const clearFilters = () => setFilters({ q: '', month: currentMonthKey(), category: '', type: '', payment: '', currency: '' });
  const isCurrentMonth = filters.month === currentMonthKey();
  const hasActiveFilters = Boolean(filters.q || filters.category || filters.type || filters.payment || filters.currency) || filters.month !== currentMonthKey();

  const loadTransactions = useCallback(async () => {
    if (!authToken) return;
    setLoading(true);
    try {
      const result = await apiRequest<{ transacciones?: Transaction[] }>('transactions', {
        token: authToken,
        query: { limit: '500', chat_id: chatId, ...filters },
      });
      setTransactions(result.transacciones || []);
    } catch (error) {
      console.error('Transactions filter error:', error);
    } finally {
      setLoading(false);
    }
  }, [authToken, chatId, filters]);

  useEffect(() => {
    void loadTransactions();
  }, [loadTransactions]);

  const exportFiltered = useCallback(() => {
    if (!transactions.length) return;

    const headers = [
      'fecha',
      'hora',
      'tipo',
      'descripcion',
      'categoria',
      'metodo_pago',
      'fecha_pago',
      'tarjeta',
      'moneda',
      'monto',
      'recibo',
    ];
    const rows = transactions.map((tx) => [
      tx.fecha,
      tx.hora || '',
      tx.tipo,
      tx.desc,
      tx.cat,
      tx.paymentMethod || '',
      tx.paymentDueDate || '',
      tx.cardName || '',
      tx.currency || 'PEN',
      Number(tx.monto || 0).toFixed(2),
      tx.receipt?.id || '',
    ]);
    const csv = `\ufeff${[headers, ...rows].map((row) => row.map(csvCell).join(';')).join('\r\n')}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const month = filters.month || 'historico';
    link.href = url;
    link.download = `movimientos-filtrados-${month}-${transactions.length}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }, [filters.month, transactions]);

  return (
    <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-4 sm:!p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Title>Movimientos</Title>
          <Text>{transactions.length} registros {loading ? 'cargando...' : 'filtrados'}</Text>
        </div>
        <button
          type="button"
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-tremor-default border border-emerald-500/40 bg-emerald-500/10 px-3 text-sm font-semibold text-emerald-100 shadow-sm transition hover:border-emerald-400/60 hover:bg-emerald-500/15 focus:outline-none focus:ring-2 focus:ring-emerald-400/30 disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-900/70 disabled:text-slate-500 disabled:opacity-55 sm:w-auto"
          disabled={!transactions.length || loading}
          onClick={exportFiltered}
        >
          <RiDownloadLine className="h-4 w-4 shrink-0" aria-hidden="true" />
          Exportar
        </button>
      </div>

      {/* Busqueda + navegacion de mes */}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <RiSearchLine className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
          <input
            className="form-input !pl-9"
            placeholder="Buscar por descripcion o categoria"
            value={filters.q}
            onChange={(event) => setFilter('q', event.target.value)}
          />
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-tremor-default border border-slate-700 bg-slate-900/60 text-slate-200 transition hover:bg-slate-800 disabled:opacity-40"
            onClick={() => shiftMonth(-1)}
            disabled={!filters.month}
            aria-label="Mes anterior"
          >
            <RiArrowLeftSLine className="h-4 w-4" aria-hidden="true" />
          </button>
          <span className="min-w-[7.5rem] text-center text-sm font-semibold text-slate-100">
            {filters.month ? monthLabel(filters.month) : 'Todos los meses'}
          </span>
          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-tremor-default border border-slate-700 bg-slate-900/60 text-slate-200 transition hover:bg-slate-800 disabled:opacity-40"
            onClick={() => shiftMonth(1)}
            disabled={!filters.month || isCurrentMonth}
            aria-label="Mes siguiente"
          >
            <RiArrowRightSLine className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            className={`h-10 rounded-tremor-default border px-3 text-xs font-semibold transition ${
              filters.month
                ? 'border-slate-700 bg-slate-900/60 text-slate-300 hover:bg-slate-800'
                : 'border-cyan-500/40 bg-cyan-500/10 text-cyan-200'
            }`}
            onClick={toggleAllMonths}
          >
            {filters.month ? 'Todos' : 'Mes'}
          </button>
        </div>
      </div>

      {/* Filtros rapidos */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Segmented
          value={filters.type}
          onChange={(value) => setFilter('type', value)}
          options={[{ value: '', label: 'Todos' }, { value: 'ingreso', label: 'Ingreso' }, { value: 'gasto', label: 'Gasto' }]}
        />
        <Segmented
          value={filters.payment}
          onChange={(value) => setFilter('payment', value)}
          options={[{ value: '', label: 'Pago' }, { value: 'debito', label: 'Debito' }, { value: 'credito', label: 'Credito' }]}
        />
        <Segmented
          value={filters.currency}
          onChange={(value) => setFilter('currency', value)}
          options={[{ value: '', label: 'Moneda' }, { value: 'PEN', label: 'PEN' }, { value: 'USD', label: 'USD' }]}
        />
        <select
          className="form-input !h-9 w-auto min-w-[8rem] capitalize"
          value={filters.category}
          onChange={(event) => setFilter('category', event.target.value)}
        >
          <option value="">Categoria</option>
          {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
        </select>
        {hasActiveFilters ? (
          <button
            type="button"
            className="inline-flex h-9 items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/10 px-3 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/20"
            onClick={clearFilters}
          >
            <RiCloseLine className="h-3.5 w-3.5" aria-hidden="true" />
            Limpiar
          </button>
        ) : null}
      </div>

      <SummaryBar
        className="mt-4"
        stats={[
          { label: 'Movimientos', value: String(transactions.length), detail: filters.month ? formatMonthFilter(filters.month) : 'Historico' },
          { label: 'Ingresos', value: formatMoney(totals.ingresos), tone: 'good' },
          { label: 'Gastos', value: formatMoney(totals.gastos), tone: 'bad' },
          { label: 'Balance', value: formatMoney(totals.ingresos - totals.gastos), tone: totals.ingresos - totals.gastos >= 0 ? 'good' : 'bad' },
        ]}
      />

      <TransactionsTable
        transactions={transactions}
        authToken={authToken}
        chatId={chatId}
        onChanged={() => {
          void loadTransactions();
          onChanged?.();
        }}
      />
    </Card>
  );
}

function Segmented({
  value,
  options,
  onChange,
}: {
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <div className="inline-flex items-center rounded-full border border-slate-800 bg-slate-900/40 p-0.5">
      {options.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value || 'all'}
            type="button"
            onClick={() => onChange(option.value)}
            className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${
              active ? 'bg-cyan-500/15 text-cyan-200' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function addMonths(monthKey: string, offset: number) {
  const [year, month] = monthKey.split('-').map(Number);
  const date = new Date(Date.UTC(year || new Date().getFullYear(), (month || 1) - 1 + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number);
  const date = new Date(Date.UTC(year || 2026, (month || 1) - 1, 1));
  return date.toLocaleDateString('es-PE', { month: 'short', year: 'numeric' });
}

function csvCell(value: unknown) {
  const text = String(value ?? '').replace(/\r?\n/g, ' ').trim();
  return `"${text.replace(/"/g, '""')}"`;
}

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonthFilter(value: string) {
  const [year, month] = value.split('-');
  if (!year || !month) return value;
  return `${month}/${year}`;
}
