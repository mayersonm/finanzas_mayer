import { Badge, Button, Card, Text, Title } from '@tremor/react';
import { RiLockPasswordLine, RiLogoutBoxRLine, RiRefreshLine } from '@remixicon/react';
import { formatUpdatedAt } from '../../lib/formatters';
import { statusColor } from '../../lib/tremorColors';
import type { ApiStatus, DashboardData } from '../../types/dashboard';

export function AppHeader({
  data,
  loading,
  status,
  isConfigured,
  onRefresh,
  onTogglePasswordPanel,
  onLogout,
}: {
  data: DashboardData;
  loading: boolean;
  status: ApiStatus;
  isConfigured: boolean;
  onRefresh: () => void;
  onTogglePasswordPanel: () => void;
  onLogout: () => void;
}) {
  return (
    <Card className="mb-4 rounded-tremor-default border-slate-800 bg-slate-950/80 !p-4 sm:mb-5 sm:!p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge color={statusColor(status)}>
              {status === 'live' ? `En vivo${data.source ? ` - ${data.source}` : ''}` : status === 'error' ? 'Error API' : 'Demo'}
            </Badge>
            <Badge color="cyan">{data.mesKey || data.mes}</Badge>
          </div>
          <Title className="text-xl sm:text-3xl">Mayeson Finanzas</Title>
          <Text className="mt-1 text-xs sm:text-sm">Ultima actualizacion: {loading ? 'Actualizando...' : formatUpdatedAt(data.updatedAt)}</Text>
        </div>

        <div className="grid gap-2 min-[420px]:grid-cols-3 sm:flex sm:flex-wrap">
          <Button className="min-w-0" icon={RiRefreshLine} color="emerald" loading={loading} loadingText="Actualizando" onClick={onRefresh}>
            Actualizar
          </Button>
          {isConfigured ? (
            <>
              <Button className="min-w-0" icon={RiLockPasswordLine} variant="secondary" color="slate" onClick={onTogglePasswordPanel}>
                Clave
              </Button>
              <Button className="min-w-0" icon={RiLogoutBoxRLine} variant="light" color="rose" onClick={onLogout}>
                Salir
              </Button>
            </>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
