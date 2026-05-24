import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Badge, Button, Card, Text, Title } from '@tremor/react';
import {
  RiAddLine,
  RiCheckboxCircleLine,
  RiDeleteBinLine,
  RiErrorWarningLine,
  RiRefreshLine,
  RiSave3Line,
} from '@remixicon/react';
import { apiEndpoint } from '../../app/api';
import type {
  AppSettingsConfig,
  AppSettingsData,
  BudgetRuleItem,
  CategoryDefinition,
  CategoryRuleItem,
  HealthCheck,
  SystemHealthData,
} from '../../types/dashboard';

const EMPTY_CONFIG: AppSettingsConfig = {
  creditCutoffDay: 25,
  creditDueDay: 10,
  creditCardName: '',
  defaultCurrency: 'PEN',
  defaultPaymentMethod: 'debito',
  receiptImageMaxBytes: 921600,
  claudeModel: 'claude-haiku-4-5-20251001',
  claudeApiUrl: '',
  financeEmailTo: '',
  dailyEmailTo: '',
  monthlyEmailTo: '',
  yearlyEmailTo: '',
};

const EMPTY_HEALTH: SystemHealthData = {
  status: 'warning',
  summary: { total: 0, ok: 0, warnings: 0, errors: 0, latencyMs: 0 },
  checks: [],
};

const BASE_CATEGORIES = ['supermercado', 'transporte', 'servicios', 'entretenimiento', 'salud', 'ropa', 'educacion', 'salario', 'freelance', 'inversion', 'venta', 'otro'];

const SECRET_LABELS: Record<string, string> = {
  dashboardApiKey: 'Dashboard API key',
  d1AdminKey: 'D1 admin key',
  workerGasApiUrl: 'Worker GAS URL',
  workerGasApiKey: 'Worker GAS key',
  workerAdminKey: 'Worker admin key',
  workerDefaultChatId: 'Chat ID',
  r2Bucket: 'R2 recibos',
};

type CategoriesResponse = { ok?: boolean; categories?: CategoryDefinition[]; error?: string };
type RulesResponse = { ok?: boolean; categoryRules?: CategoryRuleItem[]; budgetRules?: BudgetRuleItem[]; error?: string };

