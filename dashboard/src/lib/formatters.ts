export function formatMoney(value: number): string {
  const sign = value < 0 ? '-' : '';
  return `${sign}S/ ${Math.abs(value).toLocaleString('es-PE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatDate(value: string): string {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
}

export function formatUpdatedAt(value?: string): string {
  if (!value) return 'Sin actualizacion';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('es-PE', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
