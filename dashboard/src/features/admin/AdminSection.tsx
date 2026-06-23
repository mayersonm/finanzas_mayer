import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Badge, Button, Card, Text, Title } from '@tremor/react';
import { RiAddLine, RiDeleteBinLine, RiRefreshLine } from '@remixicon/react';
import { apiRequest } from '../../app/apiClient';
import type { BudgetRuleItem, CategoryDefinition, CategoryRuleItem, DashboardUser } from '../../types/dashboard';

const CATEGORIES = ['supermercado', 'transporte', 'servicios', 'entretenimiento', 'salud', 'ropa', 'educacion', 'salario', 'freelance', 'inversion', 'venta', 'otro'];

export function AdminSection({
  authToken,
  chatId,
  users,
}: {
  authToken?: string | null;
  chatId?: string;
  users: DashboardUser[];
}) {
  const [categories, setCategories] = useState<CategoryDefinition[]>([]);
  const [categoryRules, setCategoryRules] = useState<CategoryRuleItem[]>([]);
  const [budgetRules, setBudgetRules] = useState<BudgetRuleItem[]>([]);
  const [categoryForm, setCategoryForm] = useState({ category: '', type: 'gasto', color: '#6b7280' });
  const [ruleForm, setRuleForm] = useState({ keyword: '', category: 'otro' });
  const [budgetForm, setBudgetForm] = useState({ budgetCategory: 'supermercado', includedCategory: 'otro' });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!authToken) return;
    setLoading(true);
    setError('');
    try {
      const [categoryData, rulesData] = await Promise.all([
        apiRequest<{ categories?: CategoryDefinition[] }>('categories', { token: authToken, query: { chat_id: chatId } }),
        apiRequest<{ categoryRules?: CategoryRuleItem[]; budgetRules?: BudgetRuleItem[] }>('rules', { token: authToken, query: { chat_id: chatId } }),
      ]);

      setCategories(categoryData.categories || []);
      setCategoryRules(rulesData.categoryRules || []);
      setBudgetRules(rulesData.budgetRules || []);
    } catch (err) {
      console.error('Admin load error:', err);
      setError(err instanceof Error ? err.message : 'No se pudo cargar administracion.');
    } finally {
      setLoading(false);
    }
  }, [authToken, chatId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function post(path: string, payload: Record<string, unknown>) {
    if (!authToken) return;
    await apiRequest(path, {
      method: 'POST',
      token: authToken,
      query: { chat_id: chatId },
      body: { ...payload, chatId },
    });
  }

  async function submitCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setError('');
    try {
      await post('categories', categoryForm);
      setCategoryForm({ category: '', type: 'gasto', color: '#6b7280' });
      setMessage('Categoria guardada.');
      await load();
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
      setMessage('Regla guardada.');
      await load();
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
      setMessage('Regla de presupuesto guardada.');
      await load();
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
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo desactivar.');
    }
  }

  return (
    <div className="grid gap-4">
      <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-4 sm:!p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Title>Administracion</Title>
            <Text>Categorias, reglas y usuarios vinculados.</Text>
          </div>
          <Button icon={RiRefreshLine} loading={loading} variant="secondary" color="slate" onClick={() => void load()}>
            Recargar
          </Button>
        </div>
        {message ? <div className="mt-4 rounded-tremor-default border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">{message}</div> : null}
        {error ? <div className="mt-4 rounded-tremor-default border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</div> : null}
      </Card>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-4">
          <Title className="text-base">Usuarios</Title>
          <div className="mt-4 grid gap-2">
            {users.map((user) => (
              <div key={user.chatId} className="rounded-tremor-default border border-slate-800 bg-slate-900/40 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-slate-100">{user.label}</p>
                  <Badge color={user.role === 'admin' ? 'emerald' : 'slate'}>{user.role || 'user'}</Badge>
                </div>
                <p className="mt-1 text-xs text-slate-400">{user.chatId} · {user.transactions} movimientos</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-4">
          <Title className="text-base">Categorias</Title>
          <form className="mt-4 grid gap-2" onSubmit={submitCategory}>
            <input className="form-input" placeholder="categoria" value={categoryForm.category} onChange={(event) => setCategoryForm((current) => ({ ...current, category: event.target.value.toLowerCase() }))} />
            <select className="form-input" value={categoryForm.type} onChange={(event) => setCategoryForm((current) => ({ ...current, type: event.target.value }))}>
              <option value="gasto">Gasto</option>
              <option value="ingreso">Ingreso</option>
            </select>
            <input className="form-input" type="color" value={categoryForm.color} onChange={(event) => setCategoryForm((current) => ({ ...current, color: event.target.value }))} />
            <Button icon={RiAddLine} color="emerald">Guardar categoria</Button>
          </form>
          <List>
            {categories.slice(0, 18).map((item) => (
              <Row key={item.id} title={item.category} subtitle={`${item.type} · ${item.scope}`} color={item.color} onDelete={item.scope === 'user' ? () => void remove('categories/delete', { category: item.category, type: item.type }) : undefined} />
            ))}
          </List>
        </Card>

        <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-4">
          <Title className="text-base">Reglas</Title>
          <form className="mt-4 grid gap-2" onSubmit={submitRule}>
            <input className="form-input" placeholder="palabra: kfc" value={ruleForm.keyword} onChange={(event) => setRuleForm((current) => ({ ...current, keyword: event.target.value }))} />
            <select className="form-input" value={ruleForm.category} onChange={(event) => setRuleForm((current) => ({ ...current, category: event.target.value }))}>
              {CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
            </select>
            <Button icon={RiAddLine} color="emerald">Guardar regla</Button>
          </form>
          <List>
            {categoryRules.filter((item) => item.active).slice(0, 14).map((item) => (
              <Row key={item.id} title={item.keyword} subtitle={`${item.category} · ${item.scope}`} onDelete={() => void remove('rules/category/delete', { keyword: item.keyword })} />
            ))}
          </List>
        </Card>
      </div>

      <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-4">
        <Title className="text-base">Reglas de presupuesto</Title>
        <form className="mt-4 grid gap-2 md:grid-cols-[1fr_1fr_auto]" onSubmit={submitBudgetRule}>
          <select className="form-input" value={budgetForm.budgetCategory} onChange={(event) => setBudgetForm((current) => ({ ...current, budgetCategory: event.target.value }))}>
            {CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
          </select>
          <select className="form-input" value={budgetForm.includedCategory} onChange={(event) => setBudgetForm((current) => ({ ...current, includedCategory: event.target.value }))}>
            {CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
          </select>
          <Button icon={RiAddLine} color="emerald">Guardar</Button>
        </form>
        <List>
          {budgetRules.filter((item) => item.active).map((item) => (
            <Row key={item.id} title={`${item.budgetCategory} incluye ${item.includedCategory}`} subtitle={item.scope} onDelete={() => void remove('rules/budget/delete', { budgetCategory: item.budgetCategory, includedCategory: item.includedCategory })} />
          ))}
        </List>
      </Card>
    </div>
  );
}

function List({ children }: { children: ReactNode }) {
  return <div className="mt-4 grid max-h-96 gap-2 overflow-auto">{children}</div>;
}

function Row({ title, subtitle, color, onDelete }: { title: string; subtitle: string; color?: string; onDelete?: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-tremor-default border border-slate-800 bg-slate-900/40 px-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-100"><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color || '#64748b' }} />{title}</p>
        <p className="text-xs text-slate-500">{subtitle}</p>
      </div>
      {onDelete ? (
        <button type="button" className="grid h-8 w-8 place-items-center rounded-tremor-default border border-rose-500/30 bg-rose-500/10 text-rose-200" onClick={onDelete}>
          <RiDeleteBinLine className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}
