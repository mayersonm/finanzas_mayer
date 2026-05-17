import { Suspense, lazy, type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { apiEndpoint } from './app/api';
import { isApiConfigured, SESSION_STORAGE_KEY } from './app/config';
import { LoginScreen } from './components/auth/LoginScreen';
import { PasswordPanel } from './components/auth/PasswordPanel';
import { AppHeader } from './components/layout/AppHeader';
import { DashboardTabs } from './components/layout/DashboardTabs';
import { MOCK_DASHBOARD } from './data/mockDashboard';
import { getRealExpenses } from './lib/finance';
import type { ApiStatus, DashboardData, DashboardUser, TabId } from './types/dashboard';

const AnalysisSection = lazy(() => import('./features/analysis/AnalysisSection').then((mod) => ({ default: mod.AnalysisSection })));
const AdminSection = lazy(() => import('./features/admin/AdminSection').then((mod) => ({ default: mod.AdminSection })));
const CommitmentsSection = lazy(() => import('./features/commitments/CommitmentsSection').then((mod) => ({ default: mod.CommitmentsSection })));
const GoalsSection = lazy(() => import('./features/goals/GoalsSection').then((mod) => ({ default: mod.GoalsSection })));
const HealthSection = lazy(() => import('./features/health/HealthSection').then((mod) => ({ default: mod.HealthSection })));
const MovementsSection = lazy(() => import('./features/movements/MovementsSection').then((mod) => ({ default: mod.MovementsSection })));
const OverviewSection = lazy(() => import('./features/overview/OverviewSection').then((mod) => ({ default: mod.OverviewSection })));
const SettingsSection = lazy(() => import('./features/settings/SettingsSection').then((mod) => ({ default: mod.SettingsSection })));

type Theme = 'light' | 'dark';

interface FetchOptions {
  sync?: boolean;
}

export default function App() {
  const [data, setData] = useState<DashboardData>(MOCK_DASHBOARD);
  const [tab, setTab] = useState<TabId>('inicio');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<ApiStatus>('demo');
  const [token, setToken] = useState<string | null>(() => window.localStorage.getItem(SESSION_STORAGE_KEY));
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
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = window.localStorage.getItem('finanzas_theme');
    if (stored === 'light' || stored === 'dark') return stored;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  });
  const [users, setUsers] = useState<DashboardUser[]>([]);
  const [selectedChatId, setSelectedChatId] = useState('');

  const configured = isApiConfigured();
  const realExpenses = useMemo(() => getRealExpenses(data), [data]);

  const fetchData = useCallback(async (sessionToken?: string | null, options: FetchOptions = {}) => {
    const activeToken = sessionToken ?? token;
    if (!configured || !activeToken) return;

    setLoading(true);
    try {
      if (options.sync) {
        const syncResponse = await fetch(apiEndpoint('sync'), {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${activeToken}`,
          },
        });

        if (syncResponse.status === 401) {
          window.localStorage.removeItem(SESSION_STORAGE_KEY);
          setToken(null);
          setAuthError('Sesion expirada. Ingresa nuevamente.');
          setStatus('error');
          return;
        }

        const syncData = (await syncResponse.json()) as { ok?: boolean; error?: string };
        if (!syncResponse.ok || syncData.ok === false) {
          throw new Error(syncData.error || 'No se pudo sincronizar con Sheets');
        }
      }

      const url = new URL(apiEndpoint('dashboard'));
      if (selectedChatId) url.searchParams.set('chat_id', selectedChatId);

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${activeToken}`,
        },
      });

      if (response.status === 401) {
        window.localStorage.removeItem(SESSION_STORAGE_KEY);
        setToken(null);
        setAuthError('Sesion expirada. Ingresa nuevamente.');
        setStatus('error');
        return;
      }

      const nextData = (await response.json()) as DashboardData;

      if (!response.ok || nextData.ok === false || nextData.error) {
        throw new Error(nextData.error || 'Respuesta invalida');
      }

      setData(nextData);
      setStatus('live');
    } catch (error) {
      console.error('API error:', error);
      setStatus('error');
    } finally {
      setLoading(false);
    }
  }, [configured, selectedChatId, token]);

  const fetchUsers = useCallback(async (sessionToken?: string | null) => {
    const activeToken = sessionToken ?? token;
    if (!configured || !activeToken) return;

    try {
      const response = await fetch(apiEndpoint('users'), {
        headers: { Authorization: `Bearer ${activeToken}` },
      });
      const result = await response.json() as { ok?: boolean; users?: DashboardUser[]; defaultChatId?: string };
      if (response.ok && result.ok !== false) {
        setUsers(result.users || []);
        setSelectedChatId((current) => current || result.defaultChatId || result.users?.[0]?.chatId || '');
      }
    } catch (error) {
      console.error('Users error:', error);
    }
  }, [configured, token]);

  const handleLogin = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanPassword = password.trim();
    if (!cleanPassword) return;

    setAuthLoading(true);
    setAuthError('');

    try {
      const response = await fetch(apiEndpoint('login'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password: cleanPassword }),
      });
      const result = await response.json() as { ok?: boolean; token?: string; error?: string };

      if (!response.ok || !result.ok || !result.token) {
        throw new Error(result.error || 'No se pudo iniciar sesion');
      }

      window.localStorage.setItem(SESSION_STORAGE_KEY, result.token);
      setToken(result.token);
      setPassword('');
      setStatus('demo');
      await fetchUsers(result.token);
      await fetchData(result.token);
    } catch (error) {
      console.error('Login error:', error);
      setAuthError('Clave incorrecta o API no disponible.');
    } finally {
      setAuthLoading(false);
    }
  }, [fetchData, password]);

  const handleLogout = useCallback(() => {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    setToken(null);
    setData(MOCK_DASHBOARD);
    setStatus('demo');
    setAuthError('');
    setUsers([]);
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
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
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
      await fetchData(result.token);
    } catch (error) {
      console.error('Password change error:', error);
      setPasswordError('No se pudo cambiar la clave. Revisa la clave actual.');
    } finally {
      setPasswordLoading(false);
    }
  }, [confirmPassword, currentPassword, fetchData, newPassword, token]);

  useEffect(() => {
    if (!configured || !token) return;
    void fetchData(token);
    void fetchUsers(token);
  }, [fetchData, configured, token]);

  useEffect(() => {
    if (!configured || !token) return undefined;
    const timer = window.setInterval(() => void fetchData(token), 60000);
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
        password={password}
        error={authError}
        loading={authLoading}
        onPasswordChange={setPassword}
        onSubmit={handleLogin}
      />
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-3 py-3 sm:px-6 sm:py-5 lg:px-8">
      <div  className={showPasswordPanel ? 'pointer-events-none blur-sm' : ''}>
         <AppHeader
          data         ={data}
          loading      ={loading}
          status       ={status}
          isConfigured ={configured}
          onRefresh    ={() => void fetchData(undefined, { sync: true })}
          theme        ={theme}
          onToggleTheme={() => setTheme((value) => (value === 'dark' ? 'light' : 'dark'))}
          onTogglePasswordPanel={() => {
            setPasswordError('');
            setPasswordSuccess('');
            setShowPasswordPanel(true);
          }}
          onLogout={handleLogout}
          users={users}
          selectedChatId={selectedChatId}
          onSelectedChatIdChange={setSelectedChatId}
        />

        <DashboardTabs activeTab={tab} onTabChange={setTab} />

        <Suspense fallback={<div className="rounded-tremor-default border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-300">Cargando...</div>}>
          {tab === 'inicio' ? <OverviewSection data={data} realExpenses={realExpenses} /> : null}
          {tab === 'movimientos' ? <MovementsSection data={data} authToken={token} chatId={selectedChatId} onChanged={() => void fetchData()} /> : null}
          {tab === 'compromisos' ? <CommitmentsSection data={data} realExpenses={realExpenses} /> : null}
          {tab === 'analisis' ? <AnalysisSection data={data} /> : null}
          {tab === 'metas' ? <GoalsSection data={data} /> : null}
          {tab === 'salud' ? <HealthSection authToken={token} /> : null}
          {tab === 'configuracion' ? <SettingsSection authToken={token} chatId={selectedChatId} /> : null}
          {tab === 'admin' ? <AdminSection authToken={token} chatId={selectedChatId} users={users} /> : null}
        </Suspense>
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
