import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  AreaChart,
  Badge,
  BarChart,
  Button,
  Card,
  DonutChart,
  Metric,
  ProgressBar,
  Tab,
  TabGroup,
  TabList,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  Text,
  Title,
  type Color,
} from '@tremor/react';
import {
  RiBankCardLine,
  RiDashboardLine,
  RiFileList3Line,
  RiFundsBoxLine,
  RiLockPasswordLine,
  RiLogoutBoxRLine,
  RiRefreshLine,
  RiShieldKeyholeLine,
  RiWallet3Line,
} from '@remixicon/react';

type TxType = 'ingreso' | 'gasto';
type TabId = 'inicio' | 'movimientos' | 'compromisos' | 'analisis' | 'metas';
type ApiStatus = 'demo' | 'live' | 'error';

interface Transaction {
  id?: string;
  fecha: string;
  hora?: string;
  tipo: TxType;
  desc: string;
  cat: string;
  monto: number;
}

interface CategoryTotal {
  cat: string;
  monto: number;
  color: string;
}

interface MonthTotal {
  mes: string;
  key?: string;
  ingresos: number;
  gastos: number;
}

interface Budget {
  cat: string;
  limite: number;
  gasto: number;
}

interface Goal {
  nombre: string;
  objetivo: number;
  ahorrado: number;
}

interface FixedExpense {
  nombre: string;
  monto: number;
  cat: string;
  color?: string;
  pagadoMes?: boolean;
  saltadoMes?: boolean;
  estado?: 'pagado' | 'pendiente' | 'saltado' | string;
}

interface RealExpenses {
  totalFijos: number;
  totalPresupuesto: number;
  total: number;
  regla?: string;
}

interface EmailConfig {
  configured: boolean;
  daily?: string;
  monthly?: string;
  yearly?: string;
}

interface DashboardData {
  ok?: boolean;
  balance: number;
  ingresos: number;
  gastos: number;
  ingresosMes?: number;
  gastosMes: number;
  balanceMes?: number;
  movimientos: number;
  mes: string;
  mesKey?: string;
  transacciones: Transaction[];
  categorias: CategoryTotal[];
  meses: MonthTotal[];
  presupuestos: Budget[];
  fijos?: FixedExpense[];
  gastosReales?: RealExpenses;
  metas: Goal[];
  emailConfig?: EmailConfig;
  source?: string;
  updatedAt?: string;
  error?: string;
}

const API_URL = import.meta.env.VITE_GAS_API_URL || 'https://script.google.com/macros/s/TU_SCRIPT_ID/exec';
const SESSION_STORAGE_KEY = 'finanzas_dashboard_session';

