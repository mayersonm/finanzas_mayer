import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Badge, Card, Text, Title } from '@tremor/react';
import { RiAddLine, RiCloseLine, RiDeleteBinLine, RiEditLine, RiSave3Line } from '@remixicon/react';
import { apiEndpoint } from '../../app/api';
import { EmptyState } from '../../components/common/EmptyState';
import { formatMoney, convertCurrency } from '../../lib/formatters';
import type { Currency, Investment } from '../../types/dashboard';

interface Draft {
  id?: string;
  name: string;
  kind: string;
  amount: string;
  currentValue: string;
  currency: Currency;
  notes: string;
}

const emptyDraft: Draft = {
  name: '',
  kind: 'fondo',
  amount: '',
  currentValue: '',
  currency: 'PEN',
  notes: '',
};

export function InvestmentsSection({
  authToken,
  chatId,
  exchangeRate = 3.85,
}: {
  authToken?: string | null;
  chatId?: string;
  exchangeRate?: number;
}) {
  const [items, setItems] = useState<Investment[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!authToken) return;
    setLoading(true);
    setError('');
    try {
      const url = `${apiEndpoint('investments')}${chatId ? `?chat_id=${encodeURIComponent(chatId)}` : ''}`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const result = await response.json() as { ok?: boolean; investments?: Investment[]; error?: string };
      if (!response.ok || result.ok === false) throw new Error(result.error || 'No se pudieron cargar inversiones');
      setItems(result.investments || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar inversiones');
    } finally {
      setLoading(false);
    }
  }, [authToken, chatId]);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = useMemo(() => {
    return items.reduce((acc, item) => {
      const currency = item.currency || 'PEN';
      const amountPen = currency === 'USD' ? convertCurrency(item.amount, 'USD', 'PEN', exchangeRate) : item.amount;
      const valuePen = currency === 'USD' ? convertCurrency(item.currentValue, 'USD', 'PEN', exchangeRate) : item.currentValue;
      return {
        invested: acc.invested + amountPen,
        value: acc.value + valuePen,
      };
    }, { invested: 0, value: 0 });
  }, [items, exchangeRate]);
  const gain = totals.value - totals.invested;
  const gainPct = totals.invested > 0 ? (gain / totals.invested) * 100 : 0;

  const startEdit = (item: Investment) => {
    setDraft({
      id: item.id,
      name: item.name,
      kind: item.kind || 'fondo',
      amount: String(item.amount || ''),
      currentValue: String(item.currentValue || ''),
      currency: item.currency === 'USD' ? 'USD' : 'PEN',
      notes: item.notes || '',
    });
    setMessage('');
    setError('');
  };

  const reset = () => {
    setDraft(emptyDraft);
    setMessage('');
    setError('');
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!authToken) return;
    setSaving(true);
    setMessage('');
    setError('');

    try {
      const payload = {
        chat_id: chatId,
        name: draft.name,
        kind: draft.kind,
        amount: Number(draft.amount || 0),
        currentValue: Number(draft.currentValue || draft.amount || 0),
        currency: draft.currency,
        notes: draft.notes,
      };
      const url = draft.id ? `${apiEndpoint(`investments/${encodeURIComponent(draft.id)}`)}${chatId ? `?chat_id=${encodeURIComponent(chatId)}` : ''}` : `${apiEndpoint('investments')}${chatId ? `?chat_id=${encodeURIComponent(chatId)}` : ''}`;
      const response = await fetch(url, {
        method: draft.id ? 'PATCH' : 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const result = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || result.ok === false) throw new Error(result.error || 'No se pudo guardar la inversion');
      setMessage(draft.id ? 'Inversion actualizada.' : 'Inversion creada.');
      setDraft(emptyDraft);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la inversion');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item: Investment) => {
    if (!authToken || !item.id) return;
    const ok = window.confirm(`Eliminar la inversion "${item.name}"?`);
    if (!ok) return;

    setSaving(true);
    setMessage('');
    setError('');
    try {
      const url = `${apiEndpoint(`investments/${encodeURIComponent(item.id)}`)}${chatId ? `?chat_id=${encodeURIComponent(chatId)}` : ''}`;
      const response = await fetch(url, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const result = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || result.ok === false) throw new Error(result.error || 'No se pudo eliminar la inversion');
      setMessage('Inversion eliminada.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar la inversion');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="grid gap-3 sm:gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Title>Inversiones</Title>
          <Text>Capital, valor actual y resultado de tus posiciones.</Text>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Invertido" value={formatMoney(totals.invested)} />
        <SummaryCard label="Valor actual" value={formatMoney(totals.value)} />
        <SummaryCard label="Resultado" value={`${formatMoney(gain)} · ${gainPct.toFixed(1)}%`} tone={gain >= 0 ? 'good' : 'bad'} />
      </div>

      <div className="grid gap-3 sm:gap-4 lg:grid-cols-[0.85fr_1.15fr]">
        <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-4 sm:!p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Title>{draft.id ? 'Editar inversion' : 'Nueva inversion'}</Title>
              <Text>Registra capital, valor actual y moneda.</Text>
            </div>
            {draft.id ? (
              <button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-tremor-default border border-slate-700 text-slate-300" onClick={reset} title="Cancelar">
                <RiCloseLine className="h-4 w-4" />
              </button>
            ) : null}
          </div>

          <form className="mt-5 grid gap-3" onSubmit={save}>
            <Field label="Nombre"><input className="form-input" value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} required /></Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Tipo">
                <select className="form-input" value={draft.kind} onChange={(event) => setDraft((current) => ({ ...current, kind: event.target.value }))}>
                  <option value="fondo">Fondo</option>
                  <option value="acciones">Acciones</option>
                  <option value="plazo fijo">Plazo fijo</option>
                  <option value="otro">Otro</option>
                </select>
              </Field>
              <Field label="Moneda">
                <select className="form-input" value={draft.currency} onChange={(event) => setDraft((current) => ({ ...current, currency: event.target.value as Currency }))}>
                  <option value="PEN">PEN</option>
                  <option value="USD">USD</option>
                </select>
              </Field>
              <Field label="Invertido"><input className="form-input" type="number" min="0" step="0.01" value={draft.amount} onChange={(event) => setDraft((current) => ({ ...current, amount: event.target.value }))} required /></Field>
              <Field label="Valor actual"><input className="form-input" type="number" min="0" step="0.01" value={draft.currentValue} onChange={(event) => setDraft((current) => ({ ...current, currentValue: event.target.value }))} /></Field>
            </div>
            <Field label="Notas"><input className="form-input" value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} /></Field>
            <button className="inline-flex h-10 items-center justify-center gap-2 rounded-tremor-default bg-emerald-500 px-4 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-60" disabled={saving || !authToken}>
              {draft.id ? <RiSave3Line className="h-4 w-4" /> : <RiAddLine className="h-4 w-4" />}
              {draft.id ? 'Guardar inversion' : 'Crear inversion'}
            </button>
          </form>

          {message ? <div className="mt-3 rounded-tremor-default border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-100">{message}</div> : null}
          {error ? <div className="mt-3 rounded-tremor-default border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-100">{error}</div> : null}
        </Card>

        <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-4 sm:!p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Title>Portafolio</Title>
              <Text>{loading ? 'Cargando...' : `${items.length} posiciones activas`}</Text>
            </div>
            <Badge color={gain >= 0 ? 'emerald' : 'rose'}>{gain >= 0 ? 'Ganancia' : 'Perdida'}</Badge>
          </div>

          <div className="mt-5 grid gap-3">
            {items.length ? items.map((item) => (
              <InvestmentRow key={item.id || item.name} item={item} exchangeRate={exchangeRate} onEdit={startEdit} onDelete={remove} />
            )) : (
              <EmptyState>Sin inversiones registradas.</EmptyState>
            )}
          </div>
        </Card>
      </div>
    </section>
  );
}

