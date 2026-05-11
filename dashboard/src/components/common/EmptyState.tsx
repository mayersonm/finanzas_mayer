export function EmptyState({ children }: { children: string }) {
  return (
    <div className="rounded-tremor-default border border-dashed border-slate-800 bg-slate-900/40 p-5 text-sm text-slate-400">
      {children}
    </div>
  );
}
