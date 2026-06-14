import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Badge, Card, Text, Title } from '@tremor/react';
import { RiAddLine, RiDeleteBinLine, RiNotification3Line, RiRefreshLine } from '@remixicon/react';
import { apiEndpoint } from '../../app/api';
import { EmptyState } from '../../components/common/EmptyState';
import { formatMoney, formatUpdatedAt } from '../../lib/formatters';
import type { CryptoAlert, CryptoOperation, CryptoPortfolioData, CryptoPosition, CryptoPrice } from '../../types/dashboard';

interface OperationDraft {
  symbol: string;
  type: 'buy' | 'sell';
  quantity: string;
  unitPriceUsd: string;
  currency: 'USD' | 'PEN';
  operationDate: string;
  notes: string;
}

interface AlertDraft {
  symbol: string;
  condition: 'below' | 'above';
  targetPriceUsd: string;
  notes: string;
}

const emptyData: CryptoPortfolioData = {
  exchangeRate: 3.85,
  prices: [],
  positions: [],
  operations: [],
  alerts: [],
  summary: {
    totalInvestedUsd: 0,
    totalValueUsd: 0,
    gainUsd: 0,
    gainPct: 0,
    totalInvestedPen: 0,
    totalValuePen: 0,
    gainPen: 0,
    positions: 0,
  },
  binance: {
    configured: false,
    balances: [],
    summary: {
      assets: 0,
      totalValueUsd: 0,
      totalValuePen: 0,
    },
  },
  suggestions: [],
};

const defaultSymbols = ['BTC', 'ETH', 'SOL', 'USDT', 'USDC', 'BNB', 'XRP', 'ADA'];

