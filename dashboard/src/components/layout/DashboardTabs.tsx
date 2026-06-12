import { tabs } from '../../app/tabs';
import type { TabId } from '../../types/dashboard';

const tabGroups: Array<{ label: string; ids: TabId[] }> = [
  { label: 'Operacion', ids: ['inicio', 'movimientos', 'compromisos'] },
  { label: 'Plan', ids: ['dinero', 'calendario', 'metas'] },
  { label: 'Crecimiento', ids: ['patrimonio', 'inversiones', 'ia', 'analisis'] },
  { label: 'Sistema', ids: ['configuracion'] },
];

const tabById = tabs.reduce<Record<TabId, (typeof tabs)[number]>>((acc, tab) => {
  acc[tab.id] = tab;
  return acc;
}, {} as Record<TabId, (typeof tabs)[number]>);

export function DashboardTabs({
  activeTab,
  onTabChange,
}: {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}) {
  return (
    <nav className="mb-4 lg:hidden" aria-label="Secciones del dashboard">
      <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 sm:mx-0 sm:px-0">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-current={activeTab === item.id ? 'page' : undefined}
            className={`flex h-10 min-w-[8.25rem] shrink-0 items-center justify-center gap-2 rounded-tremor-default border px-3 text-xs font-semibold leading-tight transition ${
              activeTab === item.id
                ? 'border-emerald-400/70 bg-emerald-500/15 text-emerald-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                : 'border-slate-800 bg-slate-950/70 text-slate-400 hover:border-slate-700 hover:bg-slate-900/80 hover:text-slate-100'
            }`}
            onClick={() => onTabChange(item.id)}
          >
            <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 truncate text-center">{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}

export function DashboardSidebar({
  activeTab,
  onTabChange,
}: {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}) {
  return (
    <aside className="sticky top-5 hidden h-[calc(100vh-2.5rem)] w-56 shrink-0 flex-col rounded-tremor-default border border-slate-800 bg-slate-950/80 p-2.5 shadow-sm lg:flex">
      <div className="border-b border-slate-800 px-2 pb-3 pt-1">
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-emerald-300">Finanzas</p>
        <p className="mt-1 text-base font-semibold text-slate-100">Mayeson</p>
      </div>

      <nav className="mt-3 flex-1 overflow-y-auto pr-1" aria-label="Menu principal">
        <div className="space-y-4">
          {tabGroups.map((group) => (
            <div key={group.label}>
              <p className="mb-2 px-2 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-slate-500">
                {group.label}
              </p>
              <div className="space-y-1">
                {group.ids.map((id) => {
                  const item = tabById[id];
                  const active = activeTab === item.id;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-current={active ? 'page' : undefined}
                      className={`flex h-9 w-full items-center gap-2.5 rounded-tremor-default border px-2.5 text-left text-sm font-semibold transition ${
                        active
                          ? 'border-emerald-400/60 bg-emerald-500/15 text-emerald-100'
                          : 'border-transparent text-slate-400 hover:border-slate-800 hover:bg-slate-900/70 hover:text-slate-100'
                      }`}
                      onClick={() => onTabChange(item.id)}
                    >
                      <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span className="min-w-0 truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </nav>
    </aside>
  );
}
