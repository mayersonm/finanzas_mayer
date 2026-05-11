import { Badge, ProgressBar, Text } from '@tremor/react';
import { getBudgetConsidered, percent } from '../../lib/finance';
import { formatMoney } from '../../lib/formatters';
import { budgetColor } from '../../lib/tremorColors';
import type { Budget } from '../../types/dashboard';

export function BudgetProgress({ item }: { item: Budget }) {
  const pct = percent(item.gasto, item.limite);
  const considered = getBudgetConsidered(item);

  return (
    <div className="border-b border-slate-800 py-4 last:border-b-0 last:pb-0 first:pt-0">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <Text className="truncate font-semibold text-slate-200">{item.cat}</Text>
          <Text>Considerado: {formatMoney(considered)}</Text>
        </div>
        <Badge color={budgetColor(pct)}>{pct}%</Badge>
      </div>
      <ProgressBar className="mt-3" value={pct} color={budgetColor(pct)} />
      <div className="mt-2 flex justify-between gap-3 text-sm text-slate-400">
        <span>{formatMoney(item.gasto)}</span>
        <span>{formatMoney(item.limite)}</span>
      </div>
    </div>
  );
}
