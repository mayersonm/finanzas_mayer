import { tabs } from '../../app/tabs';
import { DatabaseIcon, LockIcon, LogoutIcon, MoonIcon, RefreshIcon, SunIcon, type AppIcon } from '../common/AppIcons';
import { formatDate, formatUpdatedAt } from '../../lib/formatters';
import type { ApiStatus, DashboardData, DashboardUser, TabId } from '../../types/dashboard';

const tabGroups: Array<{ label: string; ids: TabId[] }> = [
  { label: 'Operacion', ids: ['inicio', 'movimientos', 'compromisos'] },
  { label: 'Plan', ids: ['dinero', 'calendario', 'trabajo', 'metas'] },
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
  data,
  loading,
  status,
  isConfigured,
  onRefresh,
  onSyncSheets,
  syncing,
  theme,
  onToggleTheme,
  onTogglePasswordPanel,
  onLogout,
  users,
  selectedChatId,
  onSelectedChatIdChange,
}: {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  data: DashboardData;
  loading: boolean;
  status: ApiStatus;
  isConfigured: boolean;
  onRefresh: () => void;
  onSyncSheets: () => void;
  syncing: boolean;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onTogglePasswordPanel: () => void;
  onLogout: () => void;
  users: DashboardUser[];
  selectedChatId: string;
  onSelectedChatIdChange: (chatId: string) => void;
}) {
  const statusClass = status === 'live' ? 'bg-emerald-500/15 text-emerald-200'
    : status === 'error' ? 'bg-rose-500/15 text-rose-200'
      : 'bg-slate-500/15 text-slate-300';

  return (
    <aside className="sticky top-0 hidden h-full w-64 shrink-0 flex-col rounded-tremor-default border border-slate-800 bg-slate-950/80 p-3 shadow-sm lg:flex">
      <div className="border-b border-slate-800 px-2 pb-3 pt-1">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-emerald-300">Finanzas</p>
            <p className="mt-1 text-base font-semibold text-slate-100">Mayeson</p>
          </div>
          <span className={`rounded-full px-2 py-0.5 text-[0.68rem] font-semibold ${statusClass}`}>
            {status === 'live' ? 'Live' : status === 'error' ? 'Error' : 'Demo'}
          </span>
        </div>
        <div className="mt-3 grid gap-2 rounded-tremor-default border border-slate-800 bg-slate-900/30 p-2.5">
          <SidebarMeta label="Mes" value={data.mes} />
          <SidebarMeta label="Ciclo" value={cycleLabel(data)} />
          <SidebarMeta label="Actualizado" value={loading ? 'Actualizando...' : formatUpdatedAt(data.updatedAt)} />
        </div>
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

      <div className="mt-3 border-t border-slate-800 pt-3">
        {users.length > 1 ? (
          <select
            className="mb-2 h-10 w-full rounded-tremor-default border border-slate-700 bg-slate-900/70 px-3 text-sm font-semibold text-slate-200 shadow-sm transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-400/30"
            value={selectedChatId}
            onChange={(event) => onSelectedChatIdChange(event.target.value)}
            aria-label="Usuario"
          >
            {users.map((user) => (
              <option key={user.chatId} value={user.chatId}>
                {user.label}
              </option>
            ))}
          </select>
        ) : null}
        <div className="grid gap-2">
          <SidebarButton icon={RefreshIcon} onClick={onRefresh} disabled={loading || syncing}>
            {loading ? 'Actualizando' : 'Actualizar'}
          </SidebarButton>
          {isConfigured ? (
            <SidebarButton icon={DatabaseIcon} onClick={onSyncSheets} disabled={loading || syncing} tone="primary">
              {syncing ? 'Sincronizando' : 'Sync manual'}
            </SidebarButton>
          ) : null}
          <SidebarButton icon={theme === 'dark' ? SunIcon : MoonIcon} onClick={onToggleTheme}>
            {theme === 'dark' ? 'Tema claro' : 'Tema oscuro'}
          </SidebarButton>
          {isConfigured ? (
            <div className="grid grid-cols-2 gap-2">
              <SidebarButton icon={LockIcon} onClick={onTogglePasswordPanel}>
                Clave
              </SidebarButton>
              <SidebarButton icon={LogoutIcon} onClick={onLogout} tone="danger">
                Salir
              </SidebarButton>
            </div>
          ) : null}
        </div>
      </div>
    </aside>
  );
}

function SidebarMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[0.64rem] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-0.5 truncate text-xs font-semibold text-slate-200" title={value}>{value}</p>
    </div>
  );
}

function SidebarButton({
  icon: Icon,
  children,
  onClick,
  disabled,
  tone = 'secondary',
}: {
  icon: AppIcon;
  children: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: 'primary' | 'secondary' | 'danger';
}) {
  const className = tone === 'primary'
    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100 hover:border-emerald-400/60 hover:bg-emerald-500/15'
    : tone === 'danger'
      ? 'border-rose-500/30 bg-rose-500/10 text-rose-200 hover:border-rose-400/50 hover:bg-rose-500/15'
      : 'border-slate-700 bg-slate-900/70 text-slate-200 hover:border-slate-600 hover:bg-slate-800/90';

  return (
    <button
      type="button"
      className={`inline-flex h-9 min-w-0 items-center justify-center gap-2 rounded-tremor-default border px-2.5 text-xs font-semibold shadow-sm transition focus:outline-none focus:ring-2 focus:ring-emerald-400/30 disabled:cursor-wait disabled:opacity-55 ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0 truncate">{children}</span>
    </button>
  );
}

function cycleLabel(data: DashboardData): string {
  if (data.cycleStart && data.cycleEnd) {
    return `${formatDate(data.cycleStart)} - ${formatDate(data.cycleEnd)}`;
  }
  return data.cycleRange || data.cycleLabel || data.mes;
}
