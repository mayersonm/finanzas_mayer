type KpiTone = 'emerald' | 'rose' | 'amber' | 'violet' | 'sky' | 'cyan' | string;

const toneClasses: Record<string, string> = {
  emerald: 'border-t-emerald-400',
  rose: 'border-t-rose-400',
  amber: 'border-t-amber-400',
  violet: 'border-t-violet-400',
  sky: 'border-t-sky-400',
  cyan: 'border-t-cyan-400',
};

export function KpiCard({
  label,
  value,
  detail,
  color,
}: {
  label: string;
  value: string;
  detail: string;
  color: KpiTone;
}) {
  return (
    <article className={`rounded-tremor-default border border-t-4 border-slate-800 bg-slate-950/70 p-4 shadow-sm ${toneClasses[color] || toneClasses.sky} sm:p-6`}>
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-2 truncate font-mono text-xl font-semibold text-slate-100 sm:text-3xl">{value}</p>
      <p className="mt-2 truncate text-sm text-slate-400">{detail}</p>
    </article>
  );
}
