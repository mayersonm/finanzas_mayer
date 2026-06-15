import { useCallback, useEffect, useMemo, useState, type Dispatch, type FormEvent, type ReactNode, type SetStateAction } from 'react';
import { Badge, Card, Text, Title } from '@tremor/react';
import { RiAddLine, RiDeleteBinLine, RiNotification3Line, RiRefreshLine } from '@remixicon/react';
import { apiEndpoint } from '../../app/api';
import { EmptyState } from '../../components/common/EmptyState';
import { formatMoney, formatUpdatedAt } from '../../lib/formatters';
import type {
  CryptoAlert,
  CryptoOperation,
  CryptoPortfolioData,
  CryptoPosition,
  CryptoPrice,
  TradingAnalysisItem,
  TradingBotData,
  TradingPaperOrder,
  TradingScalperRun,
  TradingSignal,
  TradingStrategy,
} from '../../types/dashboard';

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

interface TradingStrategyDraft {
  mode: 'off' | 'paper' | 'confirm';
  symbols: string;
  allocationUsd: string;
  buyDropPct: string;
  takeProfitPct: string;
  stopLossPct: string;
  maxTradesPerDay: string;
  cooldownMinutes: string;
  scalperTicks: string;
  scalperTakeProfitPct: string;
  scalperStopLossPct: string;
  scalperFeePct: string;
  scalperSpreadPct: string;
  scalperMaxRoundTrips: string;
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
  suggestions: [],
};

const defaultSymbols = ['BTC', 'ETH', 'SOL', 'USDT', 'USDC', 'XRP', 'ADA'];

const defaultTradingStrategy: TradingStrategy = {
  id: '',
  name: 'Bot cripto seguro',
  mode: 'paper',
  symbols: ['BTC', 'ETH', 'SOL'],
  baseCurrency: 'USDT',
  allocationUsd: 10,
  maxDailyLossUsd: 5,
  maxTradesPerDay: 2,
  buyDropPct: 3,
  takeProfitPct: 3,
  stopLossPct: 1.5,
  trailingStopPct: 1.2,
  rsiBuyBelow: 35,
  cooldownMinutes: 240,
  scalperTicks: 12,
  scalperTakeProfitPct: 0.6,
  scalperStopLossPct: 0.4,
  scalperFeePct: 0.1,
  scalperSpreadPct: 0.05,
  scalperMaxRoundTrips: 6,
  active: true,
  notes: '',
};