function SummaryCard({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'neutral' | 'good' | 'bad' }) {
  const color = tone === 'good' ? 'text-emerald-300' : tone === 'bad' ? 'text-rose-300' : 'text-slate-100';
  return (
    <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-4">
      <Text>{label}</Text>
      <div className={`mt-2 text-xl font-semibold ${color}`}>{value}</div>
    </Card>
  );
}

function InvestmentRow({
  item,
  exchangeRate,
  onEdit,
  onDelete,
}: {
  item: Investment;
  exchangeRate: number;
  onEdit: (item: Investment) => void;
  onDelete: (item: Investment) => void;
}) {
  const currency = item.currency || 'PEN';
  const valuePen = currency === 'USD' ? convertCurrency(item.currentValue, 'USD', 'PEN', exchangeRate) : item.currentValue;
  const gain = item.gain ?? item.currentValue - item.amount;
  const positive = gain >= 0;

  return (
    <div className="rounded-tremor-default border border-slate-800 bg-slate-950/40 p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Text className="font-semibold text-slate-100">{item.name}</Text>
            <Badge color="slate">{item.kind}</Badge>
          </div>
          {item.notes ? <Text className="mt-1 line-clamp-2 text-xs">{item.notes}</Text> : null}
        </div>
        <div className="flex items-center gap-1">
          <button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-tremor-default border border-slate-700 bg-slate-900/70 text-slate-200" onClick={() => onEdit(item)} title="Editar">
            <RiEditLine className="h-4 w-4" />
          </button>
          <button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-tremor-default border border-rose-500/30 bg-rose-500/10 text-rose-200" onClick={() => onDelete(item)} title="Eliminar">
            <RiDeleteBinLine className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-3 grid gap-2 text-xs text-slate-400 sm:grid-cols-3">
        <span>Invertido: <b className="text-slate-100">{formatMoney(item.amount, currency)}</b></span>
        <span>Actual: <b className="text-slate-100">{formatMoney(item.currentValue, currency)}</b></span>
        <span>Resultado: <b className={positive ? 'text-emerald-300' : 'text-rose-300'}>{formatMoney(gain, currency)} · {(item.gainPct || 0).toFixed(1)}%</b></span>
      </div>
      {currency === 'USD' ? <div className="mt-2 text-xs text-slate-500">Valor ref.: {formatMoney(valuePen, 'PEN')}</div> : null}
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
