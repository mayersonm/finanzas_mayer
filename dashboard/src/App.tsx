import { Suspense, lazy, type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiEndpoint } from './app/api';
import { isApiConfigured, SESSION_STORAGE_KEY } from './app/config';
import { LoginScreen } from './components/auth/LoginScreen';
import { PasswordPanel } from './components/auth/PasswordPanel';
import { AppHeader } from './components/layout/AppHeader';
import { DashboardSidebar, DashboardTabs } from './components/layout/DashboardTabs';
import { OverviewSection } from './features/overview/OverviewSection';
import { getRealExpenses } from './lib/finance';
import type { ApiStatus, DashboardBootstrapData, DashboardData, DashboardUser, TabId } from './types/dashboard';

const AnalysisSection = lazy(() => import('./features/analysis/AnalysisSection').then((mod) => ({ default: mod.AnalysisSection })));
const AiSection = lazy(() => import('./features/ai/AiSection').then((mod) => ({ default: mod.AiSection })));
const CalendarSection = lazy(() => import('./features/calendar/CalendarSection').then((mod) => ({ default: mod.CalendarSection })));
const CommitmentsSection = lazy(() => import('./features/commitments/CommitmentsSection').then((mod) => ({ default: mod.CommitmentsSection })));
const FreeMoneySection = lazy(() => import('./features/freeMoney/FreeMoneySection').then((mod) => ({ default: mod.FreeMoneySection })));
const GoalsSection = lazy(() => import('./features/goals/GoalsSection').then((mod) => ({ default: mod.GoalsSection })));
const InvestmentsSection = lazy(() => import('./features/investments/InvestmentsSection').then((mod) => ({ default: mod.InvestmentsSection })));
const MovementsSection = lazy(() => import('./features/movements/MovementsSection').then((mod) => ({ default: mod.MovementsSection })));
const NetWorthSection = lazy(() => import('./features/netWorth/NetWorthSection').then((mod) => ({ default: mod.NetWorthSection })));
const SettingsSection = lazy(() => import('./features/settings/SettingsSection').then((mod) => ({ default: mod.SettingsSection })));

type Theme = 'light' | 'dark';

const LOGIN_EMAIL_STORAGE_KEY = 'finanzas_dashboard_email';
const DEFAULT_LOGIN_EMAIL = 'mayersonm@gmail.com';

function getInitialTheme(): Theme {
  const stored = window.localStorage.getItem('finanzas_theme');
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.classList.toggle('dark', theme === 'dark');
  window.localStorage.setItem('finanzas_theme', theme);
}

