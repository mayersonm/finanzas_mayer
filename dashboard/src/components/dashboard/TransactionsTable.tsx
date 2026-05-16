import { useEffect, useState, type ReactNode } from 'react';
import { RiBankCardLine, RiCloseLine, RiDeleteBinLine, RiEditLine, RiImageLine } from '@remixicon/react';
import {
  Badge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '@tremor/react';
import { apiEndpoint } from '../../app/api';
import { formatDate, formatMoney } from '../../lib/formatters';
import type { Transaction, TransactionReceipt } from '../../types/dashboard';
import { EmptyState } from '../common/EmptyState';

interface ReceiptPreview {
  url: string;
  name: string;
  tx: Transaction;
  receipt: TransactionReceipt;
}

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
      const response = await fetch(apiEndpoint(`receipts/${encodeURIComponent(receipt.id)}/file`), {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('No se pudo cargar la imagen');
      }

      const blob = await response.blob();
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
      const url = new URL(apiEndpoint(`transactions/${encodeURIComponent(tx.id)}`));
      if (chatId) url.searchParams.set('chat_id', chatId);
      const response = await fetch(url.toString(), {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      const result = await response.json().catch(() => ({})) as { ok?: boolean; error?: string };
      if (!response.ok || result.ok === false) {
        throw new Error(result.error || 'No se pudo eliminar');
      }

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
      const url = new URL(apiEndpoint(`transactions/${encodeURIComponent(next.id)}`));
      if (chatId) url.searchParams.set('chat_id', chatId);
      const response = await fetch(url.toString(), {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(next),
      });
      const result = await response.json().catch(() => ({})) as { ok?: boolean; error?: string };
      if (!response.ok || result.ok === false) throw new Error(result.error || 'No se pudo guardar');
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
      <div className="-mx-4 mt-3 overflow-x-auto px-4 sm:mx-0 sm:mt-4 sm:px-0">
        <Table className="min-w-[58rem]">
          <TableHead>
            <TableRow>
              <TableHeaderCell>Fecha</TableHeaderCell>
              <TableHeaderCell>Detalle</TableHeaderCell>
              <TableHeaderCell>Categoria</TableHeaderCell>
              <TableHeaderCell>Pago</TableHeaderCell>
              <TableHeaderCell>Foto</TableHeaderCell>
              <TableHeaderCell className="text-right">Monto</TableHeaderCell>
              <TableHeaderCell className="text-right">Acciones</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {transactions.map((tx, index) => {
              const isIncome = tx.tipo === 'ingreso';

              return (
                <TableRow key={tx.id || `${tx.fecha}-${tx.desc}-${index}`}>
                  <TableCell>
                    <div className="whitespace-nowrap">
                      <p className="text-slate-200">{formatDate(tx.fecha)}</p>
                      <p className="text-xs text-slate-500">{tx.hora || '00:00'}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="min-w-[10rem] sm:min-w-[12rem]">
                      <p className="font-semibold text-slate-100">{tx.desc}</p>
                      <Badge className="mt-1" color={isIncome ? 'emerald' : 'rose'}>
                        {tx.tipo}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="capitalize">{tx.cat}</TableCell>
                  <TableCell>
                    <div className="min-w-[8rem]">
                      <Badge color={tx.paymentMethod === 'credito' ? 'amber' : 'emerald'}>
                        <RiBankCardLine className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                        {tx.paymentMethod === 'credito' ? 'credito' : 'debito'}
                      </Badge>
                      {tx.paymentMethod === 'credito' ? (
                        <p className="mt-1 text-xs text-amber-200">
                          Pagar: {tx.paymentDueDate ? formatDate(tx.paymentDueDate) : 'configurar'}
                        </p>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    {tx.receipt ? (
                      <>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1.5 rounded-tremor-default border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1.5 text-xs font-semibold text-cyan-100 transition hover:border-cyan-400/60 hover:bg-cyan-500/20 disabled:cursor-wait disabled:opacity-60"
                          disabled={loadingReceiptId === tx.receipt.id}
                          onClick={() => void openReceipt(tx)}
                        >
                          <RiImageLine className="h-4 w-4" aria-hidden="true" />
                          {loadingReceiptId === tx.receipt.id ? 'Abriendo' : 'Ver'}
                        </button>
                        <p className="mt-1 text-xs text-slate-500">{formatBytes(tx.receipt.size)}</p>
                      </>
                    ) : (
                      <span className="text-xs text-slate-600">-</span>
                    )}
                  </TableCell>
                  <TableCell className={`text-right font-mono font-semibold ${isIncome ? 'text-emerald-300' : 'text-rose-300'}`}>
                    {isIncome ? '+' : '-'}
                    {formatMoney(tx.monto, tx.currency)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex gap-2">
                      <button
                        type="button"
                        className="inline-grid h-8 w-8 place-items-center rounded-tremor-default border border-cyan-500/30 bg-cyan-500/10 text-cyan-200 transition hover:border-cyan-400/60 hover:bg-cyan-500/20"
                        onClick={() => setEditing(tx)}
                        aria-label={`Editar ${tx.desc}`}
                        title="Editar movimiento"
                      >
                        <RiEditLine className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="inline-grid h-8 w-8 place-items-center rounded-tremor-default border border-rose-500/30 bg-rose-500/10 text-rose-200 transition hover:border-rose-400/60 hover:bg-rose-500/20 disabled:cursor-wait disabled:opacity-60"
                        disabled={deletingId === tx.id}
                        onClick={() => void deleteTransaction(tx)}
                        aria-label={`Eliminar ${tx.desc}`}
                        title="Eliminar movimiento"
                      >
                        <RiDeleteBinLine className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {error ? (
        <div className="mt-3 rounded-tremor-default border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      {preview ? (
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
        </div>
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

  return (
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
    </div>
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

function formatBytes(value?: number) {
  const bytes = Number(value || 0);
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
