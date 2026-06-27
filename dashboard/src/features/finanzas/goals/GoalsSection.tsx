import { Badge, Text, Title } from '@tremor/react';
import { EmptyState } from '../../../components/common/EmptyState';
import { GoalProgress } from '../../../components/dashboard/GoalProgress';
import type { DashboardData } from '../../../types/dashboard';

export function GoalsSection({ data }: { data: DashboardData }) {
  return (
    <section>
      <div className="mb-4 flex items-start justify-between gap-3 sm:gap-4">
        <div>
          <Title>Metas de ahorro</Title>
          <Text>Seguimiento de avance por objetivo</Text>
        </div>
        <Badge color="violet">{data.metas.length}</Badge>
      </div>
      <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
        {data.metas.length ? (
          data.metas.map((item) => <GoalProgress key={item.nombre} item={item} />)
        ) : (
          <EmptyState>Sin metas registradas.</EmptyState>
        )}
      </div>
    </section>
  );
}