export function CryptoInvestmentsPanel({
  authToken,
  chatId,
  exchangeRate = 3.85,
}: {
  authToken?: string | null;
  chatId?: string;
  exchangeRate?: number;
}) {
  const [data, setData] = useState<CryptoPortfolioData>(emptyData);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [operation, setOperation] = useState<OperationDraft>(() => ({
    symbol: 'BTC',
    type: 'buy',
    quantity: '',
    unitPriceUsd: '',
    currency: 'USD',
    operationDate: todayKey(),
    notes: '',
  }));
  const [alert, setAlert] = useState<AlertDraft>({
    symbol: 'BTC',
    condition: 'below',
    targetPriceUsd: '',
    notes: '',
  });

  const load = useCallback(async (refresh = false) => {
    if (!authToken) return;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (chatId) params.set('chat_id', chatId);
      params.set('symbols', defaultSymbols.join(','));
      if (refresh) params.set('refresh', '1');
      const response = await fetch(`${apiEndpoint('crypto')}?${params.toString()}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const result = await response.json() as CryptoPortfolioData;
      if (!response.ok || result.ok === false) throw new Error(result.error || 'No se pudo cargar cripto');
      setData({
        ...emptyData,
        ...result,
        summary: { ...emptyData.summary, ...(result.summary || {}) },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar cripto');
    } finally {
      setLoading(false);
    }
  }, [authToken, chatId]);

  useEffect(() => {
    void load();
  }, [load]);

  const priceBySymbol = useMemo(() => {
    return Object.fromEntries(data.prices.map((item) => [item.symbol, item]));
  }, [data.prices]);

  const selectedPrice = priceBySymbol[operation.symbol.toUpperCase()];
  const gainTone = data.summary.gainPen >= 0 ? 'good' : 'bad';
  const binanceValuePen = data.binance?.summary?.totalValuePen || data.summary.binanceValuePen || 0;
  const totalCryptoValuePen = data.summary.totalCryptoValuePen ?? (data.summary.totalValuePen + binanceValuePen);

  const saveOperation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!authToken) return;
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const payload = {
        chat_id: chatId,
        symbol: operation.symbol,
        type: operation.type,
        quantity: Number(operation.quantity || 0),
        unitPriceUsd: Number(operation.unitPriceUsd || 0),
        currency: operation.currency,
        operationDate: operation.operationDate,
        notes: operation.notes,
        exchangeRate,
      };
      const response = await fetch(apiEndpoint('crypto/operations'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const result = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || result.ok === false) throw new Error(result.error || 'No se pudo guardar operacion');
      setMessage(operation.type === 'buy' ? 'Compra cripto registrada.' : 'Venta cripto registrada.');
      setOperation((current) => ({
        ...current,
        quantity: '',
        notes: '',
      }));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar operacion');
    } finally {
      setSaving(false);
    }
  };

  const saveAlert = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!authToken) return;
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const response = await fetch(apiEndpoint('crypto/alerts'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          symbol: alert.symbol,
          condition: alert.condition,
          targetPriceUsd: Number(alert.targetPriceUsd || 0),
          notes: alert.notes,
        }),
      });
      const result = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || result.ok === false) throw new Error(result.error || 'No se pudo guardar alerta');
      setMessage('Alerta cripto creada.');
      setAlert((current) => ({ ...current, targetPriceUsd: '', notes: '' }));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar alerta');
    } finally {
      setSaving(false);
    }
  };

  const removeOperation = async (item: CryptoOperation) => {
    if (!authToken) return;
    const ok = window.confirm(`Eliminar operacion ${item.symbol}?`);
    if (!ok) return;
    await removeItem(`crypto/operations/${encodeURIComponent(item.id)}`, 'Operacion eliminada.');
  };

  const removeAlert = async (item: CryptoAlert) => {
    if (!authToken) return;
    const ok = window.confirm(`Eliminar alerta ${item.symbol}?`);
    if (!ok) return;
    await removeItem(`crypto/alerts/${encodeURIComponent(item.id)}`, 'Alerta eliminada.');
  };

  const removeItem = async (path: string, okMessage: string) => {
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const params = chatId ? `?chat_id=${encodeURIComponent(chatId)}` : '';
      const response = await fetch(`${apiEndpoint(path)}${params}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const result = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || result.ok === false) throw new Error(result.error || 'No se pudo eliminar');
      setMessage(okMessage);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar');
    } finally {
      setSaving(false);
    }
  };

  const useCurrentPrice = () => {
    if (!selectedPrice?.priceUsd) return;
    setOperation((current) => ({ ...current, unitPriceUsd: String(selectedPrice.priceUsd) }));
  };

  return (
    <section className="grid gap-3 sm:gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Cripto total" value={formatMoney(totalCryptoValuePen)} caption="Manual + Binance" />
        <SummaryCard label="Invertido cripto" value={formatMoney(data.summary.totalInvestedPen)} caption={formatMoney(data.summary.totalInvestedUsd, 'USD')} />
        <SummaryCard label="Resultado cripto" value={`${formatMoney(data.summary.gainPen)} · ${data.summary.gainPct.toFixed(1)}%`} tone={gainTone} caption={formatMoney(data.summary.gainUsd, 'USD')} />
      </div>

      <div className="grid gap-3 sm:gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-4 sm:!p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <Title>Precios cripto</Title>
              <Text>Cache {data.cacheMinutes || 5} min · {loading ? 'Actualizando...' : formatUpdatedAt(data.updatedAt)}</Text>
            </div>
            <button
              type="button"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-tremor-default border border-slate-700 bg-slate-900/70 px-3 text-sm font-semibold text-slate-200 transition hover:bg-slate-800 disabled:opacity-60"
              onClick={() => void load(true)}
              disabled={loading || !authToken}
            >
              <RiRefreshLine className="h-4 w-4" />
              Actualizar
            </button>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {data.prices.map((item) => <PriceTile key={item.symbol} item={item} />)}
          </div>

          <div className="mt-5 grid gap-3">
            {data.suggestions.map((item) => (
              <div key={`${item.title}-${item.message}`} className="rounded-tremor-default border border-slate-800 bg-slate-900/40 p-3">
                <div className="flex items-center justify-between gap-3">
                  <Text className="font-semibold text-slate-100">{item.title}</Text>
                  <Badge color={suggestionColor(item.level)}>{item.level}</Badge>
                </div>
                <Text className="mt-1 text-xs">{item.message}</Text>
              </div>
            ))}
          </div>
        </Card>

        <div className="grid gap-3 sm:gap-4">
          <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-4 sm:!p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Title>Saldo Binance</Title>
                <Text>{data.binance?.configured ? `${data.binance.summary.assets} activos detectados` : 'Configura secrets para leer tu cuenta'}</Text>
              </div>
              <Badge color={data.binance?.configured ? (data.binance.error ? 'rose' : 'emerald') : 'slate'}>
                {data.binance?.configured ? (data.binance.error ? 'Error' : 'Conectado') : 'Sin secrets'}
              </Badge>
            </div>

            <div className="mt-4 grid gap-3">
              <div className="rounded-tremor-default border border-slate-800 bg-slate-900/40 p-3">
                <Text>Total en Binance</Text>
                <div className="mt-2 text-xl font-semibold text-slate-100">{formatMoney(data.binance?.summary?.totalValuePen || 0)}</div>
                <Text className="mt-1 text-xs">{formatMoney(data.binance?.summary?.totalValueUsd || 0, 'USD')}</Text>
              </div>

              {data.binance?.error ? (
                <div className="rounded-tremor-default border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-100">
                  {data.binance.error}
                </div>
              ) : null}

              {!data.binance?.configured ? (
                <div className="rounded-tremor-default border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">
                  Agrega `BINANCE_API_KEY` y `BINANCE_API_SECRET` como secrets del Worker.
                </div>
              ) : null}

              {data.binance?.balances?.length ? data.binance.balances.slice(0, 8).map((item) => (
                <div key={item.asset} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-tremor-default border border-slate-800 bg-slate-900/40 p-3">
                  <div>
                    <Text className="font-semibold text-slate-100">{item.asset}</Text>
                    <Text className="text-xs">{item.total.toLocaleString('es-PE', { maximumFractionDigits: 8 })} unidades</Text>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-slate-100">{formatMoney(item.valuePen)}</div>
                    <Text className="text-xs">{formatMoney(item.valueUsd, 'USD')}</Text>
                  </div>
                </div>
              )) : null}
            </div>
          </Card>

          <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-4 sm:!p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Title>Cartera cripto</Title>
                <Text>{data.positions.length} posiciones · precios en USD y PEN</Text>
              </div>
              <Badge color={data.summary.gainPen >= 0 ? 'emerald' : 'rose'}>
                {data.summary.gainPen >= 0 ? 'Ganando' : 'Perdiendo'}
              </Badge>
            </div>

            <div className="mt-5 grid gap-3">
              {data.positions.length ? data.positions.map((item) => <PositionRow key={item.symbol} item={item} />) : (
                <EmptyState>Aun no tienes posiciones cripto registradas.</EmptyState>
              )}
            </div>
          </Card>

          <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-4 sm:!p-6">
            <Title>Registrar compra / venta</Title>
            <Text>Guarda tus operaciones; la cartera se calcula sola.</Text>
            <form className="mt-5 grid gap-3" onSubmit={saveOperation}>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Simbolo">
                  <input className="form-input uppercase" list="crypto-symbols" value={operation.symbol} onChange={(event) => setOperation((current) => ({ ...current, symbol: event.target.value.toUpperCase() }))} required />
                </Field>
                <Field label="Operacion">
                  <select className="form-input" value={operation.type} onChange={(event) => setOperation((current) => ({ ...current, type: event.target.value as 'buy' | 'sell' }))}>
                    <option value="buy">Compra</option>
                    <option value="sell">Venta</option>
                  </select>
                </Field>
                <Field label="Fecha">
                  <input className="form-input" type="date" value={operation.operationDate} onChange={(event) => setOperation((current) => ({ ...current, operationDate: event.target.value }))} required />
                </Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Cantidad">
                  <input className="form-input" type="number" min="0" step="0.00000001" value={operation.quantity} onChange={(event) => setOperation((current) => ({ ...current, quantity: event.target.value }))} required />
                </Field>
                <Field label="Precio USD">
                  <div className="grid gap-2">
                    <input className="form-input" type="number" min="0" step="0.01" value={operation.unitPriceUsd} onChange={(event) => setOperation((current) => ({ ...current, unitPriceUsd: event.target.value }))} required />
                    <button type="button" className="inline-flex h-8 items-center justify-center rounded-tremor-default border border-slate-700 bg-slate-900/70 px-2 text-xs font-semibold text-slate-200 disabled:opacity-50" onClick={useCurrentPrice} disabled={!selectedPrice?.priceUsd}>
                      Usar actual
                    </button>
                  </div>
                </Field>
                <Field label="Moneda pagada">
                  <select className="form-input" value={operation.currency} onChange={(event) => setOperation((current) => ({ ...current, currency: event.target.value as 'USD' | 'PEN' }))}>
                    <option value="USD">USD</option>
                    <option value="PEN">PEN</option>
                  </select>
                </Field>
              </div>
              <Field label="Notas">
                <input className="form-input" value={operation.notes} onChange={(event) => setOperation((current) => ({ ...current, notes: event.target.value }))} placeholder="exchange, wallet, razon de compra..." />
              </Field>
              <button className="inline-flex h-10 items-center justify-center gap-2 rounded-tremor-default bg-emerald-500 px-4 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-60" disabled={saving || !authToken}>
                <RiAddLine className="h-4 w-4" />
                Registrar operacion
              </button>
            </form>
          </Card>
        </div>
      </div>

      <div className="grid gap-3 sm:gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-4 sm:!p-6">
          <Title>Historial cripto</Title>
          <Text>{data.operations.length} operaciones registradas</Text>
          <div className="mt-5 grid gap-3">
            {data.operations.length ? data.operations.slice().reverse().map((item) => (
              <OperationRow key={item.id} item={item} onDelete={removeOperation} />
            )) : <EmptyState>Sin operaciones cripto.</EmptyState>}
          </div>
        </Card>

        <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-4 sm:!p-6">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-tremor-default bg-amber-500/15 text-amber-200">
              <RiNotification3Line className="h-5 w-5" />
            </div>
            <div>
              <Title>Alertas de precio</Title>
              <Text>Define precios de compra o salida.</Text>
            </div>
          </div>

          <form className="mt-5 grid gap-3" onSubmit={saveAlert}>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Simbolo">
                <input className="form-input uppercase" list="crypto-symbols" value={alert.symbol} onChange={(event) => setAlert((current) => ({ ...current, symbol: event.target.value.toUpperCase() }))} required />
              </Field>
              <Field label="Cuando">
                <select className="form-input" value={alert.condition} onChange={(event) => setAlert((current) => ({ ...current, condition: event.target.value as 'below' | 'above' }))}>
                  <option value="below">Baje a</option>
                  <option value="above">Suba a</option>
                </select>
              </Field>
              <Field label="Precio USD">
                <input className="form-input" type="number" min="0" step="0.01" value={alert.targetPriceUsd} onChange={(event) => setAlert((current) => ({ ...current, targetPriceUsd: event.target.value }))} required />
              </Field>
            </div>
            <Field label="Notas">
              <input className="form-input" value={alert.notes} onChange={(event) => setAlert((current) => ({ ...current, notes: event.target.value }))} />
            </Field>
            <button className="inline-flex h-10 items-center justify-center gap-2 rounded-tremor-default border border-amber-400/40 bg-amber-400/10 px-4 text-sm font-semibold text-amber-100 transition hover:bg-amber-400/15 disabled:opacity-60" disabled={saving || !authToken}>
              <RiAddLine className="h-4 w-4" />
              Crear alerta
            </button>
          </form>

          <div className="mt-5 grid gap-3">
            {data.alerts.length ? data.alerts.map((item) => <AlertRow key={item.id} item={item} onDelete={removeAlert} />) : (
              <EmptyState>Sin alertas cripto.</EmptyState>
            )}
          </div>
        </Card>
      </div>

      {message ? <div className="rounded-tremor-default border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-100">{message}</div> : null}
      {error ? <div className="rounded-tremor-default border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-100">{error}</div> : null}
      <datalist id="crypto-symbols">
        {defaultSymbols.map((symbol) => <option key={symbol} value={symbol} />)}
      </datalist>
    </section>
  );
}