export function SettingsSection({ authToken, chatId }: { authToken?: string | null; chatId?: string }) {
  const [config, setConfig] = useState<AppSettingsConfig>(EMPTY_CONFIG);
  const [userLabel, setUserLabel] = useState('');
  const [secrets, setSecrets] = useState<Record<string, boolean>>({});
  const [updatedAt, setUpdatedAt] = useState('');
  const [health, setHealth] = useState<SystemHealthData>(EMPTY_HEALTH);
  const [categories, setCategories] = useState<CategoryDefinition[]>([]);
  const [categoryRules, setCategoryRules] = useState<CategoryRuleItem[]>([]);
  const [budgetRules, setBudgetRules] = useState<BudgetRuleItem[]>([]);
  const [categoryForm, setCategoryForm] = useState({ category: '', type: 'gasto', color: '#6b7280' });
  const [ruleForm, setRuleForm] = useState({ keyword: '', category: 'otro' });
  const [budgetForm, setBudgetForm] = useState({ budgetCategory: 'supermercado', includedCategory: 'otro' });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const categoryOptions = useMemo(() => {
    const activeCategories = categories.filter((item) => item.active).map((item) => item.category);
    return Array.from(new Set([...BASE_CATEGORIES, ...activeCategories])).sort();
  }, [categories]);

  const loadSettings = useCallback(async () => {
    if (!authToken) return;

    setLoading(true);
    setError('');
    try {
      const settingsUrl = new URL(apiEndpoint('settings'));
      const categoryUrl = new URL(apiEndpoint('categories'));
      const rulesUrl = new URL(apiEndpoint('rules'));
      if (chatId) {
        settingsUrl.searchParams.set('chat_id', chatId);
        categoryUrl.searchParams.set('chat_id', chatId);
        rulesUrl.searchParams.set('chat_id', chatId);
      }

      const headers = { Authorization: `Bearer ${authToken}` };
      const [settingsResponse, healthResponse, categoryResponse, rulesResponse] = await Promise.all([
        fetch(settingsUrl.toString(), { headers }),
        fetch(apiEndpoint('system-health'), { headers }),
        fetch(categoryUrl.toString(), { headers }),
        fetch(rulesUrl.toString(), { headers }),
      ]);

      const [settingsData, healthData, categoryData, rulesData] = await Promise.all([
        settingsResponse.json() as Promise<AppSettingsData>,
        healthResponse.json() as Promise<SystemHealthData>,
        categoryResponse.json() as Promise<CategoriesResponse>,
        rulesResponse.json() as Promise<RulesResponse>,
      ]);

      if (!settingsResponse.ok || settingsData.ok === false) throw new Error(settingsData.error || 'No se pudo leer configuracion');
      if (!healthResponse.ok) throw new Error(healthData.error || 'No se pudo leer estado del sistema');
      if (!categoryResponse.ok || categoryData.ok === false) throw new Error(categoryData.error || 'No se pudo leer categorias');
      if (!rulesResponse.ok || rulesData.ok === false) throw new Error(rulesData.error || 'No se pudo leer reglas');

      setConfig({ ...EMPTY_CONFIG, ...settingsData.config });
      setUserLabel(settingsData.user?.label || settingsData.user?.name || settingsData.user?.chatId || '');
      setSecrets(settingsData.secrets || {});
      setUpdatedAt(settingsData.updatedAt || '');
      setHealth(healthData || EMPTY_HEALTH);
      setCategories(categoryData.categories || []);
      setCategoryRules(rulesData.categoryRules || []);
      setBudgetRules(rulesData.budgetRules || []);
    } catch (err) {
      console.error('Settings load error:', err);
      setError(err instanceof Error ? err.message : 'No se pudo cargar configuracion.');
    } finally {
      setLoading(false);
    }
  }, [authToken, chatId]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const updateField = <K extends keyof AppSettingsConfig>(key: K, value: AppSettingsConfig[K]) => {
    setConfig((current) => ({ ...current, [key]: value }));
  };

  const post = useCallback(async (path: string, payload: Record<string, unknown>) => {
    if (!authToken) return;
    const url = new URL(apiEndpoint(path));
    if (chatId) url.searchParams.set('chat_id', chatId);
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ...payload, chatId }),
    });
    const data = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) throw new Error(data.error || 'No se pudo guardar');
  }, [authToken, chatId]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!authToken) return;

    setSaving(true);
    setMessage('');
    setError('');

    try {
      await post('settings', config as unknown as Record<string, unknown>);
      setMessage('Configuracion guardada en D1.');
      await loadSettings();
    } catch (err) {
      console.error('Settings save error:', err);
      setError(err instanceof Error ? err.message : 'No se pudo guardar configuracion.');
    } finally {
      setSaving(false);
    }
  };

  async function submitCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setError('');
    try {
      await post('categories', categoryForm);
      setCategoryForm({ category: '', type: 'gasto', color: '#6b7280' });
      setMessage('Categoria guardada en D1.');
      await loadSettings();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar categoria.');
    }
  }

  async function submitRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setError('');
    try {
      await post('rules/category', ruleForm);
      setRuleForm({ keyword: '', category: 'otro' });
      setMessage('Regla guardada en D1.');
      await loadSettings();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar regla.');
    }
  }

  async function submitBudgetRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setError('');
    try {
      await post('rules/budget', budgetForm);
      setMessage('Regla de presupuesto guardada en D1.');
      await loadSettings();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar regla de presupuesto.');
    }
  }

  async function remove(path: string, payload: Record<string, unknown>) {
    setMessage('');
    setError('');
    try {
      await post(path, payload);
      setMessage('Elemento desactivado.');
      await loadSettings();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo desactivar.');
    }
  }

  return (
    <div className="grid gap-4">
      <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-4 sm:!p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <StatusBadge status={health.status} />
              <Badge color="slate">{userLabel || 'Usuario principal'}</Badge>
            </div>
            <Title>Configuracion</Title>
            <Text>Preferencias, estado operativo y reglas de categorias en una sola vista.</Text>
          </div>
          <Button icon={RiRefreshLine} variant="secondary" color="slate" loading={loading} onClick={() => void loadSettings()}>
            Recargar
          </Button>
        </div>
        {error ? <div className="mt-4 rounded-tremor-default border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</div> : null}
        {message ? <div className="mt-4 rounded-tremor-default border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">{message}</div> : null}
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-4 sm:!p-6">
          <form className="grid gap-5" onSubmit={handleSubmit}>
            <section>
              <h2 className="text-sm font-semibold text-slate-100">Credito</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <Field label="Dia de corte">
                  <input className="form-input" type="number" min={1} max={31} value={config.creditCutoffDay} onChange={(event) => updateField('creditCutoffDay', Number(event.target.value))} />
                </Field>
                <Field label="Dia de pago">
                  <input className="form-input" type="number" min={1} max={31} value={config.creditDueDay} onChange={(event) => updateField('creditDueDay', Number(event.target.value))} />
                </Field>
                <Field label="Tarjeta">
                  <input className="form-input" value={config.creditCardName} onChange={(event) => updateField('creditCardName', event.target.value)} placeholder="Opcional" />
                </Field>
              </div>
            </section>

            <section>
              <h2 className="text-sm font-semibold text-slate-100">Preferencias</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Field label="Moneda">
                  <select className="form-input" value={config.defaultCurrency || 'PEN'} onChange={(event) => updateField('defaultCurrency', event.target.value as AppSettingsConfig['defaultCurrency'])}>
                    <option value="PEN">PEN</option>
                    <option value="USD">USD</option>
                  </select>
                </Field>
                <Field label="Pago por defecto">
                  <select className="form-input" value={config.defaultPaymentMethod || 'debito'} onChange={(event) => updateField('defaultPaymentMethod', event.target.value as AppSettingsConfig['defaultPaymentMethod'])}>
                    <option value="debito">Debito</option>
                    <option value="credito">Credito</option>
                  </select>
                </Field>
              </div>
            </section>

            <section>
              <h2 className="text-sm font-semibold text-slate-100">IA y recibos</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Field label="Modelo IA">
                  <input className="form-input" value={config.claudeModel} onChange={(event) => updateField('claudeModel', event.target.value)} />
                </Field>
                <Field label="Maximo foto">
                  <input className="form-input" type="number" min={200000} max={3000000} step={1024} value={config.receiptImageMaxBytes} onChange={(event) => updateField('receiptImageMaxBytes', Number(event.target.value))} />
                </Field>
              </div>
            </section>

            <section>
              <h2 className="text-sm font-semibold text-slate-100">Correos</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Field label="Correo base">
                  <input className="form-input" type="email" value={config.financeEmailTo} onChange={(event) => updateField('financeEmailTo', event.target.value)} />
                </Field>
                <Field label="Diario">
                  <input className="form-input" type="email" value={config.dailyEmailTo} onChange={(event) => updateField('dailyEmailTo', event.target.value)} />
                </Field>
                <Field label="Mensual">
                  <input className="form-input" type="email" value={config.monthlyEmailTo} onChange={(event) => updateField('monthlyEmailTo', event.target.value)} />
                </Field>
                <Field label="Anual">
                  <input className="form-input" type="email" value={config.yearlyEmailTo} onChange={(event) => updateField('yearlyEmailTo', event.target.value)} />
                </Field>
              </div>
            </section>

            <Button type="submit" icon={RiSave3Line} color="emerald" loading={saving} loadingText="Guardando...">
              Guardar configuracion
            </Button>
          </form>
        </Card>

        <div className="grid gap-4">
          <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-4">
            <Title className="text-base">Estado</Title>
            <Text>{health.checkedAt ? `Revisado ${formatDate(health.checkedAt)}` : 'Sin lectura reciente'}</Text>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Summary label="OK" value={health.summary.ok} tone="emerald" />
              <Summary label="Avisos" value={health.summary.warnings} tone="amber" />
              <Summary label="Errores" value={health.summary.errors} tone="rose" />
              <Summary label="Latencia" value={`${health.summary.latencyMs} ms`} tone="cyan" />
            </div>
            <div className="mt-4 grid max-h-80 gap-2 overflow-auto">
              {health.checks.slice(0, 12).map((item) => (
                <HealthRow key={item.id} item={item} />
              ))}
            </div>
          </Card>

          <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-4">
            <Title className="text-base">Claves</Title>
            <Text>{updatedAt ? `Leido ${formatDate(updatedAt)}` : 'Sin lectura reciente'}</Text>
            <div className="mt-4 grid gap-2">
              {Object.entries(SECRET_LABELS).map(([key, label]) => {
                const ok = Boolean(secrets[key]);
                const Icon = ok ? RiCheckboxCircleLine : RiErrorWarningLine;
                return (
                  <div key={key} className="flex items-center justify-between gap-3 rounded-tremor-default border border-slate-800 bg-slate-900/40 px-3 py-2">
                    <span className="flex min-w-0 items-center gap-2 text-sm text-slate-200">
                      <Icon className={`h-4 w-4 shrink-0 ${ok ? 'text-emerald-300' : 'text-amber-300'}`} />
                      <span className="truncate">{label}</span>
                    </span>
                    <Badge color={ok ? 'emerald' : 'amber'}>{ok ? 'OK' : 'Falta'}</Badge>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-4">
          <Title className="text-base">Categorias</Title>
          <Text>Colores y categorias disponibles para el usuario seleccionado.</Text>
          <form className="mt-4 grid gap-2" onSubmit={submitCategory}>
            <input className="form-input" placeholder="categoria" value={categoryForm.category} onChange={(event) => setCategoryForm((current) => ({ ...current, category: event.target.value.toLowerCase() }))} />
            <select className="form-input" value={categoryForm.type} onChange={(event) => setCategoryForm((current) => ({ ...current, type: event.target.value }))}>
              <option value="gasto">Gasto</option>
              <option value="ingreso">Ingreso</option>
            </select>
            <input className="form-input" type="color" value={categoryForm.color} onChange={(event) => setCategoryForm((current) => ({ ...current, color: event.target.value }))} />
            <Button type="submit" icon={RiAddLine} color="emerald">Guardar categoria</Button>
          </form>
          <List>
            {categories.slice(0, 18).map((item) => (
              <Row key={item.id} title={item.category} subtitle={`${item.type} / ${item.scope}`} color={item.color} onDelete={item.scope === 'user' ? () => void remove('categories/delete', { category: item.category, type: item.type }) : undefined} />
            ))}
          </List>
        </Card>

        <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-4">
          <Title className="text-base">Reglas IA</Title>
          <Text>Palabras que fuerzan una categoria al leer recibos o textos.</Text>
          <form className="mt-4 grid gap-2" onSubmit={submitRule}>
            <input className="form-input" placeholder="palabra: kfc" value={ruleForm.keyword} onChange={(event) => setRuleForm((current) => ({ ...current, keyword: event.target.value }))} />
            <select className="form-input" value={ruleForm.category} onChange={(event) => setRuleForm((current) => ({ ...current, category: event.target.value }))}>
              {categoryOptions.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
            </select>
            <Button type="submit" icon={RiAddLine} color="emerald">Guardar regla</Button>
          </form>
          <List>
            {categoryRules.filter((item) => item.active).slice(0, 18).map((item) => (
              <Row key={item.id} title={item.keyword} subtitle={`${item.category} / ${item.scope}`} onDelete={() => void remove('rules/category/delete', { keyword: item.keyword })} />
            ))}
          </List>
        </Card>

        <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-4">
          <Title className="text-base">Presupuestos</Title>
          <Text>Categorias que se suman dentro de otro presupuesto.</Text>
          <form className="mt-4 grid gap-2" onSubmit={submitBudgetRule}>
            <Field label="Presupuesto">
              <select className="form-input" value={budgetForm.budgetCategory} onChange={(event) => setBudgetForm((current) => ({ ...current, budgetCategory: event.target.value }))}>
                {categoryOptions.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </Field>
            <Field label="Tambien suma">
              <select className="form-input" value={budgetForm.includedCategory} onChange={(event) => setBudgetForm((current) => ({ ...current, includedCategory: event.target.value }))}>
                {categoryOptions.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </Field>
            <Button type="submit" icon={RiAddLine} color="emerald">Guardar regla</Button>
          </form>
          <List>
            {budgetRules.filter((item) => item.active).map((item) => (
              <Row key={item.id} title={`${item.budgetCategory} incluye ${item.includedCategory}`} subtitle={item.scope} onDelete={() => void remove('rules/budget/delete', { budgetCategory: item.budgetCategory, includedCategory: item.includedCategory })} />
            ))}
          </List>
        </Card>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1 text-xs font-medium uppercase text-slate-400">
      {label}
      {children}
    </label>
  );
}

function Summary({ label, value, tone }: { label: string; value: number | string; tone: 'emerald' | 'amber' | 'rose' | 'cyan' }) {
  const colorClass = {
    emerald: 'text-emerald-200',
    amber: 'text-amber-200',
    rose: 'text-rose-200',
    cyan: 'text-cyan-200',
  }[tone];

  return (
    <div className="rounded-tremor-default border border-slate-800 bg-slate-900/40 p-3">
      <Text>{label}</Text>
      <p className={`mt-1 text-lg font-semibold ${colorClass}`}>{value}</p>
    </div>
  );
}

function HealthRow({ item }: { item: HealthCheck }) {
  const ok = item.status === 'ok';
  const warning = item.status === 'warning';
  const Icon = ok ? RiCheckboxCircleLine : RiErrorWarningLine;

  return (
    <div className="rounded-tremor-default border border-slate-800 bg-slate-900/40 p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-slate-100">
          <Icon className={`h-4 w-4 shrink-0 ${ok ? 'text-emerald-300' : warning ? 'text-amber-300' : 'text-rose-300'}`} />
          <span className="truncate">{item.label}</span>
        </span>
        <Badge color={ok ? 'emerald' : warning ? 'amber' : 'rose'}>{ok ? 'OK' : warning ? 'Aviso' : 'Error'}</Badge>
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-400">{item.message}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const warning = status === 'warning';
  const ok = status === 'ok';
  return (
    <Badge color={ok ? 'emerald' : warning ? 'amber' : 'rose'}>
      {ok ? 'Sistema OK' : warning ? 'Con avisos' : 'Con errores'}
    </Badge>
  );
}

function List({ children }: { children: ReactNode }) {
  return <div className="mt-4 grid max-h-96 gap-2 overflow-auto">{children}</div>;
}

function Row({ title, subtitle, color, onDelete }: { title: string; subtitle: string; color?: string; onDelete?: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-tremor-default border border-slate-800 bg-slate-900/40 px-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-100">
          <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color || '#64748b' }} />
          {title}
        </p>
        <p className="truncate text-xs text-slate-500">{subtitle}</p>
      </div>
      {onDelete ? (
        <button type="button" className="grid h-8 w-8 place-items-center rounded-tremor-default border border-rose-500/30 bg-rose-500/10 text-rose-200" onClick={onDelete} aria-label={`Desactivar ${title}`}>
          <RiDeleteBinLine className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}

function formatDate(value: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
