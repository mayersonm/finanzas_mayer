import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Badge, Card, Text, Title } from '@tremor/react';
import { RiAddLine, RiCloseLine, RiSave3Line } from '@remixicon/react';
import { apiEndpoint } from '../../app/api';
import { BudgetProgress } from '../../components/dashboard/BudgetProgress';
import { DebtRow } from '../../components/dashboard/DebtRow';
import { EmailPanel } from '../../components/dashboard/EmailPanel';
import { FixedExpenseRow } from '../../components/dashboard/FixedExpenseRow';
import { EmptyState } from '../../components/common/EmptyState';
import { formatMoney, convertCurrency } from '../../lib/formatters';
import type { Currency, DashboardData, Debt, FixedExpense, RealExpenses } from '../../types/dashboard';

interface FixedDraft {
  id?: string;
  nombre: string;
  monto: string;
  currency: Currency;
  cat: string;
}

interface DebtDraft {
  id?: string;
  nombre: string;
  total: string;
  pagado: string;
  currency: Currency;
  vencimiento: string;
  notas: string;
}

interface PaymentDraft {
  debt?: Debt;
  amount: string;
  paymentDate: string;
  notes: string;
}

const emptyDebtDraft: DebtDraft = {
  nombre: '',
  total: '',
  pagado: '0',
  currency: 'PEN',
  vencimiento: '',
  notas: '',
};

const emptyFixedDraft: FixedDraft = {
  nombre: '',
  monto: '',
  currency: 'PEN',
  cat: 'servicios',
};