function SummaryCard({ label, value, caption, tone = 'neutral' }: { label: string; value: string; caption?: string; tone?: 'neutral' | 'good' | 'bad' }) {
  const color = tone === 'good' ? 'text-emerald-300' : tone === 'bad' ? 'text-rose-300' : 'text-slate-100';
  return (
    <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-4">
      <Text>{label}</Text>
      <div className={`mt-2 text-xl font-semibold ${color}`}>{value}</div>
      {caption ? <Text className="mt-1 text-xs">{caption}</Text> : null}
    </Card>
  );
}

function PriceTile({ item }: { item: CryptoPrice }) {
  const positive = item.change24h >= 0;
  return (
    <div className="rounded-tremor-default border border-slate-800 bg-slate-900/40 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Text className="font-semibold text-slate-100">{item.symbol}</Text>
          <Text className="text-xs">{item.name}</Text>
        </div>
        <Badge color={positive ? 'emerald' : 'rose'}>{positive ? '+' : ''}{item.change24h.toFixed(2)}%</Badge>
      </div>
      <div className="mt-3 text-lg font-semibold text-slate-100">{formatMoney(item.priceUsd, 'USD')}</div>
      <Text className="mt-1 text-[0.68rem]">Fuente: {item.source || 'cache'}</Text>
    </div>
  );
}