const MOCK: DashboardData = {
  balance: 5350,
  ingresos: 6500,
  gastos: 1150,
  ingresosMes: 6500,
  gastosMes: 1150,
  balanceMes: 5350,
  movimientos: 12,
  mes: 'Mayo',
  mesKey: '2026-05',
  transacciones: [
    { fecha: '2026-05-08', hora: '09:00', tipo: 'ingreso', desc: 'Salario', cat: 'salario', monto: 6500 },
    { fecha: '2026-05-08', hora: '13:20', tipo: 'gasto', desc: 'Almuerzo', cat: 'comida', monto: 60 },
    { fecha: '2026-05-07', hora: '18:30', tipo: 'gasto', desc: 'Taxi', cat: 'transporte', monto: 35 },
    { fecha: '2026-05-06', hora: '20:10', tipo: 'gasto', desc: 'Internet', cat: 'servicios', monto: 120 },
    { fecha: '2026-05-04', hora: '21:00', tipo: 'gasto', desc: 'Netflix', cat: 'entretenimiento', monto: 45 },
  ],
  categorias: [
    { cat: 'Comida', monto: 420, color: '#22c55e' },
    { cat: 'Servicios', monto: 320, color: '#f59e0b' },
    { cat: 'Transporte', monto: 210, color: '#3b82f6' },
    { cat: 'Entretenimiento', monto: 120, color: '#ec4899' },
    { cat: 'Salud', monto: 80, color: '#8b5cf6' },
  ],
  meses: [
    { mes: 'Dic', key: '2025-12', ingresos: 4200, gastos: 2800 },
    { mes: 'Ene', key: '2026-01', ingresos: 4500, gastos: 3100 },
    { mes: 'Feb', key: '2026-02', ingresos: 5000, gastos: 2600 },
    { mes: 'Mar', key: '2026-03', ingresos: 4800, gastos: 3400 },
    { mes: 'Abr', key: '2026-04', ingresos: 5200, gastos: 2900 },
    { mes: 'May', key: '2026-05', ingresos: 6500, gastos: 1150 },
  ],
  presupuestos: [
    { cat: 'Comida', limite: 500, gasto: 420 },
    { cat: 'Servicios', limite: 350, gasto: 320 },
    { cat: 'Transporte', limite: 300, gasto: 210 },
  ],
  fijos: [
    { nombre: 'Alquiler', monto: 1500, cat: 'Servicios', color: '#f59e0b', estado: 'pendiente' },
    { nombre: 'Internet', monto: 120, cat: 'Servicios', color: '#f59e0b', estado: 'pagado', pagadoMes: true },
  ],
  gastosReales: {
    totalFijos: 1620,
    totalPresupuesto: 950,
    total: 2570,
  },
  metas: [
    { nombre: 'Viaje', objetivo: 3000, ahorrado: 1200 },
    { nombre: 'Laptop', objetivo: 5000, ahorrado: 800 },
  ],
  emailConfig: {
    configured: true,
    daily: 'ma***@gmail.com',
    monthly: 'ma***@gmail.com',
    yearly: 'ma***@gmail.com',
  },
  source: 'demo',
};

const tabs: Array<{ id: TabId; label: string; icon: typeof RiDashboardLine }> = [
  { id: 'inicio', label: 'Inicio', icon: RiDashboardLine },
  { id: 'movimientos', label: 'Movimientos', icon: RiFileList3Line },
  { id: 'compromisos', label: 'Compromisos', icon: RiBankCardLine },
  { id: 'analisis', label: 'Analisis', icon: RiFundsBoxLine },
  { id: 'metas', label: 'Metas', icon: RiWallet3Line },
];

const categoryColors: Color[] = ['emerald', 'amber', 'sky', 'rose', 'violet', 'cyan', 'orange', 'teal'];

function apiEndpoint(path: 'dashboard' | 'login' | 'session' | 'logout' | 'password'): string {
  const dashboardUrl = new URL(API_URL);

  if (dashboardUrl.pathname.endsWith('/api/dashboard')) {
    dashboardUrl.pathname = dashboardUrl.pathname.replace(/\/api\/dashboard\/?$/, `/api/${path}`);
    dashboardUrl.search = '';
    return dashboardUrl.toString();
  }

  if (path === 'dashboard') return dashboardUrl.toString();

  dashboardUrl.pathname = `/api/${path}`;
  dashboardUrl.search = '';
  return dashboardUrl.toString();
}

