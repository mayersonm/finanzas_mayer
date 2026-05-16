import { Badge, Card, Text, Title } from '@tremor/react';
import { TransactionsTable } from '../../components/dashboard/TransactionsTable';
import type { DashboardData } from '../../types/dashboard';

export function MovementsSection({
  data,
  authToken,
  onDeleted,
}: {
  data: DashboardData;
  authToken?: string | null;
  onDeleted?: () => void;
}) {
  return (
    <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-4 sm:!p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Title>Movimientos</Title>
          <Text>{data.transacciones.length} registros recientes</Text>
        </div>
        <Badge color="emerald">{data.mes}</Badge>
      </div>
      <TransactionsTable transactions={data.transacciones} authToken={authToken} onDeleted={onDeleted} />
    </Card>
  );
}
