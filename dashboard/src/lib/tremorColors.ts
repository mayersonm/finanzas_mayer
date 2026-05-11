import type { Color } from '@tremor/react';
import type { ApiStatus } from '../types/dashboard';

export const categoryColors: Color[] = ['emerald', 'amber', 'sky', 'rose', 'violet', 'cyan', 'orange', 'teal'];

export function budgetColor(pct: number): Color {
  if (pct >= 100) return 'rose';
  if (pct >= 80) return 'amber';
  return 'emerald';
}

export function goalColor(pct: number): Color {
  if (pct >= 100) return 'emerald';
  if (pct >= 50) return 'amber';
  return 'sky';
}

export function statusColor(status: ApiStatus): Color {
  if (status === 'live') return 'emerald';
  if (status === 'error') return 'rose';
  return 'amber';
}

export function fixedStatusColor(status: string): Color {
  if (status === 'pagado') return 'emerald';
  if (status === 'saltado') return 'sky';
  return 'amber';
}
