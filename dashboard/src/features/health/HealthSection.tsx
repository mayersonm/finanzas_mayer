import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, Metric, Text, Title } from '@tremor/react';
import { RiCheckboxCircleLine, RiErrorWarningLine, RiRefreshLine } from '@remixicon/react';
import { apiEndpoint } from '../../app/api';
import type { HealthCheck, SystemHealthData } from '../../types/dashboard';

const EMPTY_HEALTH: SystemHealthData = {
  status: 'warning',
  summary: { total: 0, ok: 0, warnings: 0, errors: 0, latencyMs: 0 },
  checks: [],
};

export function HealthSection({ authToken }: { authToken?: string | null }) {
  const [health, setHealth] = useState<SystemHealthData>(EMPTY_HEALTH);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadHealth = useCallback(async () => {
    if (!authToken) return;

    setLoading(true);
    setError('');
    try {
      const response = await fetch(apiEndpoint('system-health'), {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await response.json() as SystemHealthData;
      if (!response.ok || data.error) throw new Error(data.error || 'No se pudo leer salud del sistema');
      setHealth(data);
    } catch (err) {
      console.error('Health error:', err);
      setError('No se pudo consultar el estado del sistema.');
    } finally {
      setLoading(false);
    }
  }, [authToken]);

  useEffect(() => {
    void loadHealth();
  }, [loadHealth]);

  const groups = useMemo(() => groupChecks(health.checks), [health.checks]);

  return (
    <div className="grid gap-4">
      <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-4 sm:!p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge color={health.status === 'ok' ? 'emerald' : health.status === 'warning' ? 'amber' : 'rose'}>
                {health.status === 'ok' ? 'Sistema OK' : health.status === 'warning' ? 'Con avisos' : 'Con errores'}
              </Badge>
              {health.checkedAt ? <Badge color="slate">{health.checkedAt}</Badge> : null}
            </div>
            <Title>Salud del sistema</Title>
            <Text>Worker, D1, R2, Apps Script, Sheets y secretos criticos.</Text>
          </div>
          <Button icon={RiRefreshLine} color="emerald" loading={loading} onClick={() => void loadHealth()}>
            Revisar
          </Button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-4">
          <SummaryCard label="OK" value={health.summary.ok} tone="emerald" />
          <SummaryCard label="Avisos" value={health.summary.warnings} tone="amber" />
          <SummaryCard label="Errores" value={health.summary.errors} tone="rose" />
          <SummaryCard label="Latencia" value={`${health.summary.latencyMs} ms`} tone="cyan" />
        </div>

        {error ? <div className="mt-4 rounded-tremor-default border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</div> : null}
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {Object.entries(groups).map(([name, checks]) => (
          <Card key={name} className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-4">
            <Title className="text-base">{name}</Title>
            <div className="mt-4 grid gap-2">
              {checks.map((item) => (
                <HealthRow key={item.id} item={item} />
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: number | string; tone: 'emerald' | 'amber' | 'rose' | 'cyan' }) {
  const colorClass = {
    emerald: 'text-emerald-200',
    amber: 'text-amber-200',
    rose: 'text-rose-200',
    cyan: 'text-cyan-200',
  }[tone];

  return (
    <div className="rounded-tremor-default border border-slate-800 bg-slate-900/40 p-3">
      <Text>{label}</Text>
      <Metric className={`text-2xl ${colorClass}`}>{value}</Metric>
    </div>
  );
}

function HealthRow({ item }: { item: HealthCheck }) {
  const ok = item.status === 'ok';
  const warning = item.status === 'warning';
  const Icon = ok ? RiCheckboxCircleLine : RiErrorWarningLine;

  return (
    <div className="rounded-tremor-default border border-slate-800 bg-slate-900/40 p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-slate-100">
          <Icon className={`h-4 w-4 shrink-0 ${ok ? 'text-emerald-300' : warning ? 'text-amber-300' : 'text-rose-300'}`} />
          <span className="truncate">{item.label}</span>
        </span>
        <Badge color={ok ? 'emerald' : warning ? 'amber' : 'rose'}>{ok ? 'OK' : warning ? 'Aviso' : 'Error'}</Badge>
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-400">{item.message}</p>
    </div>
  );
}

function groupChecks(checks: HealthCheck[]) {
  return checks.reduce<Record<string, HealthCheck[]>>((acc, item) => {
    const group = item.id.startsWith('sheet:') ? 'Google Sheets'
      : item.id.startsWith('gas:') || item.id === 'appsScript' ? 'Apps Script'
        : item.id === 'd1' || item.id === 'r2' || item.id === 'worker' ? 'Cloudflare'
          : 'Secretos Worker';
    acc[group] = acc[group] || [];
    acc[group].push(item);
    return acc;
  }, {});
}

