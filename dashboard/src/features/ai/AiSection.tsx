import { useMemo, useState, type FormEvent } from 'react';
import { Badge, Card, Text, Title, type Color } from '@tremor/react';
import { apiRequest } from '../../app/apiClient';
import { SparklesIcon } from '../../components/common/AppIcons';
import { formatMoney } from '../../lib/formatters';
import type { DashboardData } from '../../types/dashboard';

type AiMessageRole = 'user' | 'assistant';

type AiMessage = {
  id: string;
  role: AiMessageRole;
  content: string;
  result?: AdvisorResult;
};

type AdvisorResult = {
  ok?: boolean;
  title?: string;
  summary?: string;
  bullets?: string[];
  actions?: string[];
  riskLevel?: 'bajo' | 'medio' | 'alto' | string;
  source?: 'ai' | 'local' | string;
  providerStatus?: string;
  providerError?: string;
  note?: string;
  error?: string;
};

export function AiSection({
  data,
  authToken,
  chatId,
}: {
  data: DashboardData;
  authToken?: string | null;
  chatId?: string;
}) {
  const [messages, setMessages] = useState<AiMessage[]>(() => [
    {
      id: createMessageId(),
      role: 'assistant',
      content: 'Listo. Dime que quieres decidir con tu caja, deudas, presupuesto o cierre.',
    },
  ]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const context = useMemo(() => contextCards(data), [data]);
  const quickPrompts = useMemo(() => [
    'Cuanto puedo gastar hoy?',
    'Que recorto primero?',
    'Que pago primero?',
    `Arma un plan hasta el cierre ${data.cycleClose ? shortDate(data.cycleClose) : ''}`.trim(),
  ], [data.cycleClose]);
  const latestAssistant = [...messages].reverse().find((item) => item.role === 'assistant' && item.result);
  const providerLabel = latestAssistant?.result?.source === 'ai'
    ? 'IA activa'
    : latestAssistant?.result?.source === 'local'
      ? 'Modo local'
      : 'Disponible';
  const providerColor: Color = latestAssistant?.result?.source === 'ai' ? 'emerald' : latestAssistant?.result?.source === 'local' ? 'amber' : 'slate';

  async function sendMessage(text?: string) {
    const question = String(text ?? draft).trim();
    if (!question || !authToken || loading) return;

    const userMessage: AiMessage = {
      id: createMessageId(),
      role: 'user',
      content: question,
    };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setDraft('');
    setError('');
    setLoading(true);

    try {
      const result = await apiRequest<AdvisorResult>('ai/advisor', {
        method: 'POST',
        token: authToken,
        query: { chat_id: chatId },
        body: { mode: 'chat', question, history: historyPayload(nextMessages) },
      });

      setMessages((current) => [
        ...current,
        {
          id: createMessageId(),
          role: 'assistant',
          content: assistantPlainText(result),
          result,
        },
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo consultar la IA';
      setError(message);
      setMessages((current) => [
        ...current,
        {
          id: createMessageId(),
          role: 'assistant',
          content: `No pude responder ahora. ${message}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage();
  }

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_19rem]">
      <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-0">
        <div className="border-b border-slate-800 p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Title>Chat IA</Title>
                <Badge color={providerColor}>{providerLabel}</Badge>
              </div>
              <Text className="mt-1">{data.cycleRange || data.mes}</Text>
            </div>
            <button
              type="button"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-tremor-default border border-slate-800 bg-slate-900/30 px-3 text-sm font-semibold text-slate-300 transition hover:border-slate-700 hover:bg-slate-900/70 hover:text-slate-100"
              onClick={() => setMessages([{
                id: createMessageId(),
                role: 'assistant',
                content: 'Listo. Dime que quieres decidir con tu caja, deudas, presupuesto o cierre.',
              }])}
            >
              Reiniciar
            </button>
          </div>
        </div>

        <div className="grid max-h-[min(70vh,46rem)] min-h-[28rem] gap-3 overflow-y-auto p-4 sm:p-5">
          {messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))}
          {loading ? (
            <div className="max-w-[88%] rounded-tremor-default border border-slate-800 bg-slate-900/30 px-3 py-3 text-sm text-slate-300">
              <div className="flex items-center gap-2">
                <SparklesIcon className="h-4 w-4 animate-pulse text-emerald-300" aria-hidden="true" />
                Analizando caja, historial y contexto actual...
              </div>
            </div>
          ) : null}
        </div>

        <div className="border-t border-slate-800 p-4 sm:p-5">
          {error ? (
            <div className="mb-3 rounded-tremor-default border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm font-medium text-rose-100">
              {error}
            </div>
          ) : null}

          <div className="mb-3 flex flex-wrap gap-2">
            {quickPrompts.map((item) => (
              <button
                key={item}
                type="button"
                className="rounded-full border border-slate-800 bg-slate-900/30 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-cyan-400/50 hover:text-cyan-200 disabled:cursor-wait disabled:opacity-60"
                disabled={loading || !authToken}
                onClick={() => void sendMessage(item)}
              >
                {item}
              </button>
            ))}
          </div>

          <form className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]" onSubmit={submit}>
            <textarea
              className="min-h-[4.75rem] w-full resize-y rounded-tremor-default border border-slate-800 bg-slate-950/70 px-3 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              value={draft}
              disabled={loading || !authToken}
              placeholder="Escribe tu pregunta"
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void sendMessage();
                }
              }}
            />
            <button
              type="submit"
              className="inline-flex h-12 items-center justify-center rounded-tremor-default border border-emerald-500/40 bg-emerald-500/10 px-5 text-sm font-semibold text-emerald-100 transition hover:border-emerald-400/60 hover:bg-emerald-500/15 focus:outline-none focus:ring-2 focus:ring-emerald-400/30 disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-900/70 disabled:text-slate-500 disabled:opacity-60 sm:h-auto"
              disabled={loading || !authToken || !draft.trim()}
            >
              Enviar
            </button>
          </form>
        </div>
      </Card>

      <aside className="grid gap-3 content-start">
        <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-4">
          <Title>Contexto</Title>
          <Text>{data.cycleLabel || data.mes}</Text>
          <div className="mt-4 grid gap-2">
            {context.map((item) => (
              <div key={item.label} className="rounded-tremor-default border border-slate-800 bg-slate-900/30 px-3 py-2">
                <p className="text-xs font-medium text-slate-500">{item.label}</p>
                <p className={`mt-1 truncate font-mono text-sm font-semibold ${item.tone}`}>{item.value}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-4">
          <Title>Fugas</Title>
          <div className="mt-3 grid gap-2">
            {(data.topFugas || []).slice(0, 3).map((item) => (
              <div key={`${item.category}-${item.label}`} className="min-w-0 rounded-tremor-default border border-slate-800 bg-slate-900/30 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-semibold text-slate-100">{item.label}</p>
                  <p className="shrink-0 font-mono text-xs font-semibold text-slate-300">{formatMoney(item.amount)}</p>
                </div>
                <p className="mt-1 truncate text-xs text-slate-500">{item.count} movimientos</p>
              </div>
            ))}
            {data.topFugas?.length ? null : <Text>Sin fugas fuertes.</Text>}
          </div>
        </Card>
      </aside>
    </section>
  );
}

function ChatMessage({ message }: { message: AiMessage }) {
  const isUser = message.role === 'user';
  const result = message.result;

  return (
    <article className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[88%] rounded-tremor-default border px-3 py-3 text-sm shadow-sm ${
        isUser
          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
          : 'border-slate-800 bg-slate-900/30 text-slate-300'
      }`}
      >
        {result ? (
          <div className="grid gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold text-slate-100">{result.title || 'Respuesta IA'}</p>
              {result.providerStatus ? <Badge color={result.source === 'ai' ? 'emerald' : 'amber'}>{providerStatusLabel(result.providerStatus)}</Badge> : null}
            </div>
            {result.summary ? <p className="text-slate-400">{result.summary}</p> : null}
            {result.bullets?.length ? (
              <div className="grid gap-2">
                {result.bullets.map((item) => (
                  <p key={item} className="rounded-tremor-default border border-slate-800 bg-slate-950/40 px-3 py-2">
                    {item}
                  </p>
                ))}
              </div>
            ) : null}
            {result.actions?.length ? (
              <div className="grid gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Siguiente jugada</p>
                {result.actions.map((item) => (
                  <div key={item} className="flex gap-2">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            ) : null}
            {result.note || result.providerError ? <p className="text-xs text-slate-500">{result.note || result.providerError}</p> : null}
          </div>
        ) : (
          <p className="whitespace-pre-wrap">{message.content}</p>
        )}
      </div>
    </article>
  );
}

function contextCards(data: DashboardData) {
  const free = data.dineroLibre;
  const cierre = data.cierre;

  return [
    {
      label: 'Caja actual',
      value: formatMoney(data.balance || 0),
      tone: (data.balance || 0) >= 0 ? 'text-emerald-300' : 'text-rose-300',
    },
    {
      label: 'Gasto diario',
      value: formatMoney(free?.daily?.normal || data.automatizacion?.daily?.normal || 0),
      tone: 'text-cyan-300',
    },
    {
      label: 'Presupuesto',
      value: formatMoney(cierre?.presupuestoRestante || free?.budgetRemaining || 0),
      tone: (cierre?.presupuestoRestante || 0) < 0 ? 'text-rose-300' : 'text-emerald-300',
    },
    {
      label: 'Deuda pendiente',
      value: formatMoney(data.deudaPendiente || cierre?.deudasPendientes || 0),
      tone: 'text-amber-300',
    },
  ];
}

function historyPayload(messages: AiMessage[]) {
  return messages
    .slice(-10)
    .map((message) => ({
      role: message.role,
      content: message.content.slice(0, 1000),
    }));
}

function assistantPlainText(result: AdvisorResult) {
  return [
    result.title || '',
    result.summary || '',
    ...(result.bullets || []),
    ...(result.actions || []),
  ].filter(Boolean).join('\n');
}

function providerStatusLabel(value: string) {
  if (value.includes('error') || value.includes('fallback') || value.includes('missing')) return 'Local';
  if (value.includes('apps_script')) return 'Apps Script';
  if (value === 'ok') return 'Worker';
  return 'IA';
}

function createMessageId() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function shortDate(value: string) {
  const [, month, day] = value.split('-');
  return month && day ? `${day}/${month}` : value;
}
