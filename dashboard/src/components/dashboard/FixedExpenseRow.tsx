import { Badge, Text } from '@tremor/react';
import { fixedStatus } from '../../lib/finance';
import { formatMoney } from '../../lib/formatters';
import { fixedStatusColor } from '../../lib/tremorColors';
import type { FixedExpense } from '../../types/dashboard';

export function FixedExpenseRow({ item }: { item: FixedExpense }) {
  const status = fixedStatus(item);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-slate-800 py-4 last:border-b-0 last:pb-0 first:pt-0">
      <div className="min-w-0">
        <Text className="truncate font-semibold text-slate-200">{item.nombre}</Text>
        <Text className="truncate">{item.cat}</Text>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-3">
        <span className="font-mono text-sm font-semibold text-slate-100">{formatMoney(item.monto)}</span>
        <Badge color={fixedStatusColor(status)}>{status}</Badge>
      </div>
    </div>
  );
}
