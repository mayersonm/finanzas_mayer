import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

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

interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{
    color?: string;
    name?: string | number;
    value?: string | number;
  }>;
  label?: string | number;
}

const API_URL = import.meta.env.VITE_GAS_API_URL || 'https://script.google.com/macros/s/TU_SCRIPT_ID/exec';
const API_KEY = import.meta.env.VITE_DASHBOARD_API_KEY || 'TU_API_KEY_SECRETA';

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

const tabs: Array<{ id: TabId; label: string }> = [
  { id: 'inicio', label: 'Inicio' },
  { id: 'movimientos', label: 'Movimientos' },
  { id: 'compromisos', label: 'Compromisos' },
  { id: 'analisis', label: 'Analisis' },
  { id: 'metas', label: 'Metas' },
];

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

function CustomTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <div className="chart-tooltip">
      <div className="tooltip-label">{label}</div>
      {payload.map((item) => (
        <div key={`${item.name}`} className="tooltip-row" style={{ color: item.color }}>
          {item.name}: {formatMoney(Number(item.value) || 0)}
        </div>
      ))}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent: string;
}) {
  return (
    <section className="stat-card" style={{ borderTopColor: accent }}>
      <span className="eyebrow">{label}</span>
      <strong>{value}</strong>
      {sub ? <small>{sub}</small> : null}
    </section>
  );
}

function TransactionRow({ tx }: { tx: Transaction }) {
  const isIncome = tx.tipo === 'ingreso';

  return (
    <article className="tx-row">
      <div className={isIncome ? 'tx-icon tx-icon-income' : 'tx-icon tx-icon-expense'}>
        {isIncome ? '+' : '-'}
      </div>
      <div className="tx-main">
        <strong>{tx.desc}</strong>
        <span>
          {tx.cat} - {formatDate(tx.fecha)}
          {tx.hora ? ` - ${tx.hora}` : ''}
        </span>
      </div>
      <strong className={isIncome ? 'amount income' : 'amount expense'}>
        {isIncome ? '+' : '-'}
        {formatMoney(tx.monto)}
      </strong>
    </article>
  );
}

function ProgressBar({
  label,
  current,
  target,
  kind,
  detail,
}: {
  label: string;
  current: number;
  target: number;
  kind: 'goal' | 'budget';
  detail?: string;
}) {
  const pct = percent(current, target);
  const color = kind === 'budget'
    ? pct >= 100 ? '#ef4444' : pct >= 80 ? '#f59e0b' : '#22c55e'
    : pct >= 100 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#3b82f6';

  return (
    <div className="progress-item">
      <div className="progress-head">
        <strong>{label}</strong>
        <span>
          {formatMoney(current)} / {formatMoney(target)}
        </span>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <div className="progress-foot">
        <small style={{ color }}>{pct}%</small>
        {detail ? <small>{detail}</small> : null}
      </div>
    </div>
  );
}

function FixedExpenseRow({ item }: { item: FixedExpense }) {
  const status = item.estado || (item.pagadoMes ? 'pagado' : item.saltadoMes ? 'saltado' : 'pendiente');
  const className = status === 'pagado'
    ? 'fixed-status paid'
    : status === 'saltado'
      ? 'fixed-status skipped'
      : 'fixed-status pending';

  return (
    <article className="fixed-row">
      <span className="fixed-color" style={{ backgroundColor: item.color || '#6b7280' }} />
      <div>
        <strong>{item.nombre}</strong>
        <small>{item.cat}</small>
      </div>
      <strong>{formatMoney(item.monto)}</strong>
      <span className={className}>{status}</span>
    </article>
  );
}

function EmailPanel({ config }: { config?: EmailConfig }) {
  if (!config) return null;

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Correo</h2>
        <span className={config.configured ? 'pill ok' : 'pill warn'}>
          {config.configured ? 'Configurado' : 'Pendiente'}
        </span>
      </div>
      <div className="config-list">
        <div>
          <span>Diario</span>
          <strong>{config.daily || '-'}</strong>
        </div>
        <div>
          <span>Mensual</span>
          <strong>{config.monthly || '-'}</strong>
        </div>
        <div>
          <span>Anual</span>
          <strong>{config.yearly || '-'}</strong>
        </div>
      </div>
    </section>
  );
}

