import type { ElementType } from 'react';

export type TxType = 'ingreso' | 'gasto';
export type Currency = 'PEN' | 'USD';
export type TabId = 'inicio' | 'movimientos' | 'compromisos' | 'analisis' | 'metas' | 'configuracion';
export type ApiStatus = 'demo' | 'live' | 'error';

export interface Transaction {
  id?: string;
  fecha: string;
  hora?: string;
  tipo: TxType;
  desc: string;
  cat: string;
  monto: number;
  currency?: Currency | string;
  paymentMethod?: 'debito' | 'credito' | string;
  paymentDueDate?: string;
  cardName?: string;
  receipt?: TransactionReceipt;
}

export interface TransactionReceipt {
  id: string;
  fileName?: string;
  contentType?: string;
  size?: number;
  uploadedAt?: string;
}

export interface CategoryTotal {
  cat: string;
  monto: number;
  color: string;
}

export interface MonthTotal {
  mes: string;
  key?: string;
  ingresos: number;
  gastos: number;
}

export interface Budget {
  cat: string;
  limite: number;
  gasto: number;
}

export interface DashboardUser {
  chatId: string;
  label: string;
  userId?: string;
  email?: string;
  name?: string;
  role?: string;
  active?: boolean;
  transactions: number;
  lastActivity?: string;
}

export interface CategoryDefinition {
  id: string;
  scope: 'global' | 'user' | string;
  category: string;
  type: TxType | string;
  color: string;
  active: boolean;
  sortOrder: number;
}

export interface CategoryRuleItem {
  id: string;
  scope: 'global' | 'personal' | string;
  keyword: string;
  category: string;
  priority: number;
  active: boolean;
}

export interface BudgetRuleItem {
  id: string;
  scope: 'global' | 'personal' | string;
  budgetCategory: string;
  includedCategory: string;
  active: boolean;
}

export interface BudgetRule {
  budgetCategory: string;
  includedCategory: string;
}

export interface Goal {
  nombre: string;
  objetivo: number;
  ahorrado: number;
}

export interface FixedExpense {
  nombre: string;
  monto: number;
  cat: string;
  color?: string;
  pagadoMes?: boolean;
  saltadoMes?: boolean;
  estado?: 'pagado' | 'pendiente' | 'saltado' | string;
}

export interface Debt {
  id?: string;
  nombre: string;
  total: number;
  pagado: number;
  pendiente: number;
  vencimiento?: string;
  estado?: 'activa' | 'pagada' | string;
  notas?: string;
}

export interface SmartAlert {
  level: 'info' | 'warning' | 'danger' | string;
  title: string;
  message: string;
}

export interface SmartInsight {
  title: string;
  message: string;
}

export interface RealExpenses {
  totalFijos: number;
  totalPresupuesto: number;
  total: number;
  regla?: string;
}

export interface EmailConfig {
  configured: boolean;
  daily?: string;
  monthly?: string;
  yearly?: string;
}

export interface AppSettingsConfig {
  creditCutoffDay: number;
  creditDueDay: number;
  creditCardName: string;
  defaultCurrency?: Currency;
  defaultPaymentMethod?: 'debito' | 'credito';
  receiptImageMaxBytes: number;
  claudeModel: string;
  claudeApiUrl?: string;
  financeEmailTo: string;
  dailyEmailTo: string;
  monthlyEmailTo: string;
  yearlyEmailTo: string;
}

export interface AppSettingsData {
  ok?: boolean;
  user?: {
    id: string;
    name?: string;
    email?: string;
    role?: string;
    chatId?: string;
    label?: string;
  };
  config: AppSettingsConfig;
  secrets: Record<string, boolean>;
  updatedAt?: string;
  error?: string;
}

export interface HealthCheck {
  id: string;
  label: string;
  status: 'ok' | 'warning' | 'error' | string;
  message: string;
}

export interface SystemHealthData {
  ok?: boolean;
  status: 'ok' | 'warning' | 'error' | string;
  summary: {
    total: number;
    ok: number;
    warnings: number;
    errors: number;
    latencyMs: number;
  };
  checks: HealthCheck[];
  checkedAt?: string;
  error?: string;
}

export interface DashboardData {
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
  budgetRules?: BudgetRule[];
  meses: MonthTotal[];
  presupuestos: Budget[];
  fijos?: FixedExpense[];
  deudas?: Debt[];
  gastosReales?: RealExpenses;
  metas: Goal[];
  alertas?: SmartAlert[];
  insights?: SmartInsight[];
  emailConfig?: EmailConfig;
  source?: string;
  updatedAt?: string;
  error?: string;
}

export interface DashboardTab {
  id: TabId;
  label: string;
  icon: ElementType;
}