function PositionRow({ item }: { item: CryptoPosition }) {
  const positive = item.gainPen >= 0;
  return (
    <div className="rounded-tremor-default border border-slate-800 bg-slate-900/40 p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Text className="font-semibold text-slate-100">{item.symbol}</Text>
            <Badge color={positive ? 'emerald' : 'rose'}>{positive ? 'Ganancia' : 'Perdida'}</Badge>
          </div>
          <Text className="mt-1 text-xs">{item.quantity.toLocaleString('es-PE', { maximumFractionDigits: 8 })} unidades</Text>
        </div>
        <div className="text-left sm:text-right">
          <div className="text-sm font-semibold text-slate-100">{formatMoney(item.currentValuePen)}</div>
          <Text className="text-xs">{formatMoney(item.currentValueUsd, 'USD')}</Text>
        </div>
      </div>
      <div className="mt-3 grid gap-2 text-xs text-slate-400 sm:grid-cols-3">
        <span>Precio: <b className="text-slate-100">{formatMoney(item.currentPriceUsd, 'USD')}</b></span>
        <span>Invertido: <b className="text-slate-100">{formatMoney(item.investedUsd, 'USD')}</b></span>
        <span>Resultado: <b className={positive ? 'text-emerald-300' : 'text-rose-300'}>{formatMoney(item.gainPen)} · {item.gainPct.toFixed(1)}%</b></span>
      </div>
    </div>
  );
}

