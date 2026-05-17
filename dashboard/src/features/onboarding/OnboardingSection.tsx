import { useState, type ReactNode } from 'react';
import { Badge, Button, Card, Text, Title } from '@tremor/react';
import { RiAddLine, RiCheckboxCircleLine, RiErrorWarningLine, RiRefreshLine, RiSave3Line } from '@remixicon/react';
import { apiEndpoint } from '../../app/api';
import type { OnboardingStatus } from '../../types/dashboard';

export function OnboardingSection({
  authToken,
  status,
  onRefresh,
  onGoogleLogin,
}: {
  authToken?: string | null;
  status?: OnboardingStatus | null;
  onRefresh: () => Promise<void> | void;
  onGoogleLogin: () => void;
}) {
  const [telegramToken, setTelegramToken] = useState('');
  const [loadingAction, setLoadingAction] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function post(path: string, payload: Record<string, unknown> = {}) {
    if (!authToken) return;
    setLoadingAction(path);
    setMessage('');
    setError('');
    try {
      const response = await fetch(apiEndpoint(path), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({})) as { message?: string; error?: string };
      if (!response.ok) throw new Error(data.error || 'No se pudo completar la accion');
      setMessage(data.message || 'Listo.');
      setTelegramToken('');
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo completar la accion.');
    } finally {
      setLoadingAction('');
    }
  }

  const installation = status?.installation;
  const googleReady = Boolean(status?.google.connected);
  const telegramReady = Boolean(status?.telegram.configured || installation?.telegramConfigured);
  const provisioned = Boolean(installation?.spreadsheetId && installation?.scriptId);
  const ready = installation?.status === 'ready';

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-4 sm:!p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Title>{status?.appName || 'Finanzas personales'}</Title>
            <Text>{status?.user.email || status?.user.name || 'Usuario nuevo'}</Text>
          </div>
          <Button icon={RiRefreshLine} variant="secondary" color="slate" onClick={() => void onRefresh()}>
            Recargar
          </Button>
        </div>

        {message ? <div className="mt-4 rounded-tremor-default border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">{message}</div> : null}
        {error || installation?.lastError ? <div className="mt-4 rounded-tremor-default border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error || installation?.lastError}</div> : null}

        <div className="mt-5 grid gap-3">
          <Step
            title="Google"
            text={googleReady ? 'Cuenta autorizada.' : 'Autoriza Google para crear tu Sheet y Apps Script.'}
            done={googleReady}
            action={!googleReady ? <Button icon={RiAddLine} color="emerald" onClick={onGoogleLogin}>Conectar Google</Button> : null}
          />

          <Step
            title="Telegram"
            text={telegramReady ? 'Token guardado.' : 'Pega el token de BotFather para tu bot nuevo.'}
            done={telegramReady}
            action={!telegramReady ? (
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                <input
                  className="form-input"
                  type="password"
                  value={telegramToken}
                  placeholder="123456:ABC..."
                  onChange={(event) => setTelegramToken(event.target.value)}
                />
                <Button
                  icon={RiSave3Line}
                  color="emerald"
                  loading={loadingAction === 'onboarding/telegram'}
                  disabled={!telegramToken.trim()}
                  onClick={() => void post('onboarding/telegram', { telegramBotToken: telegramToken.trim() })}
                >
                  Guardar
                </Button>
              </div>
            ) : null}
          />

          <Step
            title="Google Sheet y Apps Script"
            text={provisioned ? 'Entorno creado.' : 'Crea una copia nueva con el nombre del usuario.'}
            done={provisioned}
            action={!provisioned ? (
              <Button
                icon={RiAddLine}
                color="emerald"
                loading={loadingAction === 'onboarding/provision'}
                disabled={!googleReady}
                onClick={() => void post('onboarding/provision')}
              >
                Crear entorno
              </Button>
            ) : null}
          />

          <Step
            title="Webhook"
            text={ready ? 'Bot conectado.' : 'Activa Telegram contra el Apps Script nuevo.'}
            done={ready}
            action={!ready ? (
              <Button
                icon={RiAddLine}
                color="emerald"
                loading={loadingAction === 'onboarding/webhook'}
                disabled={!telegramReady || !provisioned}
                onClick={() => void post('onboarding/webhook')}
              >
                Activar bot
              </Button>
            ) : null}
          />
        </div>
      </Card>

      <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-4 sm:!p-6">
        <Title>Instalacion</Title>
        <Text>Estado: {installation?.status || 'pending'}</Text>
        <div className="mt-4 grid gap-2 text-sm">
          <LinkRow label="Sheet" href={installation?.spreadsheetId ? `https://docs.google.com/spreadsheets/d/${installation.spreadsheetId}/edit` : ''} />
          <LinkRow label="Apps Script" href={installation?.scriptId ? `https://script.google.com/d/${installation.scriptId}/edit` : ''} />
          <LinkRow label="Web App" href={installation?.webAppUrl || ''} />
        </div>
        {status?.telegram.linkedChats.length ? (
          <div className="mt-5">
            <Text>Chats vinculados</Text>
            <div className="mt-2 grid gap-2">
              {status.telegram.linkedChats.map((chat) => (
                <div key={chat.chatId} className="rounded-tremor-default border border-slate-800 bg-slate-900/40 px-3 py-2 text-sm text-slate-200">
                  {chat.label} · {chat.chatId}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </Card>
    </div>
  );
}

function Step({ title, text, done, action }: { title: string; text: string; done: boolean; action?: ReactNode }) {
  const Icon = done ? RiCheckboxCircleLine : RiErrorWarningLine;
  return (
    <div className="rounded-tremor-default border border-slate-800 bg-slate-900/40 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Icon className={`h-5 w-5 ${done ? 'text-emerald-300' : 'text-amber-300'}`} />
            <p className="font-semibold text-slate-100">{title}</p>
            <Badge color={done ? 'emerald' : 'amber'}>{done ? 'OK' : 'Pendiente'}</Badge>
          </div>
          <p className="mt-1 text-sm text-slate-400">{text}</p>
        </div>
        {action}
      </div>
    </div>
  );
}

function LinkRow({ label, href }: { label: string; href?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-tremor-default border border-slate-800 bg-slate-900/40 px-3 py-2">
      <span className="text-slate-300">{label}</span>
      {href ? (
        <a className="text-emerald-300 hover:text-emerald-200" href={href} target="_blank" rel="noreferrer">
          Abrir
        </a>
      ) : (
        <span className="text-slate-500">Pendiente</span>
      )}
    </div>
  );
}
