import { Badge, Text } from '@tremor/react';
import { RiCheckboxCircleLine, RiDeleteBinLine, RiEditLine } from '@remixicon/react';
import type { ReactNode } from 'react';
import { fixedStatus } from '../../lib/finance';
import { convertCurrency, formatMoney } from '../../lib/formatters';
import { fixedStatusColor } from '../../lib/tremorColors';
import type { FixedExpense } from '../../types/dashboard';

export function FixedExpenseRow({
  item,
  exchangeRate = 3.85,
  onEdit,
  onDelete,
  onMarkPaid,
}: {
  item: FixedExpense;
  exchangeRate?: number;
  onEdit?: (item: FixedExpense) => void;
  onDelete?: (item: FixedExpense) => void;
  onMarkPaid?: (item: FixedExpense) => void;
}) {
  const status = fixedStatus(item);
  const currency = item.currency || 'PEN';
  const montoPen = item.montoPen ?? (currency === 'USD' ? convertCurrency(item.monto, 'USD', 'PEN', exchangeRate) : item.monto);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-tremor-default bg-slate-900/40 p-3 transition hover:bg-slate-900/70 sm:gap-4">
      <div className="min-w-0">
        <Text className="truncate font-semibold text-slate-200">{item.nombre}</Text>
        <Text className="truncate">{item.cat}</Text>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
        <div className="text-right">
          <span className="font-mono text-sm font-semibold text-slate-100">{formatMoney(item.monto, currency)}</span>
          {currency === 'USD' ? <Text className="text-xs text-slate-400">≈ {formatMoney(montoPen, 'PEN')}</Text> : null}
        </div>
        <Badge color={fixedStatusColor(status)}>{status}</Badge>
        <div className="flex gap-1">
          {status !== 'pagado' ? (
            <ActionButton label="Marcar pagado" onClick={() => onMarkPaid?.(item)} tone="success">
              <RiCheckboxCircleLine className="h-4 w-4" />
            </ActionButton>
          ) : null}
          <ActionButton label="Editar" onClick={() => onEdit?.(item)}>
            <RiEditLine className="h-4 w-4" />
          </ActionButton>
          <ActionButton label="Eliminar" onClick={() => onDelete?.(item)} tone="danger">
            <RiDeleteBinLine className="h-4 w-4" />
          </ActionButton>
        </div>
      </div>
    </div>
  );
}

function ActionButton({
  label,
  children,
  onClick,
  tone = 'neutral',
}: {
  label: string;
  children: ReactNode;
  onClick?: () => void;
  tone?: 'neutral' | 'danger' | 'success';
}) {
  const toneClass = tone === 'danger'
    ? 'border-rose-500/30 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20'
    : tone === 'success'
      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20'
      : 'border-slate-700 bg-slate-900/70 text-slate-200 hover:bg-slate-800';

  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-tremor-default border transition ${toneClass}`}
    >
      {children}
    </button>
  );
}
