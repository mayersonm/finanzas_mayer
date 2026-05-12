import { Badge, Card, ProgressBar, Text, Title } from '@tremor/react';
import { percent } from '../../lib/finance';
import { formatMoney } from '../../lib/formatters';
import { goalColor } from '../../lib/tremorColors';
import type { Goal } from '../../types/dashboard';

export function GoalProgress({ item }: { item: Goal }) {
  const pct = percent(item.ahorrado, item.objetivo);

  return (
    <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-4 sm:!p-6">
      <div className="flex items-center justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <Title className="truncate">{item.nombre}</Title>
          <Text>
            {formatMoney(item.ahorrado)} / {formatMoney(item.objetivo)}
          </Text>
        </div>
        <Badge color={goalColor(pct)}>{pct}%</Badge>
      </div>
      <ProgressBar className="mt-3 sm:mt-4" value={pct} color={goalColor(pct)} />
    </Card>
  );
}
