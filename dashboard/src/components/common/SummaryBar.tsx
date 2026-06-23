import type { ReactNode } from 'react';
import { RiArrowDownSLine } from '@remixicon/react';

export type StatTone = 'neutral' | 'good' | 'bad' | 'warn' | 'info';

export interface SummaryStat {
  label: string;
  value: string;
  tone?: StatTone;
  detail?: string;
}

const toneClass: Record<StatTone, string> = {
  neutral: 'text-slate-100',
  good: 'text-emerald-300',
  bad: 'text-rose-300',
  warn: 'text-amber-300',
  info: 'text-cyan-300',
};

// Franja de KPIs reutilizable: el "héroe" de cada vista, lectura de un vistazo.
export function SummaryBar({ stats, className = '' }: { stats: SummaryStat[]; className?: string }) {
  const cols = stats.length <= 3 ? 'sm:grid-cols-3' : stats.length === 4 ? 'sm:grid-cols-4' : 'sm:grid-cols-3 lg:grid-cols-5';
  return (
    <div className={`grid grid-cols-2 gap-2 sm:gap-3 ${cols} ${className}`}>
      {stats.map((stat) => (
        <div key={stat.label} className="min-w-0 rounded-tremor-default border border-slate-800 bg-slate-900/40 px-3 py-2.5">
          <p className="truncate text-[0.68rem] font-semibold uppercase tracking-wide text-slate-500">{stat.label}</p>
          <p className={`mt-1 truncate font-mono text-lg font-semibold sm:text-xl ${toneClass[stat.tone || 'neutral']}`}>{stat.value}</p>
          {stat.detail ? <p className="mt-0.5 truncate text-xs text-slate-500">{stat.detail}</p> : null}
        </div>
      ))}
    </div>
  );
}

// Detalle bajo demanda usando <details> nativo (accesible, sin estado).
export function Collapsible({
  summary,
  children,
  defaultOpen = false,
  className = '',
}: {
  summary: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}) {
  return (
    <details open={defaultOpen} className={`group rounded-tremor-default border border-slate-800 bg-slate-900/30 ${className}`}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-sm font-semibold text-slate-200 transition hover:text-slate-100">
        <span>{summary}</span>
        <RiArrowDownSLine className="h-4 w-4 shrink-0 text-slate-500 transition group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="border-t border-slate-800 p-3">{children}</div>
    </details>
  );
}
