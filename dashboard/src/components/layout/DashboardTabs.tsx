import { tabs } from '../../app/tabs';
import type { TabId } from '../../types/dashboard';

export function DashboardTabs({
  activeTab,
  onTabChange,
}: {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}) {
  return (
    <nav className="mb-4 sm:mb-5" aria-label="Secciones del dashboard">
      <div className="grid grid-cols-2 gap-2 min-[420px]:grid-cols-3 sm:grid-cols-5">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-current={activeTab === item.id ? 'page' : undefined}
            className={`flex h-12 min-w-0 items-center justify-center gap-2 rounded-tremor-default border px-3 text-xs font-semibold leading-tight transition sm:h-11 sm:text-sm ${
              activeTab === item.id
                ? 'border-emerald-400/70 bg-emerald-500/15 text-emerald-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                : 'border-slate-800 bg-slate-950/70 text-slate-400 hover:border-slate-700 hover:bg-slate-900/80 hover:text-slate-100'
            }`}
            onClick={() => onTabChange(item.id)}
          >
            <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 whitespace-normal text-center">{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