export default function App() {
  const [data, setData] = useState<DashboardData>(() => createEmptyDashboard());
  const [tab, setTab] = useState<TabId>('inicio');
  const [loading, setLoading] = useState(() => Boolean(isApiConfigured() && window.localStorage.getItem(SESSION_STORAGE_KEY)));
  const [hasLoadedData, setHasLoadedData] = useState(false);
  const [status, setStatus] = useState<ApiStatus>('demo');
  const [token, setToken] = useState<string | null>(() => window.localStorage.getItem(SESSION_STORAGE_KEY));
  const [loginEmail, setLoginEmail] = useState(() => window.localStorage.getItem(LOGIN_EMAIL_STORAGE_KEY) || DEFAULT_LOGIN_EMAIL);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [showPasswordPanel, setShowPasswordPanel] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [theme, setTheme] = useState<Theme>(() => getInitialTheme());
  const [users, setUsers] = useState<DashboardUser[]>([]);
  const [selectedChatId, setSelectedChatId] = useState('');
  const [exchangeRate, setExchangeRate] = useState(3.85);
  const selectedChatIdRef = useRef('');
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [syncError, setSyncError] = useState('');

  const configured = isApiConfigured();
  const realExpenses = useMemo(() => getRealExpenses(data), [data]);

  const clearSession = useCallback((message = 'Sesion expirada. Ingresa nuevamente.') => {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    setToken(null);
    selectedChatIdRef.current = '';
    setAuthError(message);
    setStatus('error');
  }, []);

  const fetchData = useCallback(async (sessionToken?: string | null, chatIdOverride?: string) => {
    const activeToken = sessionToken ?? token;
    if (!configured || !activeToken) return;

    setLoading(true);
    try {
      const url = new URL(apiEndpoint('bootstrap'));
      const requestedChatId = chatIdOverride ?? selectedChatIdRef.current;
      if (requestedChatId) url.searchParams.set('chat_id', requestedChatId);

      const response = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${activeToken}` },
      });

      if (response.status === 401) {
        clearSession();
        return;
      }

      const result = (await response.json()) as DashboardBootstrapData;
      const nextData = result.dashboard;
      if (!response.ok || result.ok === false || result.error || !nextData) {
        throw new Error(result.error || 'Respuesta invalida');
      }

      setData(nextData);
      setHasLoadedData(true);
      setUsers(result.users || []);
      setExchangeRate(Number(result.exchangeRate || nextData.exchangeRate || 3.85) || 3.85);
      const resolvedChatId = requestedChatId || result.defaultChatId || result.users?.[0]?.chatId || '';
      if (resolvedChatId) {
        selectedChatIdRef.current = resolvedChatId;
        setSelectedChatId((current) => current || resolvedChatId);
      }
      setStatus('live');
    } catch (error) {
      console.error('API error:', error);
      setStatus('error');
    } finally {
      setLoading(false);
    }
  }, [clearSession, configured, token]);

  const syncSheetsToD1 = useCallback(async () => {
    if (!configured || !token) return;

    setSyncing(true);
    setSyncMessage('');
    setSyncError('');
    try {
      const url = new URL(apiEndpoint('sync'));
      url.searchParams.set('limit', '500');
      if (selectedChatId) url.searchParams.set('chat_id', selectedChatId);

      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.status === 401) {
        clearSession();
        return;
      }

      const result = (await response.json()) as {
        ok?: boolean;
        error?: string;
        transactions?: number;
        budgets?: number;
        fixedExpenses?: number;
        debts?: number;
        goals?: number;
        removedTransactions?: number;
        mirrorTransactions?: boolean;
      };

      if (!response.ok || result.ok === false) {
        throw new Error(result.error || 'No se pudo sincronizar Sheets con D1');
      }

      const removedText = result.removedTransactions
        ? `, ${result.removedTransactions} extra${result.removedTransactions === 1 ? '' : 's'} removido${result.removedTransactions === 1 ? '' : 's'} de D1`
        : '';
      const mirrorText = result.mirrorTransactions === false
        ? ' No se podaron extras porque Sheets devolvio una lista parcial.'
        : '';
      setSyncMessage(`Sheets a D1: ${result.transactions || 0} movimientos${removedText}, ${result.budgets || 0} presupuestos, ${result.fixedExpenses || 0} fijos, ${result.debts || 0} deudas y ${result.goals || 0} metas revisadas.${mirrorText}`);
      await fetchData(token);
    } catch (error) {
      console.error('Sync error:', error);
      setSyncError(error instanceof Error ? error.message : 'No se pudo sincronizar Sheets con D1');
      setStatus('error');
    } finally {
      setSyncing(false);
    }
  }, [clearSession, configured, fetchData, selectedChatId, token]);

  const handleSelectedChatIdChange = useCallback((chatId: string) => {
    selectedChatIdRef.current = chatId;
    setSelectedChatId(chatId);
    void fetchData(undefined, chatId);
  }, [fetchData]);

  const handleLogin = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanEmail = loginEmail.trim().toLowerCase();
    const cleanPassword = password.trim();
    if (!cleanEmail || !cleanPassword) return;

    setAuthLoading(true);
    setAuthError('');

    try {
      const response = await fetch(apiEndpoint('login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, password: cleanPassword }),
      });
      const result = await response.json() as { ok?: boolean; token?: string; error?: string };

      if (!response.ok || !result.ok || !result.token) {
        throw new Error(result.error || 'No se pudo iniciar sesion');
      }

      window.localStorage.setItem(SESSION_STORAGE_KEY, result.token);
      window.localStorage.setItem(LOGIN_EMAIL_STORAGE_KEY, cleanEmail);
      setToken(result.token);
      setHasLoadedData(false);
      setLoginEmail(cleanEmail);
      setPassword('');
      setStatus('demo');
    } catch (error) {
      console.error('Login error:', error);
      setAuthError('Usuario, clave o API no disponible.');
    } finally {
      setAuthLoading(false);
    }
  }, [loginEmail, password]);

  const handleLogout = useCallback(() => {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    setToken(null);
    setData(createEmptyDashboard());
    setHasLoadedData(false);
    setStatus('demo');
    setAuthError('');
    setUsers([]);
    selectedChatIdRef.current = '';
    setSelectedChatId('');
    void fetch(apiEndpoint('logout'), { method: 'POST' }).catch(() => undefined);
  }, []);

  const handleChangePassword = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) return;

    if (newPassword.length < 12) {
      setPasswordError('La nueva clave debe tener al menos 12 caracteres.');
      setPasswordSuccess('');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('La confirmacion no coincide.');
      setPasswordSuccess('');
      return;
    }

    setPasswordLoading(true);
    setPasswordError('');
    setPasswordSuccess('');

    try {
      const response = await fetch(apiEndpoint('password'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const result = await response.json() as { ok?: boolean; token?: string; error?: string };

      if (!response.ok || !result.ok || !result.token) {
        throw new Error(result.error || 'No se pudo cambiar la clave');
      }

      window.localStorage.setItem(SESSION_STORAGE_KEY, result.token);
      setToken(result.token);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordSuccess('Clave actualizada. Usa esta nueva clave en el proximo login.');
    } catch (error) {
      console.error('Password change error:', error);
      setPasswordError('No se pudo cambiar la clave. Revisa la clave actual.');
    } finally {
      setPasswordLoading(false);
    }
  }, [confirmPassword, currentPassword, newPassword, token]);

  useEffect(() => {
    if (configured || token) return undefined;
    let cancelled = false;

    void import('./data/mockDashboard').then(({ MOCK_DASHBOARD }) => {
      if (!cancelled) {
        setData(MOCK_DASHBOARD);
        setHasLoadedData(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [configured, token]);

  useEffect(() => {
    if (!configured || !token) return;
    void fetchData(token);
  }, [fetchData, configured, token]);

  useEffect(() => {
    if (!configured || !token) return undefined;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void fetchData(token);
    }, 180000);
    return () => window.clearInterval(timer);
  }, [fetchData, configured, token]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.classList.toggle('dark', theme === 'dark');
    window.localStorage.setItem('finanzas_theme', theme);
  }, [theme]);

  if (configured && !token) {
    return (
      <LoginScreen
        email={loginEmail}
        password={password}
        error={authError}
        loading={authLoading}
        onEmailChange={setLoginEmail}
        onPasswordChange={setPassword}
        onSubmit={handleLogin}
      />
    );
  }

  const showInitialSkeleton = configured && Boolean(token) && !hasLoadedData && status !== 'error';

  return (
    <main className="min-h-screen px-3 py-3 sm:px-6 sm:py-5 lg:px-6 xl:px-8">
      <div className={`mx-auto flex w-full max-w-[96rem] gap-5 ${showPasswordPanel ? 'pointer-events-none blur-sm' : ''}`}>
        <DashboardSidebar activeTab={tab} onTabChange={setTab} />

        <div className="min-w-0 flex-1">
          <AppHeader
            data={data}
            loading={loading}
            status={status}
            isConfigured={configured}
            onRefresh={() => void fetchData()}
            onSyncSheets={() => void syncSheetsToD1()}
            syncing={syncing}
            theme={theme}
            onToggleTheme={() => {
              setTheme((value) => {
                const nextTheme = value === 'dark' ? 'light' : 'dark';
                applyTheme(nextTheme);
                return nextTheme;
              });
            }}
            onTogglePasswordPanel={() => {
              setPasswordError('');
              setPasswordSuccess('');
              setShowPasswordPanel(true);
            }}
            onLogout={handleLogout}
            users={users}
            selectedChatId={selectedChatId}
            onSelectedChatIdChange={handleSelectedChatIdChange}
          />

          {syncMessage ? (
            <div className="mb-4 rounded-tremor-default border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm font-medium text-emerald-100">
              {syncMessage}
            </div>
          ) : null}

          {syncError ? (
            <div className="mb-4 rounded-tremor-default border border-rose-400/30 bg-rose-500/10 p-3 text-sm font-medium text-rose-100">
              {syncError}
            </div>
          ) : null}

          <DashboardTabs activeTab={tab} onTabChange={setTab} />

          {showInitialSkeleton ? (
            <DashboardSkeleton />
          ) : (
            <Suspense fallback={<PanelSkeleton />}>
              {tab === 'inicio' ? (
                <OverviewSection
                  data={data}
                  realExpenses={realExpenses}
                  authToken={token}
                  chatId={selectedChatId}
                  onChanged={() => void fetchData()}
                  onSyncSheets={() => void syncSheetsToD1()}
                  syncing={syncing}
                />
              ) : null}
              {tab === 'movimientos' ? <MovementsSection data={data} authToken={token} chatId={selectedChatId} onChanged={() => void fetchData()} /> : null}
              {tab === 'compromisos' ? <CommitmentsSection data={data} realExpenses={realExpenses} exchangeRate={exchangeRate} authToken={token} chatId={selectedChatId} onChanged={() => void fetchData()} /> : null}
              {tab === 'dinero' ? <FreeMoneySection data={data} /> : null}
              {tab === 'calendario' ? <CalendarSection data={data} authToken={token} chatId={selectedChatId} /> : null}
              {tab === 'patrimonio' ? <NetWorthSection authToken={token} chatId={selectedChatId} /> : null}
              {tab === 'inversiones' ? <InvestmentsSection authToken={token} chatId={selectedChatId} exchangeRate={exchangeRate} /> : null}
              {tab === 'ia' ? <AiSection data={data} authToken={token} chatId={selectedChatId} /> : null}
              {tab === 'analisis' ? <AnalysisSection data={data} /> : null}
              {tab === 'metas' ? <GoalsSection data={data} /> : null}
              {tab === 'configuracion' ? <SettingsSection authToken={token} chatId={selectedChatId} /> : null}
            </Suspense>
          )}

          {!configured ? (
            <div className="mt-4 rounded-tremor-default border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100 sm:mt-5">
              Configura `VITE_GAS_API_URL` para conectar el dashboard con D1.
            </div>
          ) : null}
        </div>
      </div>

      {showPasswordPanel ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-xl">
            <PasswordPanel
              currentPassword={currentPassword}
              newPassword={newPassword}
              confirmPassword={confirmPassword}
              error={passwordError}
              success={passwordSuccess}
              loading={passwordLoading}
              onCurrentPasswordChange={setCurrentPassword}
              onNewPasswordChange={setNewPassword}
              onConfirmPasswordChange={setConfirmPassword}
              onSubmit={handleChangePassword}
              onClose={() => setShowPasswordPanel(false)}
            />
          </div>
        </div>
      ) : null}
    </main>
  );
}

function DashboardSkeleton() {
  return (
    <div className="grid gap-4" aria-label="Cargando dashboard">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
        <SkeletonCard className="min-h-[17rem]">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div className="grid gap-2">
              <SkeletonLine className="h-6 w-28" />
              <SkeletonLine className="h-5 w-44" />
            </div>
            <SkeletonLine className="h-7 w-24" />
          </div>
          <SkeletonLine className="h-4 w-28" />
          <SkeletonLine className="mt-3 h-12 w-64 max-w-full" />
          <SkeletonLine className="mt-4 h-4 w-full max-w-xl" />
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <SkeletonBlock />
            <SkeletonBlock />
          </div>
        </SkeletonCard>

        <SkeletonCard className="min-h-[17rem]">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div className="grid gap-2">
              <SkeletonLine className="h-5 w-36" />
              <SkeletonLine className="h-4 w-48" />
            </div>
            <SkeletonLine className="h-7 w-24" />
          </div>
          <div className="grid gap-4">
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </div>
          <SkeletonLine className="mt-5 h-2 w-full" />
        </SkeletonCard>
      </div>

      <SkeletonCard className="min-h-[11rem]">
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="grid gap-3">
            <SkeletonLine className="h-5 w-40" />
            <SkeletonLine className="h-4 w-full max-w-lg" />
            <div className="grid gap-3 sm:grid-cols-2">
              <SkeletonBlock />
              <SkeletonBlock />
            </div>
          </div>
          <div className="grid gap-3">
            <SkeletonLine className="h-5 w-36" />
            <SkeletonRow />
            <SkeletonRow />
          </div>
        </div>
      </SkeletonCard>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)]">
        <SkeletonCard className="min-h-[14rem]">
          <SkeletonLine className="h-5 w-40" />
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <SkeletonBlock />
            <SkeletonBlock />
            <SkeletonBlock />
          </div>
        </SkeletonCard>
        <SkeletonCard className="min-h-[14rem]">
          <SkeletonLine className="h-5 w-44" />
          <SkeletonLine className="mt-5 h-2 w-full" />
          <div className="mt-5 grid gap-3">
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </div>
        </SkeletonCard>
      </div>
    </div>
  );
}

function PanelSkeleton() {
  return (
    <SkeletonCard className="min-h-[12rem]">
      <SkeletonLine className="h-5 w-40" />
      <SkeletonLine className="mt-4 h-4 w-full max-w-xl" />
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <SkeletonBlock />
        <SkeletonBlock />
        <SkeletonBlock />
      </div>
    </SkeletonCard>
  );
}

function SkeletonCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-tremor-default border border-slate-800 bg-slate-950/70 p-4 shadow-sm sm:p-6 ${className}`}>
      <div className="animate-pulse">{children}</div>
    </div>
  );
}

function SkeletonBlock() {
  return (
    <div className="rounded-tremor-default border border-slate-800 bg-slate-900/30 p-3">
      <SkeletonLine className="h-4 w-24" />
      <SkeletonLine className="mt-3 h-6 w-32" />
      <SkeletonLine className="mt-3 h-3 w-full" />
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_6rem] gap-3 border-t border-slate-800 pt-3 first:border-t-0 first:pt-0">
      <div>
        <SkeletonLine className="h-4 w-36" />
        <SkeletonLine className="mt-2 h-3 w-full" />
      </div>
      <SkeletonLine className="h-5 w-24" />
    </div>
  );
}

function SkeletonLine({ className = '' }: { className?: string }) {
  return <div className={`rounded bg-slate-800/80 ${className}`} />;
}

function createEmptyDashboard(): DashboardData {
  return {
    balance: 0,
    patrimonio: 0,
    patrimonioDisponible: 0,
    balanceGeneralNeto: 0,
    balanceNeto: 0,
    ingresos: 0,
    gastos: 0,
    ingresosMes: 0,
    gastosMes: 0,
    balanceMes: 0,
    movimientos: 0,
    movimientosMes: 0,
    mes: 'Cargando',
    transacciones: [],
    categorias: [],
    meses: [],
    presupuestos: [],
    metas: [],
  };
}
