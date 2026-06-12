import { useCallback, useEffect, useMemo, useState } from 'react';
import { RiDownloadLine } from '@remixicon/react';
import { Card, Text, Title } from '@tremor/react';
import { apiEndpoint } from '../../app/api';
import { TransactionsTable } from '../../components/dashboard/TransactionsTable';
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

  const loadTransactions = useCallback(async () => {
    if (!authToken) return;
    setLoading(true);
    try {
      const url = new URL(apiEndpoint('transactions'));
      url.searchParams.set('limit', '500');
      if (chatId) url.searchParams.set('chat_id', chatId);
      Object.entries(filters).forEach(([key, value]) => {
        if (value) url.searchParams.set(key, value);
      });

      const response = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const result = await response.json() as { ok?: boolean; transacciones?: Transaction[]; error?: string };
      if (!response.ok || result.ok === false) throw new Error(result.error || 'No se pudo leer movimientos');
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
        <div className="flex flex-col gap-2 min-[420px]:flex-row min-[420px]:items-center">
          <button
            type="button"
            className="inline-flex h-10 w-full min-w-[9.5rem] items-center justify-center gap-2 rounded-tremor-default border border-emerald-500/40 bg-emerald-500/10 px-3 text-sm font-semibold text-emerald-100 shadow-sm transition hover:border-emerald-400/60 hover:bg-emerald-500/15 focus:outline-none focus:ring-2 focus:ring-emerald-400/30 disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-900/70 disabled:text-slate-500 disabled:opacity-55 min-[420px]:w-auto"
            disabled={!transactions.length || loading}
            onClick={exportFiltered}
          >
            <RiDownloadLine className="h-4 w-4 shrink-0" aria-hidden="true" />
            Exportar Movimiento
          </button>
          <span className="inline-flex h-10 w-full min-w-[8.5rem] items-center justify-center rounded-tremor-default border border-slate-700 bg-slate-900/70 px-3 text-sm font-semibold text-slate-300 shadow-sm min-[420px]:w-auto">
            Filtro: {filters.month ? formatMonthFilter(filters.month) : 'Historico'}
          </span>
        </div>
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-3 lg:grid-cols-6">
        <input className="form-input" placeholder="Buscar" value={filters.q} onChange={(event) => setFilters((current) => ({ ...current, q: event.target.value }))} />
        <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-2 md:col-span-2 lg:col-span-2">
          <input className="form-input min-w-0" type="month" value={filters.month} onChange={(event) => setFilters((current) => ({ ...current, month: event.target.value }))} />
          <button
            type="button"
            className="inline-flex h-10 items-center justify-center rounded-tremor-default border border-slate-700 bg-slate-900/70 px-3 text-xs font-semibold text-slate-200 transition hover:border-emerald-500/50 hover:bg-emerald-500/10 hover:text-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
            onClick={() => setFilters((current) => ({ ...current, month: currentMonthKey() }))}
          >
            Actual
          </button>
          <button
            type="button"
            className="inline-flex h-10 items-center justify-center rounded-tremor-default border border-slate-700 bg-slate-900/70 px-3 text-xs font-semibold text-slate-200 transition hover:border-sky-500/50 hover:bg-sky-500/10 hover:text-sky-100 focus:outline-none focus:ring-2 focus:ring-sky-400/30"
            onClick={() => setFilters((current) => ({ ...current, month: '' }))}
          >
            Todos
          </button>
        </div>
        <select className="form-input" value={filters.category} onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value }))}>
          <option value="">Categoria</option>
          {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
        </select>
        <select className="form-input" value={filters.type} onChange={(event) => setFilters((current) => ({ ...current, type: event.target.value }))}>
          <option value="">Tipo</option>
          <option value="gasto">Gasto</option>
          <option value="ingreso">Ingreso</option>
        </select>
        <select className="form-input" value={filters.payment} onChange={(event) => setFilters((current) => ({ ...current, payment: event.target.value }))}>
          <option value="">Pago</option>
          <option value="debito">Debito</option>
          <option value="credito">Credito</option>
        </select>
        <select className="form-input" value={filters.currency} onChange={(event) => setFilters((current) => ({ ...current, currency: event.target.value }))}>
          <option value="">Moneda</option>
          <option value="PEN">PEN</option>
          <option value="USD">USD</option>
        </select>
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
