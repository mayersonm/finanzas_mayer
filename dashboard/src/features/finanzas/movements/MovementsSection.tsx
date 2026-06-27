import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { RiArrowLeftSLine, RiArrowRightSLine, RiCloseLine, RiDownloadLine, RiSearchLine } from '@remixicon/react';
import { Card, Text, Title } from '@tremor/react';
import { apiRequest } from '../../../app/apiClient';
import { TransactionsTable } from '../../../components/dashboard/TransactionsTable';
import { SummaryBar } from '../../../components/common/SummaryBar';
import { convertCurrency, formatMoney } from '../../../lib/formatters';
import type { DashboardData, Transaction } from '../../../types/dashboard';

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
  // 0 = ciclo actual (desde el ultimo sueldo). Negativo = ciclos anteriores.
  const [cycleOffset, setCycleOffset] = useState(0);
  // Ventana del ciclo que resuelve la API (anclada al sueldo).
  const [cycleInfo, setCycleInfo] = useState<{ start: string; end: string } | null>(
    data.cycleStart && data.cycleEnd ? { start: data.cycleStart, end: data.cycleEnd } : null,
  );
  const [filters, setFilters] = useState({
    q: '',
    category: '',
    type: '',
    payment: '',
    currency: '',
  });
  const [loading, setLoading] = useState(false);
  const categories = useMemo(() => Array.from(new Set(data.categorias.map((item) => item.cat.toLowerCase()))).sort(), [data.categorias]);
  const exchangeRate = data.exchangeRate ?? 3.85;
  const totals = useMemo(() => transactions.reduce((acc, tx) => {
    const amount = convertCurrency(Number(tx.monto || 0), tx.currency || 'PEN', 'PEN', exchangeRate);
    if (tx.tipo === 'ingreso') acc.ingresos += amount; else acc.gastos += amount;
    return acc;
  }, { ingresos: 0, gastos: 0 }), [transactions, exchangeRate]);

  const isCurrentCycle = cycleOffset === 0;
  const cycleLabel = cycleInfo ? cycleRangeLabel(cycleInfo.start, cycleInfo.end) : (loading ? '…' : 'Ciclo');

  const setFilter = (key: keyof typeof filters, value: string) => setFilters((current) => ({ ...current, [key]: value }));
  const clearFilters = () => {
    setCycleOffset(0);
    setFilters({ q: '', category: '', type: '', payment: '', currency: '' });
  };
  const hasActiveFilters = Boolean(filters.q || filters.category || filters.type || filters.payment || filters.currency) || cycleOffset !== 0;

  const loadTransactions = useCallback(async () => {
    if (!authToken) return;
    setLoading(true);
    try {
      // El ciclo lo resuelve la API (anclado al sueldo). offset 0 = actual.
      const result = await apiRequest<{ transacciones?: Transaction[]; cycle?: { start: string; end: string; offset: number } | null }>('transactions', {
        token: authToken,
        query: {
          limit: '500',
          chat_id: chatId,
          q: filters.q || undefined,
          category: filters.category || undefined,
          type: filters.type || undefined,
          payment: filters.payment || undefined,
          currency: filters.currency || undefined,
          cycle_offset: String(cycleOffset),
        },
      });
      setTransactions(result.transacciones || []);
      setCycleInfo(result.cycle ? { start: result.cycle.start, end: result.cycle.end } : null);
    } catch (error) {
      console.error('Transactions filter error:', error);
    } finally {
      setLoading(false);
    }
  }, [authToken, chatId, cycleOffset, filters]);

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
    const periodo = cycleInfo?.start || 'ciclo';
    link.href = url;
    link.download = `movimientos-${periodo}-${transactions.length}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }, [cycleInfo, transactions]);

  return (
    <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-4 sm:!p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Title>Movimientos</Title>
          <Text>{loading ? 'Cargando…' : `${transactions.length} movimientos en este ciclo`}</Text>
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

      {/* 1) Periodo: que ciclo estoy viendo */}
      <div className="mt-4 rounded-tremor-default border border-slate-800 bg-slate-900/40 p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Periodo</p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="grid h-10 w-10 place-items-center rounded-tremor-default border border-slate-700 bg-slate-900/60 text-slate-200 transition hover:bg-slate-800"
              onClick={() => setCycleOffset((o) => o - 1)}
              aria-label="Ciclo anterior"
            >
              <RiArrowLeftSLine className="h-4 w-4" aria-hidden="true" />
            </button>
            <span className="min-w-[10rem] text-center text-sm font-semibold text-slate-100">{cycleLabel}</span>
            <button
              type="button"
              className="grid h-10 w-10 place-items-center rounded-tremor-default border border-slate-700 bg-slate-900/60 text-slate-200 transition hover:bg-slate-800 disabled:opacity-40"
              onClick={() => setCycleOffset((o) => Math.min(0, o + 1))}
              disabled={isCurrentCycle}
              aria-label="Ciclo siguiente"
            >
              <RiArrowRightSLine className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${isCurrentCycle ? 'bg-emerald-500/15 text-emerald-200' : 'bg-slate-800 text-slate-300'}`}>
              {isCurrentCycle ? 'Ciclo actual' : 'Ciclo anterior'}
            </span>
            {!isCurrentCycle ? (
              <button
                type="button"
                className="h-9 rounded-tremor-default border border-cyan-500/40 bg-cyan-500/10 px-3 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-500/15"
                onClick={() => setCycleOffset(0)}
              >
                Ir al actual
              </button>
            ) : null}
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {isCurrentCycle
            ? 'Solo el ciclo abierto. Lo que ya cerraste no se cuenta aqui.'
            : 'Ciclo cerrado: se muestra todo lo de ese periodo, como historico.'}
        </p>
      </div>

      {/* 2) Totales del ciclo seleccionado */}
      <SummaryBar
        className="mt-4"
        stats={[
          { label: 'Ingresos', value: formatMoney(totals.ingresos), tone: 'good', detail: 'del ciclo, en PEN' },
          { label: 'Gastos', value: formatMoney(totals.gastos), tone: 'bad', detail: 'del ciclo, en PEN' },
          { label: 'Neto del ciclo', value: formatMoney(totals.ingresos - totals.gastos), tone: totals.ingresos - totals.gastos >= 0 ? 'good' : 'bad', detail: 'ingresos − gastos (no es tu caja)' },
        ]}
      />

      {/* 3) Filtros dentro del ciclo */}
      <div className="mt-4 rounded-tremor-default border border-slate-800 bg-slate-900/40 p-3">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Filtros</p>
          {hasActiveFilters ? (
            <button
              type="button"
              className="inline-flex h-8 items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/10 px-3 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/20"
              onClick={clearFilters}
            >
              <RiCloseLine className="h-3.5 w-3.5" aria-hidden="true" />
              Limpiar
            </button>
          ) : null}
        </div>
        <div className="relative">
          <RiSearchLine className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
          <input
            className="form-input !pl-9"
            placeholder="Buscar por descripcion o categoria"
            value={filters.q}
            onChange={(event) => setFilter('q', event.target.value)}
          />
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <FilterField label="Tipo">
            <Segmented
              value={filters.type}
              onChange={(value) => setFilter('type', value)}
              options={[{ value: '', label: 'Todos' }, { value: 'ingreso', label: 'Ingreso' }, { value: 'gasto', label: 'Gasto' }]}
            />
          </FilterField>
          <FilterField label="Pago">
            <Segmented
              value={filters.payment}
              onChange={(value) => setFilter('payment', value)}
              options={[{ value: '', label: 'Todos' }, { value: 'debito', label: 'Debito' }, { value: 'credito', label: 'Credito' }]}
            />
          </FilterField>
          <FilterField label="Moneda">
            <Segmented
              value={filters.currency}
              onChange={(value) => setFilter('currency', value)}
              options={[{ value: '', label: 'Todas' }, { value: 'PEN', label: 'PEN' }, { value: 'USD', label: 'USD' }]}
            />
          </FilterField>
          <FilterField label="Categoria">
            <select
              className="form-input !h-9 w-full capitalize"
              value={filters.category}
              onChange={(event) => setFilter('category', event.target.value)}
            >
              <option value="">Todas</option>
              {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </FilterField>
        </div>
      </div>

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

function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1">
      <span className="text-xs font-medium text-slate-400">{label}</span>
      {children}
    </div>
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

function cycleRangeLabel(start: string, end: string): string {
  if (!start || !end) return 'Ciclo';
  return `${start.slice(8, 10)}/${start.slice(5, 7)} - ${end.slice(8, 10)}/${end.slice(5, 7)}`;
}

function csvCell(value: unknown) {
  const text = String(value ?? '').replace(/\r?\n/g, ' ').trim();
  return `"${text.replace(/"/g, '""')}"`;
}