function formatMoney(value: number): string {
  const sign = value < 0 ? '-' : '';
  return `${sign}S/ ${Math.abs(value).toLocaleString('es-PE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value: string): string {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
}

function formatUpdatedAt(value?: string): string {
  if (!value) return 'Sin actualizacion';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('es-PE', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function percent(value: number, total: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0) return 0;
  return Math.min(Math.round((value / total) * 100), 100);
}

function getRealExpenses(data: DashboardData): RealExpenses {
  if (data.gastosReales) return data.gastosReales;

  const totalFijos = (data.fijos || []).reduce((total, item) => total + item.monto, 0);
  const totalPresupuesto = data.presupuestos.reduce((total, item) => {
    return total + (item.gasto > 0 ? item.gasto : item.limite);
  }, 0);

  return {
    totalFijos,
    totalPresupuesto,
    total: totalFijos + totalPresupuesto,
  };
}

function getBudgetConsidered(item: Budget): number {
  return item.gasto > 0 ? item.gasto : item.limite;
}

function budgetColor(pct: number): Color {
  if (pct >= 100) return 'rose';
  if (pct >= 80) return 'amber';
  return 'emerald';
}

function goalColor(pct: number): Color {
  if (pct >= 100) return 'emerald';
  if (pct >= 50) return 'amber';
  return 'sky';
}

function statusColor(status: ApiStatus): Color {
  if (status === 'live') return 'emerald';
  if (status === 'error') return 'rose';
  return 'amber';
}

function fixedStatus(item: FixedExpense): string {
  return item.estado || (item.pagadoMes ? 'pagado' : item.saltadoMes ? 'saltado' : 'pendiente');
}

function fixedStatusColor(status: string): Color {
  if (status === 'pagado') return 'emerald';
  if (status === 'saltado') return 'sky';
  return 'amber';
}

function KpiCard({
  label,
  value,
  detail,
  color,
}: {
  label: string;
  value: string;
  detail: string;
  color: Color;
}) {
  return (
    <Card decoration="top" decorationColor={color} className="rounded-tremor-default">
      <Text>{label}</Text>
      <Metric className="mt-2 truncate text-2xl sm:text-3xl">{value}</Metric>
      <Text className="mt-2">{detail}</Text>
    </Card>
  );
}

function EmptyState({ children }: { children: string }) {
  return (
    <div className="rounded-tremor-default border border-dashed border-slate-800 bg-slate-900/40 p-5 text-sm text-slate-400">
      {children}
    </div>
  );
}

function LoginScreen({
  password,
  error,
  loading,
  onPasswordChange,
  onSubmit,
}: {
  password: string;
  error: string;
  loading: boolean;
  onPasswordChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <main className="grid min-h-screen place-items-center px-4 py-8">
      <Card className="w-full max-w-md rounded-tremor-default border-slate-800 bg-slate-950/80 p-6 shadow-2xl shadow-black/30">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-tremor-default border border-emerald-500/30 bg-emerald-500/10 text-sm font-black text-emerald-200">
            MF
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Badge color="emerald">D1 en vivo</Badge>
            <Badge color="cyan">Privado</Badge>
          </div>
        </div>

        <Badge color="emerald" icon={RiShieldKeyholeLine}>
          Acceso seguro
        </Badge>
        <Title className="mt-4 text-2xl">Mayeson Finanzas</Title>
        <Text className="mt-2">Dashboard personal para revisar gastos, compromisos y metas.</Text>

        <form className="mt-7 space-y-4" onSubmit={onSubmit}>
          <label className="block text-sm font-semibold text-slate-200" htmlFor="password">
            Clave privada
          </label>
          <input
            id="password"
            autoComplete="current-password"
            autoFocus
            type="password"
            value={password}
            onChange={(event) => onPasswordChange(event.target.value)}
            placeholder="Ingresa tu clave"
            className="block h-11 w-full rounded-tremor-default border-slate-700 bg-slate-900 text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:ring-emerald-500"
          />
          {error ? (
            <div className="rounded-tremor-default border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              {error}
            </div>
          ) : null}
          <Button className="w-full" color="emerald" loading={loading} loadingText="Validando..." disabled={!password.trim()}>
            Entrar
          </Button>
        </form>
      </Card>
    </main>
  );
}

function PasswordPanel({
  currentPassword,
  newPassword,
  confirmPassword,
  error,
  success,
  loading,
  onCurrentPasswordChange,
  onNewPasswordChange,
  onConfirmPasswordChange,
  onSubmit,
  onClose,
}: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  error: string;
  success: string;
  loading: boolean;
  onCurrentPasswordChange: (value: string) => void;
  onNewPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
}) {
  return (
    <Card className="mb-5 ml-auto max-w-xl rounded-tremor-default border-slate-800 bg-slate-950/80">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Title>Cambiar clave</Title>
          <Text>Usa minimo 12 caracteres para la nueva clave.</Text>
        </div>
        <Button type="button" variant="light" color="slate" onClick={onClose}>
          Cerrar
        </Button>
      </div>

      <form className="mt-5 grid gap-3" onSubmit={onSubmit}>
        <input
          autoComplete="current-password"
          type="password"
          value={currentPassword}
          onChange={(event) => onCurrentPasswordChange(event.target.value)}
          placeholder="Clave actual"
          className="h-11 rounded-tremor-default border-slate-700 bg-slate-900 text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:ring-emerald-500"
        />
        <input
          autoComplete="new-password"
          type="password"
          value={newPassword}
          onChange={(event) => onNewPasswordChange(event.target.value)}
          placeholder="Nueva clave"
          className="h-11 rounded-tremor-default border-slate-700 bg-slate-900 text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:ring-emerald-500"
        />
        <input
          autoComplete="new-password"
          type="password"
          value={confirmPassword}
          onChange={(event) => onConfirmPasswordChange(event.target.value)}
          placeholder="Repetir nueva clave"
          className="h-11 rounded-tremor-default border-slate-700 bg-slate-900 text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:ring-emerald-500"
        />
        {error ? (
          <div className="rounded-tremor-default border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {error}
          </div>
        ) : null}
        {success ? (
          <div className="rounded-tremor-default border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
            {success}
          </div>
        ) : null}
        <Button type="submit" color="emerald" loading={loading} loadingText="Guardando...">
          Guardar clave
        </Button>
      </form>
    </Card>
  );
}

function BudgetProgress({ item }: { item: Budget }) {
  const pct = percent(item.gasto, item.limite);
  const considered = getBudgetConsidered(item);

  return (
    <div className="border-b border-slate-800 py-4 last:border-b-0 last:pb-0 first:pt-0">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <Text className="truncate font-semibold text-slate-200">{item.cat}</Text>
          <Text>Considerado: {formatMoney(considered)}</Text>
        </div>
        <Badge color={budgetColor(pct)}>{pct}%</Badge>
      </div>
      <ProgressBar className="mt-3" value={pct} color={budgetColor(pct)} />
      <div className="mt-2 flex justify-between gap-3 text-sm text-slate-400">
        <span>{formatMoney(item.gasto)}</span>
        <span>{formatMoney(item.limite)}</span>
      </div>
    </div>
  );
}

function GoalProgress({ item }: { item: Goal }) {
  const pct = percent(item.ahorrado, item.objetivo);

  return (
    <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <Title className="truncate">{item.nombre}</Title>
          <Text>
            {formatMoney(item.ahorrado)} / {formatMoney(item.objetivo)}
          </Text>
        </div>
        <Badge color={goalColor(pct)}>{pct}%</Badge>
      </div>
      <ProgressBar className="mt-4" value={pct} color={goalColor(pct)} />
    </Card>
  );
}

function FixedExpenseRow({ item }: { item: FixedExpense }) {
  const status = fixedStatus(item);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-slate-800 py-4 last:border-b-0 last:pb-0 first:pt-0">
      <div className="min-w-0">
        <Text className="truncate font-semibold text-slate-200">{item.nombre}</Text>
        <Text className="truncate">{item.cat}</Text>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-3">
        <span className="font-mono text-sm font-semibold text-slate-100">{formatMoney(item.monto)}</span>
        <Badge color={fixedStatusColor(status)}>{status}</Badge>
      </div>
    </div>
  );
}

function EmailPanel({ config }: { config?: EmailConfig }) {
  if (!config) return null;

  return (
    <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Title>Correo</Title>
          <Text>Resumenes activos</Text>
        </div>
        <Badge color={config.configured ? 'emerald' : 'amber'}>
          {config.configured ? 'Configurado' : 'Pendiente'}
        </Badge>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {[
          ['Diario', config.daily || '-'],
          ['Mensual', config.monthly || '-'],
          ['Anual', config.yearly || '-'],
        ].map(([label, value]) => (
          <div key={label} className="rounded-tremor-default border border-slate-800 bg-slate-900/60 p-3">
            <Text>{label}</Text>
            <p className="mt-1 truncate font-mono text-sm font-semibold text-slate-100">{value}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function TransactionsTable({ transactions }: { transactions: Transaction[] }) {
  if (!transactions.length) return <EmptyState>Sin movimientos registrados.</EmptyState>;

  return (
    <Table className="mt-4">
      <TableHead>
        <TableRow>
          <TableHeaderCell>Fecha</TableHeaderCell>
          <TableHeaderCell>Detalle</TableHeaderCell>
          <TableHeaderCell>Categoria</TableHeaderCell>
          <TableHeaderCell className="text-right">Monto</TableHeaderCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {transactions.map((tx, index) => {
          const isIncome = tx.tipo === 'ingreso';

          return (
            <TableRow key={tx.id || `${tx.fecha}-${tx.desc}-${index}`}>
              <TableCell>
                <div className="whitespace-nowrap">
                  <p className="text-slate-200">{formatDate(tx.fecha)}</p>
                  <p className="text-xs text-slate-500">{tx.hora || '00:00'}</p>
                </div>
              </TableCell>
              <TableCell>
                <div className="min-w-[12rem]">
                  <p className="font-semibold text-slate-100">{tx.desc}</p>
                  <Badge className="mt-1" color={isIncome ? 'emerald' : 'rose'}>
                    {tx.tipo}
                  </Badge>
                </div>
              </TableCell>
              <TableCell className="capitalize">{tx.cat}</TableCell>
              <TableCell className={`text-right font-mono font-semibold ${isIncome ? 'text-emerald-300' : 'text-rose-300'}`}>
                {isIncome ? '+' : '-'}
                {formatMoney(tx.monto)}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

export default function App() {
  const [data, setData] = useState<DashboardData>(MOCK);
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

  const isConfigured = !API_URL.includes('TU_SCRIPT_ID');
  const realExpenses = useMemo(() => getRealExpenses(data), [data]);
  const totalCategorias = useMemo(
    () => data.categorias.reduce((total, item) => total + item.monto, 0),
    [data.categorias],
  );
  const topCategory = data.categorias[0];
  const monthIncome = data.ingresosMes ?? data.ingresos;
  const monthBalance = data.balanceMes ?? monthIncome - data.gastosMes;
  const availableAfterCommitted = monthIncome - realExpenses.total;
  const spendingRate = monthIncome > 0 ? percent(data.gastosMes, monthIncome) : data.gastosMes > 0 ? 100 : 0;
  const commitmentRate = monthIncome > 0 ? percent(realExpenses.total, monthIncome) : realExpenses.total > 0 ? 100 : 0;
  const activeTabIndex = Math.max(tabs.findIndex((item) => item.id === tab), 0);

  const fetchData = useCallback(async (sessionToken?: string | null) => {
    const activeToken = sessionToken ?? token;
    if (!isConfigured || !activeToken) return;

    setLoading(true);
    try {
      const url = new URL(apiEndpoint('dashboard'));

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
  }, [isConfigured, token]);

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
    setData(MOCK);
    setStatus('demo');
    setAuthError('');
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
    if (!isConfigured || !token) return;
    void fetchData(token);
  }, [fetchData, isConfigured, token]);

  useEffect(() => {
    if (!isConfigured || !token) return undefined;
    const timer = window.setInterval(() => void fetchData(token), 60000);
    return () => window.clearInterval(timer);
  }, [fetchData, isConfigured, token]);

  if (isConfigured && !token) {
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
    <main className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
      <Card className="mb-5 rounded-tremor-default border-slate-800 bg-slate-950/80">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge color={statusColor(status)}>
                {status === 'live' ? `En vivo${data.source ? ` - ${data.source}` : ''}` : status === 'error' ? 'Error API' : 'Demo'}
              </Badge>
              <Badge color="cyan">{data.mesKey || data.mes}</Badge>
            </div>
            <Title className="text-2xl sm:text-3xl">Mayeson Finanzas</Title>
            <Text className="mt-1">Ultima actualizacion: {loading ? 'Actualizando...' : formatUpdatedAt(data.updatedAt)}</Text>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button icon={RiRefreshLine} color="emerald" loading={loading} loadingText="Actualizando" onClick={() => void fetchData()}>
              Actualizar
            </Button>
            {isConfigured ? (
              <>
                <Button
                  icon={RiLockPasswordLine}
                  variant="secondary"
                  color="slate"
                  onClick={() => {
                    setPasswordError('');
                    setPasswordSuccess('');
                    setShowPasswordPanel((value) => !value);
                  }}
                >
                  Clave
                </Button>
                <Button icon={RiLogoutBoxRLine} variant="light" color="rose" onClick={handleLogout}>
                  Salir
                </Button>
              </>
            ) : null}
          </div>
        </div>
      </Card>

      {showPasswordPanel ? (
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
      ) : null}

      <TabGroup
        index={activeTabIndex}
        onIndexChange={(index) => {
          const nextTab = tabs[index]?.id;
          if (nextTab) setTab(nextTab);
        }}
      >
        <TabList variant="solid" color="emerald" className="mb-5 w-full overflow-x-auto">
          {tabs.map((item) => (
            <Tab key={item.id} icon={item.icon}>
              {item.label}
            </Tab>
          ))}
        </TabList>
      </TabGroup>

      {tab === 'inicio' ? (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label={`Balance ${data.mes}`}
              value={formatMoney(monthBalance)}
              detail={`${data.movimientos} movimientos registrados`}
              color={monthBalance >= 0 ? 'emerald' : 'rose'}
            />
            <KpiCard
              label="Gastos del mes"
              value={formatMoney(data.gastosMes)}
              detail={`${spendingRate}% de ingresos usados`}
              color={spendingRate >= 100 ? 'rose' : spendingRate >= 75 ? 'amber' : 'sky'}
            />
            <KpiCard
              label="Libre estimado"
              value={formatMoney(availableAfterCommitted)}
              detail="Ingresos menos fijos y presupuesto"
              color={availableAfterCommitted >= 0 ? 'emerald' : 'rose'}
            />
            <KpiCard
              label="Comprometido"
              value={formatMoney(realExpenses.total)}
              detail={`${commitmentRate}% de tus ingresos`}
              color={commitmentRate >= 100 ? 'rose' : commitmentRate >= 80 ? 'amber' : 'violet'}
            />
          </section>

          <section className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
            <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <Title>Ultimos 6 meses</Title>
                  <Text>Ingresos contra gastos</Text>
                </div>
                <Badge color="emerald">S/</Badge>
              </div>
              <BarChart
                className="mt-6 h-72"
                data={data.meses}
                index="mes"
                categories={['ingresos', 'gastos']}
                colors={['emerald', 'rose']}
                valueFormatter={formatMoney}
                yAxisWidth={74}
                showLegend
              />
            </Card>

            <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Title>Gastos por categoria</Title>
                  <Text>{topCategory ? `Principal: ${topCategory.cat}` : 'Sin gastos este mes'}</Text>
                </div>
                <Badge color="cyan">{data.categorias.length}</Badge>
              </div>
              {data.categorias.length ? (
                <>
                  <DonutChart
                    className="mt-6 h-56"
                    data={data.categorias}
                    category="monto"
                    index="cat"
                    colors={categoryColors}
                    valueFormatter={formatMoney}
                    showLabel
                  />
                  <div className="mt-5 space-y-3">
                    {data.categorias.slice(0, 5).map((item, index) => (
                      <div key={item.cat} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-200">{item.cat}</p>
                          <ProgressBar className="mt-2" value={percent(item.monto, totalCategorias)} color={categoryColors[index % categoryColors.length]} />
                        </div>
                        <p className="font-mono text-sm font-semibold text-slate-100">{formatMoney(item.monto)}</p>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="mt-6">
                  <EmptyState>Sin gastos este mes.</EmptyState>
                </div>
              )}
            </Card>
          </section>

          <section className="mt-5 grid gap-4 md:grid-cols-3">
            <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70">
              <Text>Ingresos del mes</Text>
              <Metric className="mt-2 text-2xl">{formatMoney(monthIncome)}</Metric>
            </Card>
            <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70">
              <Text>Fijos</Text>
              <Metric className="mt-2 text-2xl">{formatMoney(realExpenses.totalFijos)}</Metric>
            </Card>
            <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70">
              <Text>Presupuesto considerado</Text>
              <Metric className="mt-2 text-2xl">{formatMoney(realExpenses.totalPresupuesto)}</Metric>
            </Card>
          </section>
        </>
      ) : null}

      {tab === 'movimientos' ? (
        <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Title>Movimientos</Title>
              <Text>{data.transacciones.length} registros recientes</Text>
            </div>
            <Badge color="emerald">{data.mes}</Badge>
          </div>
          <TransactionsTable transactions={data.transacciones} />
        </Card>
      ) : null}

      {tab === 'compromisos' ? (
        <section className="grid gap-4 lg:grid-cols-2">
          <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Title>Gastos fijos</Title>
                <Text>{(data.fijos || []).length} activos</Text>
              </div>
              <Badge color="amber">{formatMoney(realExpenses.totalFijos)}</Badge>
            </div>
            <div className="mt-5">
              {(data.fijos || []).length ? (
                (data.fijos || []).map((item) => <FixedExpenseRow key={item.nombre} item={item} />)
              ) : (
                <EmptyState>Sin gastos fijos registrados.</EmptyState>
              )}
            </div>
          </Card>

          <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Title>Presupuesto</Title>
                <Text>Si no hay gasto, se considera el limite completo.</Text>
              </div>
              <Badge color="sky">{formatMoney(realExpenses.totalPresupuesto)}</Badge>
            </div>
            <div className="mt-5">
              {data.presupuestos.length ? (
                data.presupuestos.map((item) => <BudgetProgress key={item.cat} item={item} />)
              ) : (
                <EmptyState>Sin presupuestos registrados.</EmptyState>
              )}
            </div>
          </Card>

          <div className="lg:col-span-2">
            <EmailPanel config={data.emailConfig} />
          </div>
        </section>
      ) : null}

      {tab === 'analisis' ? (
        <section className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.6fr)]">
          <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70">
            <Title>Tendencia</Title>
            <Text>Ingresos y gastos por mes</Text>
            <AreaChart
              className="mt-6 h-80"
              data={data.meses}
              index="mes"
              categories={['ingresos', 'gastos']}
              colors={['emerald', 'rose']}
              valueFormatter={formatMoney}
              yAxisWidth={74}
              curveType="monotone"
              showGradient
              showLegend
            />
          </Card>

          <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70">
            <Title>Categorias</Title>
            <Text>Distribucion del gasto actual</Text>
            <div className="mt-5 space-y-4">
              {data.categorias.length ? (
                data.categorias.map((item, index) => {
                  const pct = percent(item.monto, totalCategorias);
                  const color = categoryColors[index % categoryColors.length];

                  return (
                    <div key={item.cat}>
                      <div className="flex items-center justify-between gap-4">
                        <Text className="truncate font-semibold text-slate-200">{item.cat}</Text>
                        <span className="font-mono text-sm text-slate-100">{formatMoney(item.monto)}</span>
                      </div>
                      <ProgressBar className="mt-2" value={pct} color={color} />
                      <Text className="mt-1">{pct}% del total</Text>
                    </div>
                  );
                })
              ) : (
                <EmptyState>Sin categorias para analizar.</EmptyState>
              )}
            </div>
          </Card>
        </section>
      ) : null}

      {tab === 'metas' ? (
        <section>
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <Title>Metas de ahorro</Title>
              <Text>Seguimiento de avance por objetivo</Text>
            </div>
            <Badge color="violet">{data.metas.length}</Badge>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {data.metas.length ? (
              data.metas.map((item) => <GoalProgress key={item.nombre} item={item} />)
            ) : (
              <EmptyState>Sin metas registradas.</EmptyState>
            )}
          </div>
        </section>
      ) : null}
    </main>
  );
}
