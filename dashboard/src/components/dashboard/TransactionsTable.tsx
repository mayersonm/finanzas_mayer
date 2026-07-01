import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { RiArrowDownSLine, RiArrowUpSLine, RiCloseLine, RiDeleteBinLine, RiEditLine, RiImageLine } from '@remixicon/react';
import { apiBlob, apiRequest } from '../../app/apiClient';
import { formatDate, formatMoney } from '../../lib/formatters';
import { categoryVisual } from '../../lib/categoryVisual';
import type { Transaction, TransactionReceipt } from '../../types/dashboard';
import { EmptyState } from '../common/EmptyState';

interface ReceiptPreview {
  url: string;
  name: string;
  tx: Transaction;
  receipt: TransactionReceipt;
}

type SortKey = 'fecha' | 'cat' | 'monto';

export function TransactionsTable({
  transactions,
  authToken,
  chatId,
  onChanged,
}: {
  transactions: Transaction[];
  authToken?: string | null;
  chatId?: string;
  onChanged?: () => void;
}) {
  const [loadingReceiptId, setLoadingReceiptId] = useState('');
  const [deletingId, setDeletingId] = useState('');
  const [preview, setPreview] = useState<ReceiptPreview | null>(null);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [savingId, setSavingId] = useState('');
  const [error, setError] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' } | null>(null);

  const sortedTransactions = useMemo(() => {
    if (!sort) return transactions;
    const factor = sort.dir === 'asc' ? 1 : -1;
    return [...transactions].sort((a, b) => {
      if (sort.key === 'monto') return (Number(a.monto || 0) - Number(b.monto || 0)) * factor;
      if (sort.key === 'cat') return String(a.cat || '').localeCompare(String(b.cat || '')) * factor;
      return `${a.fecha || ''} ${a.hora || ''}`.localeCompare(`${b.fecha || ''} ${b.hora || ''}`) * factor;
    });
  }, [transactions, sort]);

  const toggleSort = (key: SortKey) => setSort((current) => {
    if (!current || current.key !== key) return { key, dir: 'asc' };
    if (current.dir === 'asc') return { key, dir: 'desc' };
    return null;
  });

  useEffect(() => {
    return () => {
      if (preview?.url) URL.revokeObjectURL(preview.url);
    };
  }, [preview?.url]);

  if (!transactions.length) return <EmptyState>Sin movimientos registrados.</EmptyState>;

  async function openReceipt(tx: Transaction) {
    const receipt = tx.receipt;
    if (!receipt) return;

    if (!authToken) {
      setError('Sesion no disponible. Vuelve a iniciar sesion.');
      return;
    }

    setLoadingReceiptId(receipt.id);
    setError('');

    try {
      const blob = await apiBlob(`receipts/${encodeURIComponent(receipt.id)}/file`, { token: authToken });
      const objectUrl = URL.createObjectURL(blob);
      setPreview({
        url: objectUrl,
        name: receipt.fileName || 'Recibo',
        tx,
        receipt,
      });
    } catch (err) {
      console.error('Receipt preview error:', err);
      setError('No pude abrir la imagen del recibo.');
    } finally {
      setLoadingReceiptId('');
    }
  }

  async function deleteTransaction(tx: Transaction) {
    if (!authToken) {
      setError('Sesion no disponible. Vuelve a iniciar sesion.');
      return;
    }

    if (!tx.id) {
      setError('Este movimiento no tiene id para eliminar.');
      return;
    }

    const ok = window.confirm(`Eliminar "${tx.desc}" por ${formatMoney(tx.monto, tx.currency)}?`);
    if (!ok) return;

    setDeletingId(tx.id);
    setError('');

    try {
      await apiRequest(`transactions/${encodeURIComponent(tx.id)}`, {
        method: 'DELETE',
        token: authToken,
        query: { chat_id: chatId },
      });
      onChanged?.();
    } catch (err) {
      console.error('Delete transaction error:', err);
      setError('No pude eliminar el movimiento.');
    } finally {
      setDeletingId('');
    }
  }

  async function saveTransaction(next: Transaction) {
    if (!authToken || !next.id) return;
    setSavingId(next.id);
    setError('');
    try {
      await apiRequest(`transactions/${encodeURIComponent(next.id)}`, {
        method: 'PATCH',
        token: authToken,
        query: { chat_id: chatId },
        body: next,
      });
      setEditing(null);
      onChanged?.();
    } catch (err) {
      console.error('Edit transaction error:', err);
      setError(err instanceof Error ? err.message : 'No pude guardar el movimiento.');
    } finally {
      setSavingId('');
    }
  }

  return (
    <>
      <div className="mt-3 flex items-center gap-2 text-xs text-slate-500 sm:mt-4">
        <span className="font-medium uppercase tracking-wide">Ordenar</span>
        <SortChip label="Fecha" sortKey="fecha" sort={sort} onSort={toggleSort} />
        <SortChip label="Categoria" sortKey="cat" sort={sort} onSort={toggleSort} />
        <SortChip label="Monto" sortKey="monto" sort={sort} onSort={toggleSort} />
      </div>

      <div className="mt-2 overflow-hidden rounded-tremor-default border border-slate-800 bg-slate-950/40">
        {sortedTransactions.map((tx, index) => {
          const isIncome = tx.tipo === 'ingreso';
          const visual = categoryVisual(tx.cat);
          const Icon = visual.Icon;
          const detail = [
            tx.cat ? capitalize(tx.cat) : 'Sin categoria',
            `${formatDate(tx.fecha)}${tx.hora ? ` ${tx.hora}` : ''}`,
            tx.paymentMethod === 'credito' ? 'Credito' : 'Debito',
          ].join(' · ');

          return (
            <div
              key={tx.id || `${tx.fecha}-${tx.desc}-${index}`}
              className="flex items-center gap-3 border-t border-slate-800/70 px-3 py-3 transition first:border-t-0 hover:bg-slate-900/40 sm:px-4"
            >
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${visual.badge}`}>
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-slate-100">{tx.desc || 'Sin descripcion'}</p>
                <p className="mt-0.5 truncate text-xs text-slate-500">
                  {detail}
                  {tx.paymentMethod === 'credito' && tx.paymentDueDate ? ` · pagar ${formatDate(tx.paymentDueDate)}` : ''}
                </p>
              </div>

              <div className="shrink-0 text-right">
                <p className={`font-mono text-sm font-semibold ${isIncome ? 'text-emerald-300' : 'text-rose-300'}`}>
                  {isIncome ? '+' : '-'}{formatMoney(tx.monto, tx.currency)}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                {tx.receipt ? (
                  <button
                    type="button"
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900/60 px-2.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60"
                    disabled={loadingReceiptId === tx.receipt.id}
                    onClick={() => void openReceipt(tx)}
                    aria-label="Ver foto del recibo"
                    title="Ver foto del recibo"
                  >
                    <RiImageLine className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="hidden sm:inline">{loadingReceiptId === tx.receipt.id ? 'Abriendo' : 'Foto'}</span>
                  </button>
                ) : null}
                <button
                  type="button"
                  className="grid h-8 w-8 place-items-center rounded-lg border border-slate-700 bg-slate-900/60 text-slate-300 transition hover:border-slate-600 hover:text-slate-100"
                  onClick={() => setEditing(tx)}
                  aria-label={`Editar ${tx.desc}`}
                  title="Editar movimiento"
                >
                  <RiEditLine className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="grid h-8 w-8 place-items-center rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-200 transition hover:bg-rose-500/20 disabled:cursor-wait disabled:opacity-60"
                  disabled={deletingId === tx.id}
                  onClick={() => void deleteTransaction(tx)}
                  aria-label={`Eliminar ${tx.desc}`}
                  title="Eliminar movimiento"
                >
                  <RiDeleteBinLine className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {error ? (
        <div className="mt-3 rounded-tremor-default border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      {preview ? createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm">
          <div className="w-full max-w-4xl rounded-tremor-default border border-slate-700 bg-slate-950 shadow-2xl shadow-black/40">
            <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-100">{preview.name}</p>
                <p className="text-xs text-slate-500">
                  {formatDate(preview.tx.fecha)} - {formatMoney(preview.tx.monto, preview.tx.currency)}
                </p>
              </div>
              <button
                type="button"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-tremor-default border border-slate-700 text-slate-300 transition hover:bg-slate-900 hover:text-white"
                onClick={() => setPreview(null)}
                aria-label="Cerrar imagen"
              >
                <RiCloseLine className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <div className="grid max-h-[82vh] gap-3 overflow-auto p-3 lg:grid-cols-[18rem_minmax(0,1fr)]">
              <aside className="rounded-tremor-default border border-slate-800 bg-slate-900/50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Datos leidos</p>
                <dl className="mt-3 grid gap-3 text-sm">
                  <Meta label="Descripcion" value={preview.tx.desc} />
                  <Meta label="Categoria" value={preview.tx.cat} />
                  <Meta label="Metodo" value={preview.tx.paymentMethod === 'credito' ? 'Credito' : 'Debito'} />
                  <Meta label="Fecha" value={formatDate(preview.tx.fecha)} />
                  <Meta label="Monto" value={formatMoney(preview.tx.monto, preview.tx.currency)} />
                  <Meta label="Archivo" value={preview.receipt.fileName || 'Recibo'} />
                  <Meta label="Peso" value={formatBytes(preview.receipt.size)} />
                  <Meta label="Subido" value={preview.receipt.uploadedAt ? preview.receipt.uploadedAt : 'Sin fecha'} />
                </dl>
              </aside>
              <div className="min-h-[20rem] rounded-tremor-default border border-slate-800 bg-slate-900/40 p-2">
                <img
                  className="mx-auto max-h-[76vh] w-auto max-w-full rounded-tremor-default object-contain"
                  src={preview.url}
                  alt={preview.name}
                />
              </div>
            </div>
          </div>
        </div>,
        document.body
      ) : null}

      {editing ? (
        <EditTransactionModal
          tx={editing}
          saving={savingId === editing.id}
          onClose={() => setEditing(null)}
          onSave={(next) => void saveTransaction(next)}
        />
      ) : null}
    </>
  );
}

function SortChip({
  label,
  sortKey,
  sort,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  sort: { key: SortKey; dir: 'asc' | 'desc' } | null;
  onSort: (key: SortKey) => void;
}) {
  const active = sort?.key === sortKey;
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-semibold transition ${
        active
          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
          : 'border-slate-800 bg-slate-900/40 text-slate-400 hover:text-slate-200'
      }`}
    >
      {label}
      {active ? (
        sort?.dir === 'asc'
          ? <RiArrowUpSLine className="h-3.5 w-3.5" aria-hidden="true" />
          : <RiArrowDownSLine className="h-3.5 w-3.5" aria-hidden="true" />
      ) : null}
    </button>
  );
}

function EditTransactionModal({
  tx,
  saving,
  onClose,
  onSave,
}: {
  tx: Transaction;
  saving: boolean;
  onClose: () => void;
  onSave: (tx: Transaction) => void;
}) {
  const [draft, setDraft] = useState<Transaction>(tx);
  const set = (key: keyof Transaction, value: string | number) => setDraft((current) => ({ ...current, [key]: value }));

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm">
      <form className="w-full max-w-2xl rounded-tremor-default border border-slate-700 bg-slate-950 p-4 shadow-2xl shadow-black/40" onSubmit={(event) => { event.preventDefault(); onSave(draft); }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Corregir movimiento</h2>
            <p className="text-sm text-slate-400">Actualiza los datos leidos por la IA o ingresados manualmente.</p>
          </div>
          <button type="button" className="grid h-9 w-9 place-items-center rounded-tremor-default border border-slate-700 text-slate-300" onClick={onClose}>
            <RiCloseLine className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Descripcion"><input className="form-input" value={draft.desc} onChange={(event) => set('desc', event.target.value)} /></Field>
          <Field label="Categoria"><input className="form-input" value={draft.cat} onChange={(event) => set('cat', event.target.value.toLowerCase())} /></Field>
          <Field label="Monto"><input className="form-input" type="number" min="0.01" step="0.01" value={draft.monto} onChange={(event) => set('monto', Number(event.target.value))} /></Field>
          <Field label="Moneda">
            <select className="form-input" value={draft.currency || 'PEN'} onChange={(event) => set('currency', event.target.value)}>
              <option value="PEN">PEN</option>
              <option value="USD">USD</option>
            </select>
          </Field>
          <Field label="Fecha"><input className="form-input" type="date" value={draft.fecha} onChange={(event) => set('fecha', event.target.value)} /></Field>
          <Field label="Hora"><input className="form-input" type="time" value={draft.hora || '00:00'} onChange={(event) => set('hora', event.target.value)} /></Field>
          <Field label="Tipo">
            <select className="form-input" value={draft.tipo} onChange={(event) => set('tipo', event.target.value)}>
              <option value="gasto">Gasto</option>
              <option value="ingreso">Ingreso</option>
            </select>
          </Field>
          <Field label="Pago">
            <select className="form-input" value={draft.paymentMethod || 'debito'} onChange={(event) => set('paymentMethod', event.target.value)}>
              <option value="debito">Debito</option>
              <option value="credito">Credito</option>
            </select>
          </Field>
          {draft.paymentMethod === 'credito' ? (
            <>
              <Field label="Fecha pago"><input className="form-input" type="date" value={draft.paymentDueDate || ''} onChange={(event) => set('paymentDueDate', event.target.value)} /></Field>
              <Field label="Tarjeta"><input className="form-input" value={draft.cardName || ''} onChange={(event) => set('cardName', event.target.value)} /></Field>
            </>
          ) : null}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="rounded-tremor-default border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200" onClick={onClose}>Cancelar</button>
          <button className="rounded-tremor-default bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60" disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
        </div>
      </form>
    </div>,
    document.body
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{label}{children}</label>;
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 break-words font-medium text-slate-100">{value || '-'}</dd>
    </div>
  );
}

function capitalize(value: string) {
  const text = String(value || '').trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

function formatBytes(value?: number) {
  const bytes = Number(value || 0);
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
