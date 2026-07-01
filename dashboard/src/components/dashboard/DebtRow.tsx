import { Badge, ProgressBar, Text, type Color } from '@tremor/react';
import { RiDeleteBinLine, RiEditLine, RiMoneyDollarCircleLine } from '@remixicon/react';
import type { ReactNode } from 'react';
import { formatMoney, convertCurrency } from '../../lib/formatters';
import type { Debt } from '../../types/dashboard';

export function DebtRow({
  item,
  exchangeRate = 3.85,
  onEdit,
  onPay,
  onDelete,
}: {
  item: Debt;
  exchangeRate?: number;
  onEdit?: (item: Debt) => void;
  onPay?: (item: Debt) => void;
  onDelete?: (item: Debt) => void;
}) {
  const progress = item.total > 0 ? Math.min(100, Math.round((item.pagado / item.total) * 100)) : 0;
  const isPaid = item.estado === 'pagada' || item.pendiente <= 0;
  const color: Color = isPaid ? 'emerald' : 'rose';
  const currency = item.currency || 'PEN';
  const pendienteEnPEN = currency === 'USD' ? convertCurrency(item.pendiente, 'USD', 'PEN', exchangeRate) : item.pendiente;
  const pagadoEnPEN = currency === 'USD' ? convertCurrency(item.pagado, 'USD', 'PEN', exchangeRate) : item.pagado;
  const totalEnPEN = currency === 'USD' ? convertCurrency(item.total, 'USD', 'PEN', exchangeRate) : item.total;
  const payments = item.payments || [];

  return (
    <div className="rounded-tremor-default bg-slate-900/40 p-3 transition hover:bg-slate-900/70 sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Text className="truncate font-semibold text-slate-100">{item.nombre}</Text>
          <Text className="mt-1">
            {item.vencimiento ? `Vence ${item.vencimiento}` : 'Sin vencimiento'}
          </Text>
          {item.notas ? <Text className="mt-1 line-clamp-2 text-xs">{item.notas}</Text> : null}
        </div>
        <div className="flex items-start justify-between gap-2 sm:flex-col sm:items-end">
          <div className="flex flex-col items-start gap-1 sm:items-end">
            <Badge color={color}>{isPaid ? 'Pagada' : formatMoney(item.pendiente, currency)}</Badge>
            {currency === 'USD' ? <Text className="text-xs text-slate-400">≈ {formatMoney(pendienteEnPEN, 'PEN')}</Text> : null}
          </div>
          <div className="flex gap-1">
            <ActionButton label="Pagar" onClick={() => onPay?.(item)} disabled={isPaid}>
              <RiMoneyDollarCircleLine className="h-4 w-4" />
            </ActionButton>
            <ActionButton label="Editar" onClick={() => onEdit?.(item)}>
              <RiEditLine className="h-4 w-4" />
            </ActionButton>
            <ActionButton label="Eliminar" onClick={() => onDelete?.(item)} tone="danger">
              <RiDeleteBinLine className="h-4 w-4" />
            </ActionButton>
          </div>
        </div>
      </div>

      <ProgressBar className="mt-3" value={progress} color={color} />
      <div className="mt-2 flex items-center justify-between gap-3 text-xs text-slate-400">
        <span>{progress}% pagado</span>
        <span>{formatMoney(item.pagado, currency)} de {formatMoney(item.total, currency)}</span>
      </div>
      {currency === 'USD' ? (
        <div className="mt-2 text-xs text-slate-500">
          Conversion: {formatMoney(pagadoEnPEN, 'PEN')} de {formatMoney(totalEnPEN, 'PEN')}
        </div>
      ) : null}

      {payments.length ? (
        <div className="mt-3 rounded-tremor-default bg-slate-950/40 p-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Historial de pagos</div>
          <div className="space-y-2">
            {payments.slice(0, 5).map((payment) => (
              <div key={payment.id} className="flex items-center justify-between gap-3 text-xs text-slate-300">
                <span className="min-w-0 truncate">{payment.paymentDate}{payment.notes ? ` · ${payment.notes}` : ''}</span>
                <span className="shrink-0 font-semibold text-slate-100">{formatMoney(payment.amount, payment.currency || currency)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ActionButton({
  label,
  children,
  onClick,
  disabled,
  tone = 'neutral',
}: {
  label: string;
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  tone?: 'neutral' | 'danger';
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-tremor-default border transition disabled:cursor-not-allowed disabled:opacity-40 ${
        tone === 'danger'
          ? 'border-rose-500/30 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20'
          : 'border-slate-700 bg-slate-900/70 text-slate-200 hover:bg-slate-800'
      }`}
    >
      {children}
    </button>
  );
}