const emptyTradingData: TradingBotData = {
  strategy: defaultTradingStrategy,
  summary: {
    signals: 0,
    openOrders: 0,
    closedOrders: 0,
    openExposureUsd: 0,
    realizedPnlUsd: 0,
    winRatePct: 0,
    pendingApproval: 0,
  },
  signals: [],
  orders: [],
  scalperRuns: [],
  analysis: [],
  safety: [],
};

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
  const [trading, setTrading] = useState<TradingBotData>(emptyTradingData);
  const [tradingDraft, setTradingDraft] = useState<TradingStrategyDraft>(() => strategyDraft(defaultTradingStrategy));
  const [tradingLoading, setTradingLoading] = useState(false);
  const [tradingSaving, setTradingSaving] = useState(false);
  const [lastAnalysis, setLastAnalysis] = useState<TradingAnalysisItem[]>([]);

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

  const loadTrading = useCallback(async () => {
    if (!authToken) return;
    setTradingLoading(true);
    try {
      const params = new URLSearchParams();
      if (chatId) params.set('chat_id', chatId);
      const response = await fetch(`${apiEndpoint('trading')}?${params.toString()}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const result = await response.json() as TradingBotData;
      if (!response.ok || result.ok === false) throw new Error(result.error || 'No se pudo cargar bot trader');
      setTrading(mergeTradingData(result));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar bot trader');
    } finally {
      setTradingLoading(false);
    }
  }, [authToken, chatId]);

  useEffect(() => {
    void loadTrading();
  }, [loadTrading]);

  useEffect(() => {
    setTradingDraft(strategyDraft(trading.strategy || defaultTradingStrategy));
  }, [trading.strategy]);

  const priceBySymbol = useMemo(() => {
    return Object.fromEntries(data.prices.map((item) => [item.symbol, item]));
  }, [data.prices]);

  const selectedPrice = priceBySymbol[operation.symbol.toUpperCase()];
  const gainTone = data.summary.gainPen >= 0 ? 'good' : 'bad';
  const totalCryptoValuePen = data.summary.totalCryptoValuePen ?? data.summary.totalValuePen;

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

  const saveTradingStrategy = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!authToken) return;
    setTradingSaving(true);
    setMessage('');
    setError('');
    try {
      const params = chatId ? `?chat_id=${encodeURIComponent(chatId)}` : '';
      const response = await fetch(`${apiEndpoint('trading/strategy')}${params}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mode: tradingDraft.mode,
          symbols: tradingDraft.symbols,
          allocationUsd: Number(tradingDraft.allocationUsd || 0),
          buyDropPct: Number(tradingDraft.buyDropPct || 0),
          takeProfitPct: Number(tradingDraft.takeProfitPct || 0),
          stopLossPct: Number(tradingDraft.stopLossPct || 0),
          maxTradesPerDay: Number(tradingDraft.maxTradesPerDay || 0),
          cooldownMinutes: Number(tradingDraft.cooldownMinutes || 0),
          scalperTicks: Number(tradingDraft.scalperTicks || 0),
          scalperTakeProfitPct: Number(tradingDraft.scalperTakeProfitPct || 0),
          scalperStopLossPct: Number(tradingDraft.scalperStopLossPct || 0),
          scalperFeePct: Number(tradingDraft.scalperFeePct || 0),
          scalperSpreadPct: Number(tradingDraft.scalperSpreadPct || 0),
          scalperMaxRoundTrips: Number(tradingDraft.scalperMaxRoundTrips || 0),
        }),
      });
      const result = await response.json() as TradingBotData;
      if (!response.ok || result.ok === false) throw new Error(result.error || 'No se pudo guardar estrategia');
      setTrading(mergeTradingData(result));
      setMessage('Estrategia del bot actualizada.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar estrategia');
    } finally {
      setTradingSaving(false);
    }
  };

  const runTradingAnalysis = async () => {
    if (!authToken) return;
    setTradingSaving(true);
    setMessage('');
    setError('');
    try {
      const params = chatId ? `?chat_id=${encodeURIComponent(chatId)}` : '';
      const response = await fetch(`${apiEndpoint('trading/run')}${params}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh: true }),
      });
      const result = await response.json() as TradingBotData;
      if (!response.ok || result.ok === false) throw new Error(result.error || 'No se pudo analizar trading');
      const merged = mergeTradingData(result);
      setTrading(merged);
      setLastAnalysis(result.analysis || []);
      setMessage(result.message || 'Analisis del bot actualizado.');
      await load(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo analizar trading');
    } finally {
      setTradingSaving(false);
    }
  };

  const runScalperPaper = async () => {
    if (!authToken) return;
    setTradingSaving(true);
    setMessage('');
    setError('');
    try {
      const params = chatId ? `?chat_id=${encodeURIComponent(chatId)}` : '';
      const response = await fetch(`${apiEndpoint('trading/scalper/run')}${params}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          symbols: tradingDraft.symbols,
          ticks: Number(tradingDraft.scalperTicks || 0),
          allocationUsd: Number(tradingDraft.allocationUsd || 0),
          takeProfitPct: Number(tradingDraft.scalperTakeProfitPct || 0),
          stopLossPct: Number(tradingDraft.scalperStopLossPct || 0),
          feePct: Number(tradingDraft.scalperFeePct || 0),
          spreadPct: Number(tradingDraft.scalperSpreadPct || 0),
          maxRoundTrips: Number(tradingDraft.scalperMaxRoundTrips || 0),
        }),
      });
      const result = await response.json() as TradingBotData;
      if (!response.ok || result.ok === false) throw new Error(result.error || 'No se pudo ejecutar scalper paper');
      const merged = mergeTradingData(result);
      setTrading(merged);
      setMessage(result.message || 'Scalper paper ejecutado.');
      await load(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo ejecutar scalper paper');
    } finally {
      setTradingSaving(false);
    }
  };

  const closePaperOrder = async (item: TradingPaperOrder) => {
    if (!authToken) return;
    const ok = window.confirm(`Cerrar paper order ${item.symbol}?`);
    if (!ok) return;
    setTradingSaving(true);
    setMessage('');
    setError('');
    try {
      const params = chatId ? `?chat_id=${encodeURIComponent(chatId)}` : '';
      const response = await fetch(`${apiEndpoint(`trading/orders/${encodeURIComponent(item.id)}/close`)}${params}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: 'Cierre manual desde dashboard' }),
      });
      const result = await response.json() as { ok?: boolean; error?: string; message?: string };
      if (!response.ok || result.ok === false) throw new Error(result.error || 'No se pudo cerrar paper order');
      setMessage(result.message || 'Paper order cerrada.');
      await loadTrading();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cerrar paper order');
    } finally {
      setTradingSaving(false);
    }
  };

  return (
    <section className="grid gap-3 sm:gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Cripto total" value={formatMoney(totalCryptoValuePen)} caption="Cartera manual" />
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
        </div>
      </div>

      <TradingBotPanel
        trading={trading}
        draft={tradingDraft}
        lastAnalysis={lastAnalysis}
        loading={tradingLoading}
        saving={tradingSaving}
        onDraftChange={setTradingDraft}
        onSaveStrategy={saveTradingStrategy}
        onRun={runTradingAnalysis}
        onRunScalper={runScalperPaper}
        onCloseOrder={closePaperOrder}
      />

      <div className="grid gap-3 sm:gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-4 sm:!p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <Title>Operacion cripto</Title>
              <Text>Registro manual para la cartera cripto.</Text>
            </div>
            <Badge color="cyan">Cripto</Badge>
          </div>
          <form className="mt-5 grid gap-3" onSubmit={saveOperation}>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Cripto">
                <input className="form-input uppercase" list="crypto-symbols" value={operation.symbol} onChange={(event) => setOperation((current) => ({ ...current, symbol: event.target.value.toUpperCase() }))} required />
              </Field>
              <Field label="Tipo">
                <select className="form-input" value={operation.type} onChange={(event) => setOperation((current) => ({ ...current, type: event.target.value as 'buy' | 'sell' }))}>
                  <option value="buy">Compra</option>
                  <option value="sell">Venta</option>
                </select>
              </Field>
              <Field label="Fecha operacion">
                <input className="form-input" type="date" value={operation.operationDate} onChange={(event) => setOperation((current) => ({ ...current, operationDate: event.target.value }))} required />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Unidades">
                <input className="form-input" type="number" min="0" step="0.00000001" value={operation.quantity} onChange={(event) => setOperation((current) => ({ ...current, quantity: event.target.value }))} required />
              </Field>
              <Field label="Precio unitario USD">
                <div className="grid gap-2">
                  <input className="form-input" type="number" min="0" step="0.01" value={operation.unitPriceUsd} onChange={(event) => setOperation((current) => ({ ...current, unitPriceUsd: event.target.value }))} required />
                  <button type="button" className="inline-flex h-8 items-center justify-center rounded-tremor-default border border-slate-700 bg-slate-900/70 px-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-800 disabled:opacity-50" onClick={useCurrentPrice} disabled={!selectedPrice?.priceUsd}>
                    Usar precio actual
                  </button>
                </div>
              </Field>
              <Field label="Moneda usada">
                <select className="form-input" value={operation.currency} onChange={(event) => setOperation((current) => ({ ...current, currency: event.target.value as 'USD' | 'PEN' }))}>
                  <option value="USD">USD</option>
                  <option value="PEN">PEN</option>
                </select>
              </Field>
            </div>
            <Field label="Nota cripto">
              <input className="form-input" value={operation.notes} onChange={(event) => setOperation((current) => ({ ...current, notes: event.target.value }))} placeholder="Wallet, DCA, toma de ganancia..." />
            </Field>
            <button className="inline-flex h-10 items-center justify-center gap-2 rounded-tremor-default bg-emerald-500 px-4 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-60" disabled={saving || !authToken}>
              <RiAddLine className="h-4 w-4" />
              Registrar cripto
            </button>
          </form>
        </Card>

        <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-4 sm:!p-6">
          <Title>Historial de operaciones cripto</Title>
          <Text>{data.operations.length} compras/ventas manuales</Text>
          <div className="mt-5 grid gap-3">
            {data.operations.length ? data.operations.slice().reverse().map((item) => (
              <OperationRow key={item.id} item={item} onDelete={removeOperation} />
            )) : <EmptyState>Sin operaciones cripto.</EmptyState>}
          </div>
        </Card>
      </div>

      <div className="grid gap-3 sm:gap-4">
        <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-4 sm:!p-6">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-tremor-default bg-amber-500/15 text-amber-200">
              <RiNotification3Line className="h-5 w-5" />
            </div>
            <div>
              <Title>Alertas cripto</Title>
              <Text>Precios objetivo para compra o salida.</Text>
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

function TradingBotPanel({
  trading,
  draft,
  lastAnalysis,
  loading,
  saving,
  onDraftChange,
  onSaveStrategy,
  onRun,
  onRunScalper,
  onCloseOrder,
}: {
  trading: TradingBotData;
  draft: TradingStrategyDraft;
  lastAnalysis: TradingAnalysisItem[];
  loading: boolean;
  saving: boolean;
  onDraftChange: Dispatch<SetStateAction<TradingStrategyDraft>>;
  onSaveStrategy: (event: FormEvent<HTMLFormElement>) => void;
  onRun: () => void;
  onRunScalper: () => void;
  onCloseOrder: (item: TradingPaperOrder) => void;
}) {
  const strategy = trading.strategy || defaultTradingStrategy;
  const analysis = lastAnalysis.length ? lastAnalysis : trading.analysis || [];
  const openOrders = (trading.orders || []).filter((item) => item.status === 'open');
  const recentSignals = (trading.signals || []).slice(0, 5);
  const latestScalper = trading.scalper || trading.scalperRuns?.[0] || null;

  return (
    <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-4 sm:!p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Title>Bot Trader</Title>
            <Badge color={strategy.mode === 'off' ? 'slate' : strategy.mode === 'paper' ? 'cyan' : 'amber'}>
              {tradingModeLabel(strategy.mode)}
            </Badge>
          </div>
          <Text>Senales con datos reales, operaciones simuladas y aprobacion manual.</Text>
        </div>
        <button
          type="button"
          className="inline-flex h-10 items-center justify-center gap-2 rounded-tremor-default bg-emerald-500 px-4 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-60"
          onClick={onRun}
          disabled={saving || loading}
        >
          <RiRefreshLine className="h-4 w-4" />
          Analizar ahora
        </button>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <BotMetric label="Exposicion paper" value={formatMoney(trading.summary.openExposureUsd, 'USD')} sub={`${trading.summary.openOrders} abiertas`} />
        <BotMetric label="PnL paper" value={formatMoney(trading.summary.realizedPnlUsd, 'USD')} sub={`${trading.summary.winRatePct.toFixed(0)}% win rate`} tone={trading.summary.realizedPnlUsd >= 0 ? 'emerald' : 'rose'} />
        <BotMetric label="Riesgo por entrada" value={formatMoney(strategy.allocationUsd, 'USD')} sub={`${strategy.maxTradesPerDay} trades/dia`} />
        <BotMetric label="Regla compra" value={`-${strategy.buyDropPct.toFixed(1)}%`} sub={`TP ${strategy.takeProfitPct}% · SL ${strategy.stopLossPct}%`} />
      </div>

      <form className="mt-5 grid gap-3" onSubmit={onSaveStrategy}>
        <div className="grid gap-3 md:grid-cols-4">
          <Field label="Modo">
            <select className="form-input" value={draft.mode} onChange={(event) => onDraftChange((current) => ({ ...current, mode: event.target.value as TradingStrategyDraft['mode'] }))}>
              <option value="off">Apagado</option>
              <option value="paper">Paper trading</option>
              <option value="confirm">Confirmacion</option>
            </select>
          </Field>
          <Field label="Monedas">
            <input className="form-input uppercase" value={draft.symbols} onChange={(event) => onDraftChange((current) => ({ ...current, symbols: event.target.value.toUpperCase() }))} />
          </Field>
          <Field label="Monto por entrada USD">
            <input className="form-input" type="number" min="1" step="1" value={draft.allocationUsd} onChange={(event) => onDraftChange((current) => ({ ...current, allocationUsd: event.target.value }))} />
          </Field>
          <Field label="Trades por dia">
            <input className="form-input" type="number" min="1" step="1" value={draft.maxTradesPerDay} onChange={(event) => onDraftChange((current) => ({ ...current, maxTradesPerDay: event.target.value }))} />
          </Field>
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          <Field label="Compra si baja %">
            <input className="form-input" type="number" min="0.5" step="0.1" value={draft.buyDropPct} onChange={(event) => onDraftChange((current) => ({ ...current, buyDropPct: event.target.value }))} />
          </Field>
          <Field label="Take profit %">
            <input className="form-input" type="number" min="0.5" step="0.1" value={draft.takeProfitPct} onChange={(event) => onDraftChange((current) => ({ ...current, takeProfitPct: event.target.value }))} />
          </Field>
          <Field label="Stop loss %">
            <input className="form-input" type="number" min="0.5" step="0.1" value={draft.stopLossPct} onChange={(event) => onDraftChange((current) => ({ ...current, stopLossPct: event.target.value }))} />
          </Field>
          <Field label="Cooldown min">
            <input className="form-input" type="number" min="15" step="15" value={draft.cooldownMinutes} onChange={(event) => onDraftChange((current) => ({ ...current, cooldownMinutes: event.target.value }))} />
          </Field>
        </div>
        <div className="grid gap-3 md:grid-cols-6">
          <Field label="Ticks scalper">
            <input className="form-input" type="number" min="3" step="1" value={draft.scalperTicks} onChange={(event) => onDraftChange((current) => ({ ...current, scalperTicks: event.target.value }))} />
          </Field>
          <Field label="Cierres max">
            <input className="form-input" type="number" min="1" step="1" value={draft.scalperMaxRoundTrips} onChange={(event) => onDraftChange((current) => ({ ...current, scalperMaxRoundTrips: event.target.value }))} />
          </Field>
          <Field label="Scalp TP %">
            <input className="form-input" type="number" min="0.05" step="0.05" value={draft.scalperTakeProfitPct} onChange={(event) => onDraftChange((current) => ({ ...current, scalperTakeProfitPct: event.target.value }))} />
          </Field>
          <Field label="Scalp SL %">
            <input className="form-input" type="number" min="0.05" step="0.05" value={draft.scalperStopLossPct} onChange={(event) => onDraftChange((current) => ({ ...current, scalperStopLossPct: event.target.value }))} />
          </Field>
          <Field label="Fee %">
            <input className="form-input" type="number" min="0" step="0.01" value={draft.scalperFeePct} onChange={(event) => onDraftChange((current) => ({ ...current, scalperFeePct: event.target.value }))} />
          </Field>
          <Field label="Spread %">
            <input className="form-input" type="number" min="0" step="0.01" value={draft.scalperSpreadPct} onChange={(event) => onDraftChange((current) => ({ ...current, scalperSpreadPct: event.target.value }))} />
          </Field>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Text className="text-xs">
            Seguridad: no ejecuta orden real en ningun exchange. Paper abre/cierra simulaciones; confirmacion deja senales pendientes.
          </Text>
          <div className="grid gap-2 sm:grid-cols-2">
            <button type="button" className="inline-flex h-10 items-center justify-center rounded-tremor-default border border-cyan-400/40 bg-cyan-400/10 px-4 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/15 disabled:opacity-60" disabled={saving || loading} onClick={onRunScalper}>
              Ejecutar scalper
            </button>
            <button className="inline-flex h-10 items-center justify-center rounded-tremor-default border border-slate-700 bg-slate-900/70 px-4 text-sm font-semibold text-slate-200 transition hover:bg-slate-800 disabled:opacity-60" disabled={saving || loading}>
              Guardar estrategia
            </button>
          </div>
        </div>
      </form>

      <ScalperRunPanel run={latestScalper} />

      <div className="mt-5 grid gap-3 xl:grid-cols-[1fr_1fr]">
        <div className="rounded-tremor-default border border-slate-800 bg-slate-900/35 p-3">
          <div className="flex items-center justify-between gap-3">
            <Text className="font-semibold text-slate-100">Ultimo analisis</Text>
            {loading ? <Badge color="slate">Cargando</Badge> : null}
          </div>
          <div className="mt-3 grid gap-2">
            {analysis.length ? analysis.map((item) => <TradingAnalysisRow key={item.symbol} item={item} />) : (
              <EmptyState>Ejecuta un analisis para ver oportunidades.</EmptyState>
            )}
          </div>
        </div>

        <div className="rounded-tremor-default border border-slate-800 bg-slate-900/35 p-3">
          <div className="flex items-center justify-between gap-3">
            <Text className="font-semibold text-slate-100">Paper orders y senales</Text>
            {trading.summary.pendingApproval ? <Badge color="amber">{trading.summary.pendingApproval} pendientes</Badge> : null}
          </div>
          <div className="mt-3 grid gap-2">
            {openOrders.length ? openOrders.map((item) => (
              <TradingOrderRow key={item.id} item={item} onClose={onCloseOrder} />
            )) : recentSignals.length ? recentSignals.map((item) => (
              <TradingSignalRow key={item.id} item={item} />
            )) : (
              <EmptyState>Sin senales todavia.</EmptyState>
            )}
          </div>
        </div>
      </div>

      {trading.safety?.length ? (
        <div className="mt-4 grid gap-2 text-xs text-slate-400">
          {trading.safety.slice(0, 3).map((item) => <p key={item}>{item}</p>)}
        </div>
      ) : null}
    </Card>
  );
}

function BotMetric({ label, value, sub, tone = 'slate' }: { label: string; value: string; sub: string; tone?: 'slate' | 'emerald' | 'rose' }) {
  const text = tone === 'emerald' ? 'text-emerald-300' : tone === 'rose' ? 'text-rose-300' : 'text-slate-100';
  return (
    <div className="rounded-tremor-default border border-slate-800 bg-slate-900/35 p-3">
      <Text>{label}</Text>
      <div className={`mt-2 text-lg font-semibold ${text}`}>{value}</div>
      <Text className="mt-1 text-xs">{sub}</Text>
    </div>
  );
}

function TradingAnalysisRow({ item }: { item: TradingAnalysisItem }) {
  const actionColor = item.action === 'buy' ? 'emerald' : item.action === 'watch' ? 'amber' : 'slate';
  return (
    <div className="rounded-tremor-default border border-slate-800 bg-slate-950/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Text className="font-semibold text-slate-100">{item.symbol}</Text>
          <Badge color={actionColor}>{tradingActionLabel(item.action)}</Badge>
        </div>
        <Text className="font-mono text-xs text-slate-300">{formatMoney(item.priceUsd, 'USD')}</Text>
      </div>
      <Text className="mt-2 text-xs">{item.reason}</Text>
      <div className="mt-2 grid gap-2 text-xs text-slate-400 sm:grid-cols-3">
        <span>24h: <b className={item.change24h < 0 ? 'text-rose-300' : 'text-emerald-300'}>{item.change24h.toFixed(2)}%</b></span>
        <span>Confianza: <b className="text-slate-100">{item.confidence.toFixed(0)}%</b></span>
        <span>Entrada: <b className="text-slate-100">{formatMoney(item.notionalUsd, 'USD')}</b></span>
      </div>
    </div>
  );
}

function TradingOrderRow({ item, onClose }: { item: TradingPaperOrder; onClose: (item: TradingPaperOrder) => void }) {
  return (
    <div className="grid gap-3 rounded-tremor-default border border-slate-800 bg-slate-950/40 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge color="cyan">Paper abierta</Badge>
          <Text className="font-semibold text-slate-100">{item.symbol}</Text>
          <Text className="text-xs">{formatUpdatedAt(item.openedAt)}</Text>
        </div>
        <Text className="mt-1 text-xs">
          {item.quantity.toLocaleString('es-PE', { maximumFractionDigits: 8 })} unidades · entrada {formatMoney(item.priceUsd, 'USD')} · {formatMoney(item.notionalUsd, 'USD')}
        </Text>
      </div>
      <button type="button" className="inline-flex h-9 items-center justify-center rounded-tremor-default border border-slate-700 bg-slate-900/70 px-3 text-xs font-semibold text-slate-200 transition hover:bg-slate-800" onClick={() => onClose(item)}>
        Cerrar paper
      </button>
    </div>
  );
}

function TradingSignalRow({ item }: { item: TradingSignal }) {
  return (
    <div className="rounded-tremor-default border border-slate-800 bg-slate-950/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge color={item.status === 'pending_approval' ? 'amber' : item.side === 'sell' ? 'rose' : 'emerald'}>{tradingStatusLabel(item.status)}</Badge>
          <Text className="font-semibold text-slate-100">{item.symbol}</Text>
        </div>
        <Text className="font-mono text-xs text-slate-300">{formatMoney(item.signalPriceUsd, 'USD')}</Text>
      </div>
      <Text className="mt-2 text-xs">{item.reason}</Text>
    </div>
  );
}

function ScalperRunPanel({ run }: { run: TradingScalperRun | null }) {
  if (!run) {
    return (
      <div className="mt-5 rounded-tremor-default border border-dashed border-slate-800 bg-slate-900/20 p-4">
        <Text className="font-semibold text-slate-100">Scalper paper</Text>
        <Text className="mt-1 text-xs">Ejecuta una rafaga para abrir/cerrar operaciones simuladas por segundos.</Text>
      </div>
    );
  }

  const positive = run.netPnlUsd >= 0;
  return (
    <div className="mt-5 rounded-tremor-default border border-slate-800 bg-slate-900/35 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Text className="font-semibold text-slate-100">Ultima rafaga scalper</Text>
          <Text className="mt-1 text-xs">
            {run.ticks} ticks · {run.closedOrders} cierres · {formatUpdatedAt(run.finishedAt || run.startedAt)}
          </Text>
        </div>
        <Badge color={positive ? 'emerald' : 'rose'}>{positive ? 'Neto positivo' : 'Neto negativo'}</Badge>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <BotMetric label="Neto" value={formatMoney(run.netPnlUsd, 'USD')} sub="despues de fees/spread" tone={positive ? 'emerald' : 'rose'} />
        <BotMetric label="Bruto" value={formatMoney(run.grossPnlUsd, 'USD')} sub="sin comisiones" />
        <BotMetric label="Fees" value={formatMoney(run.feesUsd, 'USD')} sub="entrada + salida" tone="rose" />
        <BotMetric label="Mejor trade" value={formatMoney(run.bestTradeUsd, 'USD')} sub="cierre paper" tone={run.bestTradeUsd >= 0 ? 'emerald' : 'rose'} />
        <BotMetric label="Peor trade" value={formatMoney(run.worstTradeUsd, 'USD')} sub="cierre paper" tone={run.worstTradeUsd >= 0 ? 'emerald' : 'rose'} />
      </div>
    </div>
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

function mergeTradingData(result: TradingBotData): TradingBotData {
  return {
    ...emptyTradingData,
    ...result,
    strategy: {
      ...defaultTradingStrategy,
      ...(result.strategy || {}),
    },
    summary: {
      ...emptyTradingData.summary,
      ...(result.summary || {}),
    },
    signals: result.signals || [],
    orders: result.orders || [],
    scalperRuns: result.scalperRuns || [],
    scalper: result.scalper || null,
    analysis: result.analysis || [],
    safety: result.safety || [],
  };
}

function strategyDraft(strategy: TradingStrategy): TradingStrategyDraft {
  return {
    mode: strategy.mode === 'off' || strategy.mode === 'confirm' ? strategy.mode : 'paper',
    symbols: (strategy.symbols?.length ? strategy.symbols : defaultTradingStrategy.symbols).join(','),
    allocationUsd: String(strategy.allocationUsd || defaultTradingStrategy.allocationUsd),
    buyDropPct: String(strategy.buyDropPct || defaultTradingStrategy.buyDropPct),
    takeProfitPct: String(strategy.takeProfitPct || defaultTradingStrategy.takeProfitPct),
    stopLossPct: String(strategy.stopLossPct || defaultTradingStrategy.stopLossPct),
    maxTradesPerDay: String(strategy.maxTradesPerDay || defaultTradingStrategy.maxTradesPerDay),
    cooldownMinutes: String(strategy.cooldownMinutes || defaultTradingStrategy.cooldownMinutes),
    scalperTicks: String(strategy.scalperTicks || defaultTradingStrategy.scalperTicks),
    scalperTakeProfitPct: String(strategy.scalperTakeProfitPct || defaultTradingStrategy.scalperTakeProfitPct),
    scalperStopLossPct: String(strategy.scalperStopLossPct || defaultTradingStrategy.scalperStopLossPct),
    scalperFeePct: String(strategy.scalperFeePct || defaultTradingStrategy.scalperFeePct),
    scalperSpreadPct: String(strategy.scalperSpreadPct || defaultTradingStrategy.scalperSpreadPct),
    scalperMaxRoundTrips: String(strategy.scalperMaxRoundTrips || defaultTradingStrategy.scalperMaxRoundTrips),
  };
}

function tradingModeLabel(mode: string) {
  if (mode === 'off') return 'Apagado';
  if (mode === 'confirm') return 'Confirmacion';
  return 'Paper';
}

function tradingActionLabel(action: string) {
  if (action === 'buy') return 'Comprar paper';
  if (action === 'watch') return 'Mirar';
  return 'Esperar';
}

function tradingStatusLabel(status: string) {
  if (status === 'paper_open') return 'Paper abierta';
  if (status === 'paper_closed') return 'Paper cerrada';
  if (status === 'pending_approval') return 'Pendiente';
  if (status === 'approved') return 'Aprobada';
  if (status === 'rejected') return 'Rechazada';
  return status;
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
