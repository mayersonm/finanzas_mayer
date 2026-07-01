import { Badge, Card, Text, Title } from '@tremor/react';
import type { EmailConfig } from '../../types/dashboard';

export function EmailPanel({ config }: { config?: EmailConfig }) {
  if (!config) return null;

  return (
    <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-4 sm:!p-6">
      <div className="flex items-start justify-between gap-3 sm:gap-4">
        <div>
          <Title>Correo</Title>
          <Text>Resumenes activos</Text>
        </div>
        <Badge color={config.configured ? 'emerald' : 'amber'}>
          {config.configured ? 'Configurado' : 'Pendiente'}
        </Badge>
      </div>
      <div className="mt-4 grid gap-3 sm:mt-5 sm:grid-cols-3">
        {[
          ['Diario', config.daily || '-'],
          ['Mensual', config.monthly || '-'],
          ['Anual', config.yearly || '-'],
        ].map(([label, value]) => (
          <div key={label} className="rounded-tremor-default bg-slate-900/60 p-3">
            <Text>{label}</Text>
            <p className="mt-1 truncate font-mono text-sm font-semibold text-slate-100">{value}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
