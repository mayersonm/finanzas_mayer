import { Badge, ProgressBar, Text, type Color } from '@tremor/react';
import { formatMoney, convertCurrency } from '../../lib/formatters';
import type { Debt } from '../../types/dashboard';

export function DebtRow({ item, exchangeRate = 3.85 }: { item: Debt; exchangeRate?: number }) {
  const progress = item.total > 0 ? Math.min(100, Math.round((item.pagado / item.total) * 100)) : 0;
  const isPaid = item.estado === 'pagada' || item.pendiente <= 0;
  const color: Color = isPaid ? 'emerald' : 'rose';
  const currency = item.currency || 'PEN';
  const pendienteEnPEN = currency === 'USD' ? convertCurrency(item.pendiente, 'USD', 'PEN', exchangeRate) : item.pendiente;
  const pagadoEnPEN = currency === 'USD' ? convertCurrency(item.pagado, 'USD', 'PEN', exchangeRate) : item.pagado;
  const totalEnPEN = currency === 'USD' ? convertCurrency(item.total, 'USD', 'PEN', exchangeRate) : item.total;

  return (
    <div className="border-b border-slate-800 py-3 last:border-b-0 last:pb-0 first:pt-0 sm:py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Text className="truncate font-semibold text-slate-100">{item.nombre}</Text>
          <Text className="mt-1">
            {item.vencimiento ? `Vence ${item.vencimiento}` : 'Sin vencimiento'}
          </Text>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge color={color}>{isPaid ? 'Pagada' : formatMoney(item.pendiente, currency)}</Badge>
          {currency === 'USD' && <Text className="text-xs text-slate-400">≈ {formatMoney(pendienteEnPEN, 'PEN')}</Text>}
        </div>
      </div>
      <ProgressBar className="mt-3" value={progress} color={color} />
      <div className="mt-2 flex items-center justify-between gap-3 text-xs text-slate-400">
        <span>{progress}% pagado</span>
        <span>{formatMoney(item.pagado, currency)} de {formatMoney(item.total, currency)}</span>
      </div>
      {currency === 'USD' && (
        <div className="mt-2 text-xs text-slate-500">
          Conversión: {formatMoney(pagadoEnPEN, 'PEN')} de {formatMoney(totalEnPEN, 'PEN')}
        </div>
      )}
    </div>
  );
}
