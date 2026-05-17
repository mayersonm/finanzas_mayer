import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Badge, Button, Card, Text, Title } from '@tremor/react';
import { RiCheckboxCircleLine, RiErrorWarningLine, RiRefreshLine, RiSave3Line } from '@remixicon/react';
import { apiEndpoint } from '../../app/api';
import type { AppSettingsConfig, AppSettingsData } from '../../types/dashboard';

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

const SECRET_LABELS: Record<string, string> = {
  telegramBotToken: 'Telegram token',
  dashboardApiKey: 'Dashboard API key',
  claudeApiKey: 'IA API key',
  d1AdminKey: 'D1 admin key',
  d1ApiUrl: 'D1 API URL',
  workerUrl: 'Worker URL',
  workerGasApiUrl: 'Worker GAS URL',
  workerGasApiKey: 'Worker GAS key',
  workerAdminKey: 'Worker admin key',
  workerDefaultChatId: 'Chat ID',
  workerSessionSecret: 'Sesion',
  r2Bucket: 'R2 recibos',
};

export function SettingsSection({ authToken, chatId }: { authToken?: string | null; chatId?: string }) {
  const [config, setConfig] = useState<AppSettingsConfig>(EMPTY_CONFIG);
  const [userLabel, setUserLabel] = useState('');
  const [secrets, setSecrets] = useState<Record<string, boolean>>({});
  const [updatedAt, setUpdatedAt] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadSettings = useCallback(async () => {
    if (!authToken) return;

    setLoading(true);
    setError('');
    try {
      const url = new URL(apiEndpoint('settings'));
      if (chatId) url.searchParams.set('chat_id', chatId);
      const response = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await response.json() as AppSettingsData;
      if (!response.ok || data.ok === false) throw new Error(data.error || 'No se pudo leer configuracion');

      setConfig({ ...EMPTY_CONFIG, ...data.config });
      setUserLabel(data.user?.label || data.user?.name || data.user?.chatId || '');
      setSecrets(data.secrets || {});
      setUpdatedAt(data.updatedAt || '');
    } catch (err) {
      console.error('Settings load error:', err);
      setError('No se pudo cargar la configuracion.');
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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!authToken) return;

    setSaving(true);
    setMessage('');
    setError('');

    try {
      const url = new URL(apiEndpoint('settings'));
      if (chatId) url.searchParams.set('chat_id', chatId);
      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...config, chatId }),
      });
      const data = await response.json() as AppSettingsData;
      if (!response.ok || data.ok === false) throw new Error(data.error || 'No se pudo guardar configuracion');

      setConfig({ ...EMPTY_CONFIG, ...data.config });
      setMessage('Configuracion guardada en Apps Script.');
      await loadSettings();
    } catch (err) {
      console.error('Settings save error:', err);
      setError(err instanceof Error ? err.message : 'No se pudo guardar configuracion.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-4 sm:!p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Title>Configuracion</Title>
            <Text>{userLabel ? `Preferencias de ${userLabel}` : 'Parametros operativos del bot y reportes.'}</Text>
          </div>
          <Button icon={RiRefreshLine} variant="secondary" color="slate" loading={loading} onClick={() => void loadSettings()}>
            Recargar
          </Button>
        </div>

        <form className="mt-5 grid gap-5" onSubmit={handleSubmit}>
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
            <h2 className="text-sm font-semibold text-slate-100">Preferencias por usuario</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="Moneda por defecto">
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
              <Field label="Maximo foto recibo">
                <input className="form-input" type="number" min={200000} max={3000000} step={1024} value={config.receiptImageMaxBytes} onChange={(event) => updateField('receiptImageMaxBytes', Number(event.target.value))} />
              </Field>
            </div>
            {config.claudeApiUrl ? <Text className="mt-2 text-xs">Endpoint IA: {config.claudeApiUrl}</Text> : null}
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

          {error ? <div className="rounded-tremor-default border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</div> : null}
          {message ? <div className="rounded-tremor-default border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">{message}</div> : null}

          <Button type="submit" icon={RiSave3Line} color="emerald" loading={saving} loadingText="Guardando...">
            Guardar configuracion
          </Button>
        </form>
      </Card>

      <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-4 sm:!p-6">
        <Title>Estado de secretos</Title>
        <Text>{updatedAt ? `Revisado ${updatedAt}` : 'Sin lectura reciente'}</Text>
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
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1 text-xs font-medium uppercase tracking-wide text-slate-400">
      {label}
      {children}
    </label>
  );
}