export default function App() {
  const [data, setData] = useState<DashboardData>(MOCK);
  const [tab, setTab] = useState<TabId>('inicio');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<ApiStatus>('demo');

  const isConfigured = !API_URL.includes('TU_SCRIPT_ID') && API_KEY !== 'TU_API_KEY_SECRETA';
  const realExpenses = useMemo(() => getRealExpenses(data), [data]);
  const fixedExpenses = data.fijos || [];
  const totalCategorias = useMemo(
    () => data.categorias.reduce((total, item) => total + item.monto, 0),
    [data.categorias],
  );
  const availableAfterCommitted = (data.ingresosMes ?? 0) - realExpenses.total;

  const fetchData = useCallback(async () => {
    if (!isConfigured) return;

    setLoading(true);
    try {
      const url = new URL(API_URL);
      url.searchParams.set('key', API_KEY);
      url.searchParams.set('action', 'dashboard');

      const response = await fetch(url.toString());
      const nextData = (await response.json()) as DashboardData;

      if (nextData.ok === false || nextData.error) {
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
  }, [isConfigured]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!isConfigured) return undefined;
    const timer = window.setInterval(() => void fetchData(), 60000);
    return () => window.clearInterval(timer);
  }, [fetchData, isConfigured]);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <span className="eyebrow">Panel financiero</span>
          <h1>Mayeson</h1>
        </div>
        <div className="status-wrap">
          <span>{loading ? 'Actualizando' : formatUpdatedAt(data.updatedAt)}</span>
          <button className="refresh-btn" type="button" onClick={() => void fetchData()}>
            Actualizar
          </button>
          <span className={`status-dot ${status}`} />
          <span>{status === 'live' ? `En vivo${data.source ? ` - ${data.source}` : ''}` : status === 'error' ? 'Error API' : 'Demo'}</span>
        </div>
      </header>

      <nav className="tabs" aria-label="Secciones">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            className={tab === item.id ? 'active' : ''}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {tab === 'inicio' ? (
        <div className="content-grid">
          <section className="stats-grid">
            <div className="wide">
              <StatCard
                label="Balance total"
                value={formatMoney(data.balance)}
                sub={`${data.movimientos} movimientos registrados`}
                accent={data.balance >= 0 ? '#22c55e' : '#ef4444'}
              />
            </div>
            <StatCard label={`Ingresos ${data.mes}`} value={formatMoney(data.ingresosMes ?? data.ingresos)} accent="#22c55e" />
            <StatCard label={`Gastos ${data.mes}`} value={formatMoney(data.gastosMes)} accent="#ef4444" />
            <StatCard label="Comprometido" value={formatMoney(realExpenses.total)} sub="Fijos + presupuesto" accent="#3b82f6" />
            <StatCard
              label="Libre estimado"
              value={formatMoney(availableAfterCommitted)}
              sub={data.mesKey || data.mes}
              accent={availableAfterCommitted >= 0 ? '#22c55e' : '#ef4444'}
            />
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>Ultimos 6 meses</h2>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.meses} barGap={6}>
                <XAxis dataKey="mes" tick={{ fill: '#7a8172', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="ingresos" name="Ingresos" fill="#22c55e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="gastos" name="Gastos" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </section>

          <section className="panel split-panel">
            <div className="panel-head">
              <h2>Gastos por categoria</h2>
            </div>
            {data.categorias.length ? (
              <div className="pie-wrap">
                <PieChart width={148} height={148}>
                  <Pie data={data.categorias} dataKey="monto" cx={72} cy={72} innerRadius={42} outerRadius={66} paddingAngle={3}>
                    {data.categorias.map((item) => (
                      <Cell key={item.cat} fill={item.color} />
                    ))}
                  </Pie>
                </PieChart>
                <div className="legend">
                  {data.categorias.map((item) => (
                    <div key={item.cat} className="legend-row">
                      <span style={{ backgroundColor: item.color }} />
                      <strong>{item.cat}</strong>
                      <em>{percent(item.monto, totalCategorias)}%</em>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="empty-state">Sin gastos este mes.</p>
            )}
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>Gasto real del mes</h2>
            </div>
            <div className="real-grid">
              <div>
                <span>Fijos</span>
                <strong>{formatMoney(realExpenses.totalFijos)}</strong>
              </div>
              <div>
                <span>Presupuesto</span>
                <strong>{formatMoney(realExpenses.totalPresupuesto)}</strong>
              </div>
              <div className="total">
                <span>Total</span>
                <strong>{formatMoney(realExpenses.total)}</strong>
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {tab === 'movimientos' ? (
        <section className="panel">
          <div className="panel-head compact">
            <div>
              <h2>Movimientos</h2>
              <span>{data.transacciones.length} registros recientes</span>
            </div>
          </div>
          <div className="tx-list">
            {data.transacciones.length ? data.transacciones.map((tx, index) => (
              <TransactionRow key={tx.id || `${tx.fecha}-${tx.desc}-${index}`} tx={tx} />
            )) : <p className="empty-state">Sin movimientos registrados.</p>}
          </div>
        </section>
      ) : null}

      {tab === 'compromisos' ? (
        <div className="content-grid">
          <section className="panel">
            <div className="panel-head">
              <h2>Gastos fijos</h2>
              <span>{fixedExpenses.length} activos</span>
            </div>
            <div className="fixed-list">
              {fixedExpenses.length ? fixedExpenses.map((item) => (
                <FixedExpenseRow key={item.nombre} item={item} />
              )) : <p className="empty-state">Sin gastos fijos registrados.</p>}
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>Presupuesto considerado</h2>
              <span>{formatMoney(realExpenses.totalPresupuesto)}</span>
            </div>
            {data.presupuestos.length ? (
              data.presupuestos.map((item) => (
                <ProgressBar
                  key={item.cat}
                  label={item.cat}
                  current={item.gasto}
                  target={item.limite}
                  kind="budget"
                  detail={`considera ${formatMoney(getBudgetConsidered(item))}`}
                />
              ))
            ) : (
              <p className="empty-state">Sin presupuestos registrados.</p>
            )}
          </section>

          <section className="panel wide-panel">
            <div className="panel-head">
              <h2>Resumen comprometido</h2>
            </div>
            <div className="commitment-strip">
              <StatCard label="Fijos" value={formatMoney(realExpenses.totalFijos)} accent="#f59e0b" />
              <StatCard label="Presupuesto" value={formatMoney(realExpenses.totalPresupuesto)} accent="#3b82f6" />
              <StatCard label="Total" value={formatMoney(realExpenses.total)} accent="#22c55e" />
            </div>
          </section>

          <EmailPanel config={data.emailConfig} />
        </div>
      ) : null}

      {tab === 'analisis' ? (
        <div className="content-grid">
          <section className="panel wide-panel">
            <div className="panel-head">
              <h2>Tendencia</h2>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={data.meses}>
                <defs>
                  <linearGradient id="incomeFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="expenseFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.26} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="mes" tick={{ fill: '#7a8172', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="ingresos" name="Ingresos" stroke="#22c55e" fill="url(#incomeFill)" strokeWidth={2} />
                <Area type="monotone" dataKey="gastos" name="Gastos" stroke="#ef4444" fill="url(#expenseFill)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </section>

          <section className="category-grid">
            {data.categorias.length ? data.categorias.map((item) => (
              <article key={item.cat} className="category-card">
                <span>{item.cat}</span>
                <strong style={{ color: item.color }}>{formatMoney(item.monto)}</strong>
                <small>{percent(item.monto, totalCategorias)}% del total</small>
                <div className="mini-track">
                  <div style={{ width: `${percent(item.monto, totalCategorias)}%`, backgroundColor: item.color }} />
                </div>
              </article>
            )) : <p className="empty-state">Sin categorias para analizar.</p>}
          </section>
        </div>
      ) : null}

      {tab === 'metas' ? (
        <section className="panel">
          <div className="panel-head">
            <h2>Metas de ahorro</h2>
          </div>
          {data.metas.length ? (
            data.metas.map((item) => (
              <ProgressBar key={item.nombre} label={item.nombre} current={item.ahorrado} target={item.objetivo} kind="goal" />
            ))
          ) : (
            <p className="empty-state">Sin metas registradas.</p>
          )}
        </section>
      ) : null}
    </main>
  );
}
