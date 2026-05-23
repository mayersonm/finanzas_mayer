import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Card, ProgressBar, Text, Title, type Color } from '@tremor/react';
import { RiRefreshLine, RiSave3Line } from '@remixicon/react';
import { apiEndpoint } from '../../app/api';
import { EmptyState } from '../../components/common/EmptyState';
import { formatMoney, formatUpdatedAt } from '../../lib/formatters';
import type { NetWorthData, NetWorthInsight } from '../../types/dashboard';

const emptyNetWorth: NetWorthData = {
  currency: 'PEN',
  exchangeRate: 3.85,
  assets: { cash: 0, investments: 0, goals: 0, total: 0 },
  liabilities: { debts: 0, fixedExpenses: 0, total: 0 },
  netWorth: 0,
  investmentGain: 0,
  ratios: { debtToAssetsPct: 0, investmentSharePct: 0, liquiditySharePct: 0 },
  composition: [],
  insights: [],
  snapshots: [],
};

export function NetWorthSection({
  authToken,
  chatId,
}: {
  authToken?: string | null;
  chatId?: string;
}) {
  const [data, setData] = useState<NetWorthData>(emptyNetWorth);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!authToken) return;
    setLoading(true);
    setError('');
    try {
      const url = `${apiEndpoint('net-worth')}${chatId ? `?chat_id=${encodeURIComponent(chatId)}` : ''}`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const result = await response.json() as NetWorthData;
      if (!response.ok || result.ok === false) throw new Error(result.error || 'No se pudo cargar patrimonio');
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar patrimonio');
    } finally {
      setLoading(false);
    }
  }, [authToken, chatId]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveSnapshot = async () => {
    if (!authToken) return;
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const url = `${apiEndpoint('net-worth/snapshot')}${chatId ? `?chat_id=${encodeURIComponent(chatId)}` : ''}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const result = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || result.ok === false) throw new Error(result.error || 'No se pudo guardar el corte');
      setMessage('Corte de patrimonio guardado.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el corte');
    } finally {
      setSaving(false);
    }
  };

  const positive = data.netWorth >= 0;
  const maxComposition = useMemo(() => Math.max(...data.composition.map((item) => Math.abs(item.value)), 1), [data.composition]);

  return (
    <section className="grid gap-3 sm:gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Title>Patrimonio</Title>
          <Text>Activos, deudas, fijos pendientes y valor neto en soles.</Text>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-tremor-default border border-slate-700 bg-slate-900/70 px-3 text-sm font-semibold text-slate-200 transition hover:bg-slate-800 disabled:opacity-60"
            disabled={loading}
            onClick={() => void load()}
          >
            <RiRefreshLine className="h-4 w-4" />
            Actualizar
          </button>
          <button
            type="button"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-tremor-default bg-emerald-500 px-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-60"
            disabled={saving || loading}
            onClick={() => void saveSnapshot()}
          >
            <RiSave3Line className="h-4 w-4" />
            Guardar corte
          </button>
        </div>
      </div>

      {message ? <div className="rounded-tremor-default border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-100">{message}</div> : null}
      {error ? <div className="rounded-tremor-default border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-100">{error}</div> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard label="Patrimonio neto" value={formatMoney(data.netWorth)} tone={positive ? 'good' : 'bad'} sub="Activos menos deudas y fijos" />
        <MetricCard label="Activos" value={formatMoney(data.assets.total)} sub={`${data.ratios.liquiditySharePct.toFixed(1)}% liquidez`} />
        <MetricCard label="Pasivos" value={formatMoney(data.liabilities.total)} tone={data.liabilities.total > 0 ? 'bad' : 'good'} sub={`${data.ratios.debtToAssetsPct.toFixed(1)}% de activos`} />
        <MetricCard label="Fijos pendientes" value={formatMoney(data.liabilities.fixedExpenses || 0)} tone={(data.liabilities.fixedExpenses || 0) > 0 ? 'bad' : 'good'} sub="Del mes actual" />
        <MetricCard label="Ganancia inversiones" value={formatMoney(data.investmentGain)} tone={data.investmentGain >= 0 ? 'good' : 'bad'} sub={`USD/PEN ${data.exchangeRate.toFixed(3)}`} />
      </div>

      <div className="grid gap-3 sm:gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-4 sm:!p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Title>Composicion</Title>
              <Text>Activos y pasivos convertidos a PEN.</Text>
            </div>
            <Badge color={positive ? 'emerald' : 'rose'}>{positive ? 'Positivo' : 'Negativo'}</Badge>
          </div>

          <div className="mt-5 grid gap-4">
            {data.composition.map((item) => {
              const isLiability = item.type === 'liability';
              const color: Color = isLiability ? 'rose' : 'emerald';
              const pct = Math.min(100, Math.round((Math.abs(item.value) / maxComposition) * 100));
              return (
                <div key={`${item.type}-${item.label}`} className="grid gap-2">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-semibold text-slate-200">{item.label}</span>
                    <span className={isLiability ? 'text-rose-200' : 'text-emerald-200'}>{formatMoney(item.value)}</span>
                  </div>
                  <ProgressBar value={pct} color={color} />
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-4 sm:!p-6">
          <Title>Lectura rapida</Title>
          <Text>Senales patrimoniales calculadas con tus datos.</Text>
          <div className="mt-5 grid gap-3">
            {data.insights.length ? data.insights.map((item) => <InsightItem key={item.title} item={item} />) : <EmptyState>Sin alertas patrimoniales.</EmptyState>}
          </div>
        </Card>
      </div>

      <div className="grid gap-3 sm:gap-4 lg:grid-cols-3">
        <BreakdownCard title="Activos" rows={[
          ['Efectivo', data.assets.cash],
          ['Inversiones', data.assets.investments],
          ['Metas', data.assets.goals],
        ]} />
        <BreakdownCard title="Pasivos" rows={[
          ['Deudas', data.liabilities.debts],
          ['Fijos pendientes', data.liabilities.fixedExpenses || 0],
        ]} />
        <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-4 sm:!p-6">
          <Title>Evolucion</Title>
          <Text>{data.snapshots.length ? `${data.snapshots.length} cortes guardados` : 'Sin cortes guardados'}</Text>
          <div className="mt-5 grid gap-2">
            {data.snapshots.length ? data.snapshots.map((snapshot) => (
              <div key={snapshot.id} className="flex items-center justify-between gap-3 rounded-tremor-default border border-slate-800 bg-slate-950/40 p-3 text-sm">
                <span className="text-slate-400">{snapshot.date}</span>
                <span className={snapshot.netWorth >= 0 ? 'font-semibold text-emerald-200' : 'font-semibold text-rose-200'}>{formatMoney(snapshot.netWorth)}</span>
              </div>
            )) : <EmptyState>Guarda un corte para empezar el historial.</EmptyState>}
          </div>
        </Card>
      </div>

      <Text className="text-xs text-slate-500">Actualizado: {formatUpdatedAt(data.updatedAt)} · Fuente tipo de cambio: {data.exchangeRateSource || 'cache'}</Text>
    </section>
  );
}

function MetricCard({ label, value, sub, tone = 'neutral' }: { label: string; value: string; sub?: string; tone?: 'neutral' | 'good' | 'bad' }) {
  const color = tone === 'good' ? 'text-emerald-300' : tone === 'bad' ? 'text-rose-300' : 'text-slate-100';
  return (
    <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-4">
      <Text>{label}</Text>
      <div className={`mt-2 text-2xl font-semibold ${color}`}>{value}</div>
      {sub ? <Text className="mt-1 text-xs">{sub}</Text> : null}
    </Card>
  );
}

function BreakdownCard({ title, rows }: { title: string; rows: Array<[string, number]> }) {
  const total = rows.reduce((sum, [, value]) => sum + value, 0);
  return (
    <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-4 sm:!p-6">
      <Title>{title}</Title>
      <div className="mt-5 grid gap-3">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-3 text-sm">
            <span className="text-slate-400">{label}</span>
            <span className="font-semibold text-slate-100">{formatMoney(value)}</span>
          </div>
        ))}
        <div className="border-t border-slate-800 pt-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="font-semibold text-slate-200">Total</span>
            <span className="font-semibold text-slate-100">{formatMoney(total)}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}

function InsightItem({ item }: { item: NetWorthInsight }) {
  const color = item.level === 'danger' ? 'rose' : item.level === 'warning' ? 'amber' : item.level === 'success' ? 'emerald' : 'sky';
  return (
    <div className="rounded-tremor-default border border-slate-800 bg-slate-950/40 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-slate-100">{item.title}</div>
          <Text className="mt-1 text-sm">{item.message}</Text>
        </div>
        <Badge color={color}>{item.level}</Badge>
      </div>
    </div>
  );
}