export function CommitmentsSection({
  data,
  realExpenses,
  exchangeRate = 3.85,
  authToken,
  chatId,
  onChanged,
}: {
  data: DashboardData;
  realExpenses: RealExpenses;
  exchangeRate?: number;
  authToken?: string | null;
  chatId?: string;
  onChanged?: () => void;
}) {
  const fixedExpenses = data.fijos || [];
  const debts = data.deudas || [];
  const [fixedDraft, setFixedDraft] = useState<FixedDraft>(emptyFixedDraft);
  const [fixedMessage, setFixedMessage] = useState('');
  const [fixedError, setFixedError] = useState('');
  const [draft, setDraft] = useState<DebtDraft>(emptyDebtDraft);
  const [payment, setPayment] = useState<PaymentDraft>({ amount: '', paymentDate: todayKey(), notes: '' });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const activeDebtTotal = useMemo(() => debts
    .filter((item) => item.estado !== 'pagada')
    .reduce((total, item) => {
      const currency = item.currency || 'PEN';
      const pendienteEnPEN = currency === 'USD' ? convertCurrency(item.pendiente, 'USD', 'PEN', exchangeRate) : item.pendiente;
      return total + pendienteEnPEN;
    }, 0), [debts, exchangeRate]);

  const startEditFixed = (item: FixedExpense) => {
    setFixedMessage('');
    setFixedError('');
    setFixedDraft({
      id: item.id,
      nombre: item.nombre,
      monto: String(item.monto || ''),
      currency: item.currency === 'USD' ? 'USD' : 'PEN',
      cat: item.cat || 'servicios',
    });
  };

  const resetFixedForm = () => {
    setFixedDraft(emptyFixedDraft);
    setFixedMessage('');
    setFixedError('');
  };

  const saveFixedExpense = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!authToken) return;
    setSaving(true);
    setFixedMessage('');
    setFixedError('');

    try {
      const payload = {
        chat_id: chatId,
        nombre: fixedDraft.nombre,
        monto: Number(fixedDraft.monto),
        currency: fixedDraft.currency,
        cat: fixedDraft.cat,
      };
      const url = fixedDraft.id ? `${apiEndpoint(`fixed-expenses/${encodeURIComponent(fixedDraft.id)}`)}${chatId ? `?chat_id=${encodeURIComponent(chatId)}` : ''}` : apiEndpoint('fixed-expenses');
      const response = await fetch(url, {
        method: fixedDraft.id ? 'PATCH' : 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const result = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || result.ok === false) throw new Error(result.error || 'No se pudo guardar el gasto fijo');
      setFixedMessage(fixedDraft.id ? 'Gasto fijo actualizado.' : 'Gasto fijo creado.');
      setFixedDraft(emptyFixedDraft);
      onChanged?.();
    } catch (err) {
      setFixedError(err instanceof Error ? err.message : 'No se pudo guardar el gasto fijo');
    } finally {
      setSaving(false);
    }
  };

  const deleteFixedExpense = async (item: FixedExpense) => {
    if (!authToken || !item.id) return;
    const ok = window.confirm(`Eliminar el gasto fijo "${item.nombre}"?`);
    if (!ok) return;

    setSaving(true);
    setFixedMessage('');
    setFixedError('');
    try {
      const url = `${apiEndpoint(`fixed-expenses/${encodeURIComponent(item.id)}`)}${chatId ? `?chat_id=${encodeURIComponent(chatId)}` : ''}`;
      const response = await fetch(url, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const result = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || result.ok === false) throw new Error(result.error || 'No se pudo eliminar el gasto fijo');
      setFixedMessage('Gasto fijo eliminado.');
      if (fixedDraft.id === item.id) setFixedDraft(emptyFixedDraft);
      onChanged?.();
    } catch (err) {
      setFixedError(err instanceof Error ? err.message : 'No se pudo eliminar el gasto fijo');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (item: Debt) => {
    setMessage('');
    setError('');
    setPayment({ amount: '', paymentDate: todayKey(), notes: '' });
    setDraft({
      id: item.id,
      nombre: item.nombre,
      total: String(item.total || ''),
      pagado: String(item.pagado || 0),
      currency: (item.currency === 'USD' ? 'USD' : 'PEN'),
      vencimiento: item.vencimiento || '',
      notas: item.notas || '',
    });
  };

  const startPay = (item: Debt) => {
    setMessage('');
    setError('');
    setPayment({
      debt: item,
      amount: item.pendiente > 0 ? String(item.pendiente) : '',
      paymentDate: todayKey(),
      notes: '',
    });
  };

  const resetDebtForm = () => {
    setDraft(emptyDebtDraft);
    setMessage('');
    setError('');
  };

  const saveDebt = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!authToken) return;
    setSaving(true);
    setMessage('');
    setError('');

    try {
      const payload = {
        chat_id: chatId,
        nombre: draft.nombre,
        total: Number(draft.total),
        pagado: Number(draft.pagado || 0),
        currency: draft.currency,
        vencimiento: draft.vencimiento,
        notas: draft.notas,
      };
      const url = draft.id ? `${apiEndpoint(`debts/${encodeURIComponent(draft.id)}`)}${chatId ? `?chat_id=${encodeURIComponent(chatId)}` : ''}` : apiEndpoint('debts');
      const response = await fetch(url, {
        method: draft.id ? 'PATCH' : 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const result = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || result.ok === false) throw new Error(result.error || 'No se pudo guardar la deuda');
      setMessage(draft.id ? 'Deuda actualizada.' : 'Deuda creada.');
      setDraft(emptyDebtDraft);
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la deuda');
    } finally {
      setSaving(false);
    }
  };

  const savePayment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!authToken || !payment.debt?.id) return;
    setSaving(true);
    setMessage('');
    setError('');

    try {
      const url = `${apiEndpoint(`debts/${encodeURIComponent(payment.debt.id)}/payments`)}${chatId ? `?chat_id=${encodeURIComponent(chatId)}` : ''}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: Number(payment.amount),
          currency: payment.debt.currency || 'PEN',
          paymentDate: payment.paymentDate,
          notes: payment.notes,
        }),
      });
      const result = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || result.ok === false) throw new Error(result.error || 'No se pudo registrar el pago');
      setMessage('Pago registrado.');
      setPayment({ amount: '', paymentDate: todayKey(), notes: '' });
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar el pago');
    } finally {
      setSaving(false);
    }
  };

  const deleteDebt = async (item: Debt) => {
    if (!authToken || !item.id) return;
    const ok = window.confirm(`Eliminar la deuda "${item.nombre}" y su historial de pagos?`);
    if (!ok) return;

    setSaving(true);
    setMessage('');
    setError('');
    try {
      const url = `${apiEndpoint(`debts/${encodeURIComponent(item.id)}`)}${chatId ? `?chat_id=${encodeURIComponent(chatId)}` : ''}`;
      const response = await fetch(url, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const result = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || result.ok === false) throw new Error(result.error || 'No se pudo eliminar la deuda');
      setMessage('Deuda eliminada.');
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar la deuda');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="grid gap-3 sm:gap-4 lg:grid-cols-2">
      <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-4 sm:!p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Title>Gastos fijos</Title>
            <Text>{fixedExpenses.length} activos</Text>
          </div>
          <Badge color="amber">{formatMoney(realExpenses.totalFijos)}</Badge>
        </div>

        <form className="mt-4 grid gap-3 rounded-tremor-default border border-slate-800 bg-slate-950/40 p-3" onSubmit={saveFixedExpense}>
          <div className="flex items-center justify-between gap-3">
            <Text className="font-semibold text-slate-100">{fixedDraft.id ? 'Editar gasto fijo' : 'Nuevo gasto fijo'}</Text>
            {fixedDraft.id ? (
              <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-tremor-default border border-slate-700 text-slate-300" onClick={resetFixedForm} title="Cancelar">
                <RiCloseLine className="h-4 w-4" />
              </button>
            ) : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nombre"><input className="form-input" value={fixedDraft.nombre} onChange={(event) => setFixedDraft((current) => ({ ...current, nombre: event.target.value }))} required /></Field>
            <Field label="Monto"><input className="form-input" type="number" min="0.01" step="0.01" value={fixedDraft.monto} onChange={(event) => setFixedDraft((current) => ({ ...current, monto: event.target.value }))} required /></Field>
            <Field label="Moneda">
              <select className="form-input" value={fixedDraft.currency} onChange={(event) => setFixedDraft((current) => ({ ...current, currency: event.target.value as Currency }))}>
                <option value="PEN">PEN</option>
                <option value="USD">USD</option>
              </select>
            </Field>
            <Field label="Categoría"><input className="form-input" value={fixedDraft.cat} onChange={(event) => setFixedDraft((current) => ({ ...current, cat: event.target.value }))} required /></Field>
          </div>
          <button className="inline-flex h-10 items-center justify-center gap-2 rounded-tremor-default bg-amber-400 px-4 text-sm font-semibold text-slate-950 transition hover:bg-amber-300 disabled:opacity-60" disabled={saving || !authToken}>
            {fixedDraft.id ? <RiSave3Line className="h-4 w-4" /> : <RiAddLine className="h-4 w-4" />}
            {fixedDraft.id ? 'Guardar fijo' : 'Crear fijo'}
          </button>
        </form>
        {fixedMessage ? <div className="mt-3 rounded-tremor-default border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-100">{fixedMessage}</div> : null}
        {fixedError ? <div className="mt-3 rounded-tremor-default border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-100">{fixedError}</div> : null}

        <div className="mt-4 sm:mt-5">
          {fixedExpenses.length ? (
            fixedExpenses.map((item) => (
              <FixedExpenseRow
                key={item.id || item.nombre}
                item={item}
                exchangeRate={exchangeRate}
                onEdit={startEditFixed}
                onDelete={deleteFixedExpense}
              />
            ))
          ) : (
            <EmptyState>Sin gastos fijos registrados.</EmptyState>
          )}
        </div>
      </Card>


      <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-4 sm:!p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Title>Presupuesto</Title>
            <Text>Si no hay gasto, se considera el limite completo.</Text>
          </div>
          <Badge color="sky">{formatMoney(realExpenses.totalPresupuesto)}</Badge>
        </div>
        <div className="mt-4 sm:mt-5">
          {data.presupuestos.length ? (
            data.presupuestos.map((item) => <BudgetProgress key={item.cat} item={item} />)
          ) : (
            <EmptyState>Sin presupuestos registrados.</EmptyState>
          )}
        </div>
      </Card>

      <Card>
        <form className="mt-5 grid gap-3 rounded-tremor-default border border-slate-800 bg-slate-950/40 p-3" onSubmit={saveDebt}>
          <div className="flex items-center justify-between gap-3">
            <Text className="font-semibold text-slate-100">{draft.id ? 'Editar deuda' : 'Nueva deuda'}</Text>
            {draft.id ? (
              <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-tremor-default border border-slate-700 text-slate-300" onClick={resetDebtForm} title="Cancelar">
                <RiCloseLine className="h-4 w-4" />
              </button>
            ) : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nombre"><input className="form-input" value={draft.nombre} onChange={(event) => setDraft((current) => ({ ...current, nombre: event.target.value }))} required /></Field>
            <Field label="Total"><input className="form-input" type="number" min="0.01" step="0.01" value={draft.total} onChange={(event) => setDraft((current) => ({ ...current, total: event.target.value }))} required /></Field>
            <Field label="Pagado"><input className="form-input" type="number" min="0" step="0.01" value={draft.pagado} onChange={(event) => setDraft((current) => ({ ...current, pagado: event.target.value }))} /></Field>
            <Field label="Moneda">
              <select className="form-input" value={draft.currency} onChange={(event) => setDraft((current) => ({ ...current, currency: event.target.value as Currency }))}>
                <option value="PEN">PEN</option>
                <option value="USD">USD</option>
              </select>
            </Field>
            <Field label="Vencimiento"><input className="form-input" type="date" value={draft.vencimiento} onChange={(event) => setDraft((current) => ({ ...current, vencimiento: event.target.value }))} /></Field>
            <Field label="Notas"><input className="form-input" value={draft.notas} onChange={(event) => setDraft((current) => ({ ...current, notas: event.target.value }))} /></Field>
          </div>
          <button className="inline-flex h-10 items-center justify-center gap-2 rounded-tremor-default bg-emerald-500 px-4 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-60" disabled={saving || !authToken}>
            {draft.id ? <RiSave3Line className="h-4 w-4" /> : <RiAddLine className="h-4 w-4" />}
            {draft.id ? 'Guardar deuda' : 'Crear deuda'}
          </button>
        </form>
      </Card>

      <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-4 sm:!p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Title>Deudas</Title>
            <Text>{debts.filter((item) => item.estado !== 'pagada').length} activas</Text>
          </div>
          <Badge color="rose">{formatMoney(activeDebtTotal)}</Badge>
        </div>

        {payment.debt ? (
          <form className="mt-3 grid gap-3 rounded-tremor-default border border-emerald-500/20 bg-emerald-500/10 p-3" onSubmit={savePayment}>
            <div className="flex items-center justify-between gap-3">
              <Text className="font-semibold text-emerald-100">Pagar {payment.debt.nombre}</Text>
              <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-tremor-default border border-emerald-500/30 text-emerald-100" onClick={() => setPayment({ amount: '', paymentDate: todayKey(), notes: '' })} title="Cancelar">
                <RiCloseLine className="h-4 w-4" />
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label={`Monto (${payment.debt.currency || 'PEN'})`}><input className="form-input" type="number" min="0.01" step="0.01" value={payment.amount} onChange={(event) => setPayment((current) => ({ ...current, amount: event.target.value }))} required /></Field>
              <Field label="Fecha"><input className="form-input" type="date" value={payment.paymentDate} onChange={(event) => setPayment((current) => ({ ...current, paymentDate: event.target.value }))} required /></Field>
              <Field label="Nota"><input className="form-input" value={payment.notes} onChange={(event) => setPayment((current) => ({ ...current, notes: event.target.value }))} /></Field>
            </div>
            <button className="inline-flex h-10 items-center justify-center gap-2 rounded-tremor-default bg-emerald-500 px-4 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-60" disabled={saving || !authToken}>
              <RiSave3Line className="h-4 w-4" />
              Registrar pago
            </button>
          </form>
        ) : null}

        {message ? <div className="mt-3 rounded-tremor-default border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-100">{message}</div> : null}
        {error ? <div className="mt-3 rounded-tremor-default border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-100">{error}</div> : null}

        <div className="mt-4 sm:mt-5">
          {debts.length ? (
            debts.map((item) => (
              <DebtRow
                key={item.id || item.nombre}
                item={item}
                exchangeRate={exchangeRate}
                onEdit={startEdit}
                onPay={startPay}
                onDelete={deleteDebt}
              />
            ))
          ) : (
            <EmptyState>Sin deudas registradas.</EmptyState>
          )}
        </div>
      </Card>

      

      <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-4 sm:!p-6">
        <div className="lg:col-span-2">
          <EmailPanel config={data.emailConfig} />
        </div>
      </Card>
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1 text-xs font-semibold text-slate-400">
      <span>{label}</span>
      {children}
    </label>
  );
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}