function OperationRow({ item, onDelete }: { item: CryptoOperation; onDelete: (item: CryptoOperation) => void }) {
  return (
    <div className="grid gap-3 rounded-tremor-default border border-slate-800 bg-slate-900/40 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Badge color={item.type === 'sell' ? 'rose' : 'emerald'}>{item.type === 'sell' ? 'Venta' : 'Compra'}</Badge>
          <Text className="font-semibold text-slate-100">{item.symbol}</Text>
          <Text className="text-xs">{item.operationDate}</Text>
        </div>
        <Text className="mt-1 text-xs">
          {item.quantity.toLocaleString('es-PE', { maximumFractionDigits: 8 })} · {formatMoney(item.unitPriceUsd, 'USD')} · pagado {formatMoney(item.totalAmount, item.currency)}
        </Text>
        {item.notes ? <Text className="mt-1 text-xs">{item.notes}</Text> : null}
      </div>
      <button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-tremor-default border border-rose-500/30 bg-rose-500/10 text-rose-200" onClick={() => onDelete(item)} title="Eliminar">
        <RiDeleteBinLine className="h-4 w-4" />
      </button>
    </div>
  );
}

function AlertRow({ item, onDelete }: { item: CryptoAlert; onDelete: (item: CryptoAlert) => void }) {
  return (
    <div className="grid gap-3 rounded-tremor-default border border-slate-800 bg-slate-900/40 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <Text className="font-semibold text-slate-100">{item.symbol}</Text>
          <Badge color={item.triggered ? 'amber' : 'slate'}>{item.condition === 'above' ? 'Suba a' : 'Baje a'}</Badge>
          {item.triggered ? <Badge color="amber">Activa</Badge> : null}
        </div>
        <Text className="mt-1 text-xs">Objetivo {formatMoney(item.targetPriceUsd, 'USD')} · actual {formatMoney(item.currentPriceUsd || 0, 'USD')}</Text>
        {item.notes ? <Text className="mt-1 text-xs">{item.notes}</Text> : null}
      </div>
      <button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-tremor-default border border-rose-500/30 bg-rose-500/10 text-rose-200" onClick={() => onDelete(item)} title="Eliminar">
        <RiDeleteBinLine className="h-4 w-4" />
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1 text-xs font-semibold text-slate-400">
      <span>{label}</span>
      {children}
    </label>
  );
}

function suggestionColor(level: string) {
  if (level === 'success') return 'emerald';
  if (level === 'warning') return 'amber';
  if (level === 'danger') return 'rose';
  return 'cyan';
}

function todayKey() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}
