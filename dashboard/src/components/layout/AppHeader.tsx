import { DatabaseIcon, LockIcon, LogoutIcon, MoonIcon, RefreshIcon, SunIcon, type AppIcon } from '../common/AppIcons';
import { formatDate, formatUpdatedAt } from '../../lib/formatters';
import type { ApiStatus, DashboardData, DashboardUser } from '../../types/dashboard';

export function AppHeader({
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
    <section className="mb-4 rounded-tremor-default border border-slate-800 bg-slate-950/80 p-4 sm:mb-5 sm:p-5 lg:hidden">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass}`}>
              {status === 'live' ? `En vivo${data.source ? ` - ${data.source}` : ''}` : status === 'error' ? 'Error API' : 'Demo'}
            </span>
            <span className="inline-flex h-7 items-center rounded-tremor-default border border-slate-700 bg-slate-900/70 px-2.5 text-xs font-semibold text-slate-300">
              Mes: {data.mes}
            </span>
            <span className="inline-flex h-7 items-center rounded-tremor-default border border-slate-700 bg-slate-900/70 px-2.5 text-xs font-semibold text-slate-300">
              Ciclo: {cycleLabel(data)}
            </span>
          </div>
          <h1 className="text-xl font-semibold text-slate-100 sm:text-3xl">Mayeson Finanzas</h1>
          <p className="mt-1 text-xs text-slate-400 sm:text-sm">Ultima actualizacion: {loading ? 'Actualizando...' : formatUpdatedAt(data.updatedAt)}</p>
        </div>

        <div className="flex flex-col gap-2 min-[420px]:flex-row min-[420px]:flex-wrap min-[420px]:items-center">
          {users.length > 1 ? (
            <select
              className="h-10 w-full rounded-tremor-default border border-slate-700 bg-slate-900/70 px-3 text-sm font-semibold text-slate-200 shadow-sm transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-400/30 min-[420px]:w-auto min-[420px]:min-w-44"
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
          <HeaderButton icon={RefreshIcon} onClick={onRefresh} disabled={loading || syncing}>
            {loading ? 'Actualizando' : 'Actualizar'}
          </HeaderButton>
          {isConfigured ? (
            <HeaderButton icon={DatabaseIcon} onClick={onSyncSheets} disabled={loading || syncing} tone="primary">
              {syncing ? 'Sincronizando' : 'Sync manual'}
            </HeaderButton>
          ) : null}
          <HeaderButton icon={theme === 'dark' ? SunIcon : MoonIcon} onClick={onToggleTheme}>
            {theme === 'dark' ? 'Claro' : 'Oscuro'}
          </HeaderButton>
          {isConfigured ? (
            <>
              <HeaderButton icon={LockIcon} onClick={onTogglePasswordPanel}>
                Clave
              </HeaderButton>
              <HeaderButton icon={LogoutIcon} onClick={onLogout} tone="danger">
                Salir
              </HeaderButton>
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function cycleLabel(data: DashboardData): string {
  if (data.cycleStart && data.cycleEnd) {
    return `${formatDate(data.cycleStart)} - ${formatDate(data.cycleEnd)}`;
  }
  return data.cycleRange || data.cycleLabel || data.mes;
}

function HeaderButton({
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
      className={`inline-flex h-10 w-full min-w-[8.75rem] items-center justify-center gap-2 rounded-tremor-default border px-3 text-sm font-semibold shadow-sm transition focus:outline-none focus:ring-2 focus:ring-emerald-400/30 disabled:cursor-wait disabled:opacity-55 min-[420px]:w-auto ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="truncate">{children}</span>
    </button>
  );
}
