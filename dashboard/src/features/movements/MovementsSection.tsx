import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Card, Text, Title } from '@tremor/react';
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
    month: data.mesKey || '',
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

  return (
    <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-4 sm:!p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Title>Movimientos</Title>
          <Text>{transactions.length} registros {loading ? 'cargando...' : 'filtrados'}</Text>
        </div>
        <Badge color="emerald">{data.mes}</Badge>
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-3 lg:grid-cols-6">
        <input className="form-input" placeholder="Buscar" value={filters.q} onChange={(event) => setFilters((current) => ({ ...current, q: event.target.value }))} />
        <input className="form-input" type="month" value={filters.month} onChange={(event) => setFilters((current) => ({ ...current, month: event.target.value }))} />
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
