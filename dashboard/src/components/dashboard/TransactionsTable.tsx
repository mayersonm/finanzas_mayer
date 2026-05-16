import { useEffect, useState } from 'react';
import { RiBankCardLine, RiCloseLine, RiDeleteBinLine, RiImageLine } from '@remixicon/react';
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
}

export function TransactionsTable({
  transactions,
  authToken,
  onDeleted,
}: {
  transactions: Transaction[];
  authToken?: string | null;
  onDeleted?: () => void;
}) {
  const [loadingReceiptId, setLoadingReceiptId] = useState('');
  const [deletingId, setDeletingId] = useState('');
  const [preview, setPreview] = useState<ReceiptPreview | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    return () => {
      if (preview?.url) URL.revokeObjectURL(preview.url);
    };
  }, [preview?.url]);

  if (!transactions.length) return <EmptyState>Sin movimientos registrados.</EmptyState>;

  async function openReceipt(receipt: TransactionReceipt) {
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
      const response = await fetch(apiEndpoint(`transactions/${encodeURIComponent(tx.id)}`), {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      const result = await response.json().catch(() => ({})) as { ok?: boolean; error?: string };
      if (!response.ok || result.ok === false) {
        throw new Error(result.error || 'No se pudo eliminar');
      }

      onDeleted?.();
    } catch (err) {
      console.error('Delete transaction error:', err);
      setError('No pude eliminar el movimiento.');
    } finally {
      setDeletingId('');
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
              <TableHeaderCell className="text-right">Accion</TableHeaderCell>
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
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 rounded-tremor-default border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1.5 text-xs font-semibold text-cyan-100 transition hover:border-cyan-400/60 hover:bg-cyan-500/20 disabled:cursor-wait disabled:opacity-60"
                        disabled={loadingReceiptId === tx.receipt.id}
                        onClick={() => void openReceipt(tx.receipt!)}
                      >
                        <RiImageLine className="h-4 w-4" aria-hidden="true" />
                        {loadingReceiptId === tx.receipt.id ? 'Abriendo' : 'Ver'}
                      </button>
                    ) : (
                      <span className="text-xs text-slate-600">-</span>
                    )}
                  </TableCell>
                  <TableCell className={`text-right font-mono font-semibold ${isIncome ? 'text-emerald-300' : 'text-rose-300'}`}>
                    {isIncome ? '+' : '-'}
                    {formatMoney(tx.monto, tx.currency)}
                  </TableCell>
                  <TableCell className="text-right">
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
                <p className="text-xs text-slate-500">Comprobante adjunto</p>
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
            <div className="max-h-[82vh] overflow-auto p-3">
              <img
                className="mx-auto max-h-[78vh] w-auto max-w-full rounded-tremor-default object-contain"
                src={preview.url}
                alt={preview.name}
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
