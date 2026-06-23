import { formatCurrency, round } from '../../shared/money.js';
import { timeoutSignal } from '../../shared/settings-store.js';

const PROVIDER_TIMEOUT_MS = 10000;
const GAS_ADVISOR_TIMEOUT_MS = 45000;

export async function advisorResponse(env, dashboardData, settings, payload = {}) {
  const question = String(payload.question || '').trim().slice(0, 500);
  const mode = String(payload.mode || (question ? 'question' : 'daily')).toLowerCase();
  const history = normalizeHistory(payload.history);
  const context = buildAdvisorContext(dashboardData);
  const fallback = localAdvisor(context, question, mode);
  const provider = providerConfig(env, settings);
  const prompt = buildPrompt(context, question, mode, history);

  if (provider.apiKey) {
    try {
      return aiResult(await callProvider(provider, prompt), fallback, context, 'ok');
    } catch (error) {
      const gasResult = await callGasAdvisor(env, prompt).catch(() => null);
      if (gasResult?.text) {
        return aiResult(gasResult.text, fallback, context, gasResult.providerStatus || 'apps_script');
      }

      return {
        ...fallback,
        source: 'local',
        providerStatus: 'fallback',
        providerError: shortProviderError(error),
        note: 'La IA externa no respondio a tiempo; usando analisis local.',
      };
    }
  }

  const gasResult = await callGasAdvisor(env, prompt).catch((error) => ({
    error: shortProviderError(error),
  }));
  if (gasResult?.text) {
    return aiResult(gasResult.text, fallback, context, gasResult.providerStatus || 'apps_script');
  }

  return {
    ...fallback,
    source: 'local',
    providerStatus: gasResult?.error ? 'apps_script_error' : 'missing_key',
    providerError: gasResult?.error || '',
    note: gasResult?.error
      ? 'Apps Script no pudo consultar IA; usando analisis local.'
      : 'IA externa sin API key disponible; usando analisis local.',
  };
}

function buildAdvisorContext(data) {
  const cierre = data?.cierre || {};
  const free = data?.dineroLibre || {};
  const automation = data?.automatizacion || {};
  const daily = free.daily || automation.daily || {};
  const budgetRisk = (automation.budgets?.watched || [])
    .filter((item) => item.status !== 'ok' || Number(item.pct || 0) >= 80)
    .slice(0, 5);

  return {
    cycle: {
      label: data?.cycleLabel || data?.mes || '',
      range: data?.cycleRange || cierre.range || '',
      closeDate: data?.cycleClose || cierre.closeDate || free.closeDate || '',
      daysLeft: Number(free.daysLeft || automation.daily?.daysLeft || 0),
      movements: Number(data?.movimientosMes || cierre.movimientos || 0),
    },
    cash: round(data?.balance || 0),
    patrimonioDisponible: round(data?.patrimonioDisponible || data?.patrimonio || 0),
    ingresosCiclo: round(cierre.ingresos || data?.ingresosMes || 0),
    gastosCiclo: round(cierre.gastos || data?.gastosMes || 0),
    pendienteComprometido: round(cierre.pendienteComprometido || 0),
    deudasPendientes: round(cierre.deudasPendientes || data?.deudaPendiente || 0),
    fijosPendientes: round(cierre.fijosPendientes || data?.fijosPendientes || 0),
    presupuesto: {
      limite: round(cierre.presupuestoLimite || 0),
      usado: round(cierre.presupuestoUsado || 0),
      restante: round(cierre.presupuestoRestante || free.budgetRemaining || 0),
      excedido: round(cierre.presupuestoExcedido || 0),
    },
    dineroLibre: {
      disponibleParaGastar: round(free.availableToSpend || automation.daily?.availableToSpend || 0),
      diarioSeguro: round(daily.safe || 0),
      diarioNormal: round(daily.normal || 0),
      diarioFlexible: round(daily.flexible || 0),
      ahorroSugerido: round(free.recommendedSavings || 0),
      inversionSugerida: round(free.investment?.amount || 0),
      estado: free.statusLabel || free.status || '',
    },
    topFugas: (data?.topFugas || []).slice(0, 5).map((item) => ({
      label: item.label,
      category: item.category,
      amount: round(item.amount || 0),
      sharePct: Number(item.sharePct || 0),
      reason: item.reason || '',
    })),
    presupuestosRiesgo: budgetRisk.map((item) => ({
      category: item.category,
      limit: round(item.limit || 0),
      spent: round(item.spent || 0),
      remaining: round(item.remaining || 0),
      pct: Number(item.pct || 0),
      status: item.status,
    })),
    alertas: (data?.alertas || []).slice(0, 5).map((item) => ({
      level: item.level || 'info',
      title: item.title || '',
      message: item.message || '',
    })),
    insights: (data?.insights || []).slice(0, 5).map((item) => ({
      title: item.title || '',
      message: item.message || '',
    })),
  };
}

function localAdvisor(context, question, mode) {
  const cash = context.cash;
  const daily = context.dineroLibre.diarioNormal;
  const safeDaily = context.dineroLibre.diarioSeguro;
  const pending = context.pendienteComprometido;
  const budgetRemaining = context.presupuesto.restante;
  const topLeak = context.topFugas[0];
  const riskLevel = cash <= 0 || daily <= 0 ? 'alto' : daily < 25 || pending > cash * 0.65 ? 'medio' : 'bajo';
  const title = mode === 'question' && question ? 'Respuesta financiera' : 'Consejo de hoy';
  const bullets = [
    `Caja actual: ${formatCurrency(cash, 'PEN')}. Base real para decidir gasto hoy.`,
    `Gasto diario recomendado: ${formatCurrency(daily, 'PEN')} (modo seguro ${formatCurrency(safeDaily, 'PEN')}).`,
    `Compromisos pendientes: ${formatCurrency(pending, 'PEN')}; presupuesto restante: ${formatCurrency(budgetRemaining, 'PEN')}.`,
  ];

  if (topLeak) {
    bullets.push(`Mayor fuga: ${topLeak.label} con ${formatCurrency(topLeak.amount, 'PEN')}.`);
  }

  const actions = [];
  if (daily <= 0) {
    actions.push('No abras gasto variable nuevo hasta revisar caja y pendientes.');
  } else if (daily < 25) {
    actions.push(`Usa modo seguro: intenta no pasar de ${formatCurrency(safeDaily, 'PEN')} por dia.`);
  } else {
    actions.push(`Puedes operar con un techo diario cercano a ${formatCurrency(daily, 'PEN')}.`);
  }

  if (topLeak) {
    actions.push(`Revisa ${topLeak.label} antes de comprar de nuevo en esa categoria.`);
  }

  if (context.presupuestosRiesgo.length) {
    actions.push(`Cuida ${context.presupuestosRiesgo[0].category}: ya va en ${context.presupuestosRiesgo[0].pct}% del limite.`);
  }

  if (context.dineroLibre.ahorroSugerido > 0) {
    actions.push(`Ahorro sugerido del ciclo: ${formatCurrency(context.dineroLibre.ahorroSugerido, 'PEN')}. No lo congeles hasta separarlo de verdad.`);
  }

  return {
    ok: true,
    title,
    summary: question
      ? `Con lo registrado ahora, responde usando caja actual y cierre ${context.cycle.range || context.cycle.label}.`
      : `Tu caja actual manda: ${formatCurrency(cash, 'PEN')} con ${context.cycle.daysLeft || 0} dias para el cierre.`,
    bullets: bullets.slice(0, 5),
    actions: actions.slice(0, 4),
    riskLevel,
    generatedAt: new Date().toISOString(),
    context,
  };
}

function providerConfig(env, settings) {
  return {
    apiKey: String(env.CLAUDE_API_KEY || env.ANTHROPIC_API_KEY || env.AI_API_KEY || env.OPENAI_API_KEY || env.claude_api_key || '').trim(),
    apiUrl: String(settings?.claudeApiUrl || env.CLAUDE_API_URL || env.ANTHROPIC_API_URL || env.AI_API_URL || env.claude_api_url || 'https://api.anthropic.com/v1/messages').trim(),
    model: String(settings?.claudeModel || env.CLAUDE_MODEL || env.AI_MODEL || env.claude_model || 'claude-haiku-4-5-20251001').trim(),
  };
}

function buildPrompt(context, question, mode, history = []) {
  return {
    system: [
      'Eres el consejero financiero de un dashboard personal.',
      'Responde en espanol claro, directo y corto.',
      'Usa siempre caja actual como base para decidir cuanto puede gastar hoy.',
      'No confundas balance del ciclo con caja actual.',
      'No inventes meses, ingresos ni gastos fuera del JSON.',
      'Usa el historial solo para continuidad conversacional; los montos del contexto financiero son la fuente de verdad.',
      'Si el usuario pide explicar una respuesta anterior, conecta con el historial, pero recalcula con el contexto actual.',
      'No digas crisis de ingresos si la pregunta no lo exige.',
      'No des asesorias financieras profesionales ni recomiendes productos especificos.',
      'Devuelve solo JSON valido con: title, summary, bullets, actions, riskLevel.',
    ].join(' '),
    user: JSON.stringify({
      mode,
      question: question || 'Dame el consejo financiero de hoy.',
      conversation: history,
      context,
      responseContract: {
        title: 'string',
        summary: 'string de maximo 180 caracteres',
        bullets: ['3 a 5 puntos con montos exactos'],
        actions: ['2 a 4 acciones concretas'],
        riskLevel: 'bajo | medio | alto',
      },
    }),
  };
}

function normalizeHistory(history) {
  if (!Array.isArray(history)) return [];

  return history
    .map((item) => ({
      role: String(item?.role || '').toLowerCase() === 'user' ? 'user' : 'assistant',
      content: String(item?.content || '').replace(/\s+/g, ' ').trim().slice(0, 1000),
    }))
    .filter((item) => item.content)
    .slice(-10);
}

async function callProvider(provider, prompt) {
  const firstUrl = provider.apiUrl;
  const wantsChat = /\/chat\/completions\/?$/i.test(firstUrl) || /^gpt-/i.test(provider.model);

  if (wantsChat) {
    return callChatCompletions(provider, fallbackChatUrl(firstUrl), prompt);
  }

  try {
    const text = await callMessages(provider, firstUrl, prompt);
    // Algunos grupos del proveedor responden 200 en /v1/messages pero con
    // content vacio (modo container); /v1/chat/completions si entrega el texto.
    if (text && text.trim()) return text;
    return callChatCompletions(provider, fallbackChatUrl(firstUrl), prompt);
  } catch (error) {
    if ([400, 403, 404, 405].includes(Number(error.status || 0))) {
      return callChatCompletions(provider, fallbackChatUrl(firstUrl), prompt);
    }
    throw error;
  }
}

async function callGasAdvisor(env, prompt) {
  if (!env.GAS_API_URL || !env.GAS_API_KEY) return null;

  const url = new URL(env.GAS_API_URL);
  url.searchParams.set('action', 'ai_advisor');
  url.searchParams.set('key', env.GAS_API_KEY);

  const response = await fetch(url.toString(), {
    method: 'POST',
    signal: timeoutSignal(GAS_ADVISOR_TIMEOUT_MS),
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.ok === false) {
    throw new Error(data.error || `Apps Script IA HTTP ${response.status}`);
  }

  return {
    text: String(data.text || '').trim(),
    providerStatus: data.providerStatus || data.source || 'apps_script',
  };
}

function aiResult(text, fallback, context, providerStatus) {
  const parsed = parseAdvisorJson(text, fallback);
  return {
    ...parsed,
    ok: true,
    source: 'ai',
    providerStatus,
    generatedAt: new Date().toISOString(),
    context,
  };
}

async function callMessages(provider, apiUrl, prompt) {
  const response = await fetch(apiUrl, {
    method: 'POST',
    signal: timeoutSignal(PROVIDER_TIMEOUT_MS),
    headers: {
      'content-type': 'application/json',
      'x-api-key': provider.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: provider.model,
      max_tokens: 700,
      temperature: 0.15,
      system: prompt.system,
      messages: [{ role: 'user', content: prompt.user }],
    }),
  });

  const data = await parseProviderResponse(response);
  return data.content?.map((item) => item.text || '').join('\n').trim() || '';
}

async function callChatCompletions(provider, apiUrl, prompt) {
  const response = await fetch(apiUrl, {
    method: 'POST',
    signal: timeoutSignal(PROVIDER_TIMEOUT_MS),
    headers: {
      'content-type': 'application/json',
      Authorization: `Bearer ${provider.apiKey}`,
    },
    body: JSON.stringify({
      model: provider.model,
      max_tokens: 700,
      temperature: 0.15,
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ],
    }),
  });

  const data = await parseProviderResponse(response);
  return data.choices?.[0]?.message?.content || '';
}

async function parseProviderResponse(response) {
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch (_error) {
    data = { raw: text };
  }

  if (!response.ok) {
    const error = new Error(providerErrorMessage(response.status, data, text));
    error.status = response.status;
    throw error;
  }

  return data;
}

function parseAdvisorJson(text, fallback) {
  const raw = String(text || '').trim();
  if (!raw) return fallback;
  const cleaned = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();
  const match = cleaned.match(/\{[\s\S]*\}/);

  try {
    const parsed = JSON.parse(match ? match[0] : cleaned);
    return sanitizeAdvisor(parsed, fallback);
  } catch (_error) {
    return {
      ...fallback,
      summary: cleaned.slice(0, 420),
      bullets: fallback.bullets,
      actions: fallback.actions,
    };
  }
}

function sanitizeAdvisor(parsed, fallback) {
  const bullets = Array.isArray(parsed.bullets) ? parsed.bullets : fallback.bullets;
  const actions = Array.isArray(parsed.actions) ? parsed.actions : fallback.actions;

  return {
    ok: true,
    title: String(parsed.title || fallback.title).slice(0, 80),
    summary: String(parsed.summary || fallback.summary).slice(0, 320),
    bullets: bullets.map((item) => String(item).slice(0, 220)).filter(Boolean).slice(0, 5),
    actions: actions.map((item) => String(item).slice(0, 220)).filter(Boolean).slice(0, 4),
    riskLevel: ['bajo', 'medio', 'alto'].includes(String(parsed.riskLevel || '').toLowerCase())
      ? String(parsed.riskLevel).toLowerCase()
      : fallback.riskLevel,
  };
}

function fallbackChatUrl(apiUrl) {
  if (/\/messages\/?$/i.test(apiUrl)) return apiUrl.replace(/\/messages\/?$/i, '/chat/completions');
  if (/\/v1\/?$/i.test(apiUrl)) return `${apiUrl.replace(/\/+$/, '')}/chat/completions`;
  return apiUrl;
}

function providerErrorMessage(status, data, rawText) {
  const message = data?.error?.message || data?.message || data?.raw || rawText || 'Proveedor IA sin respuesta valida';
  return `HTTP ${status} ${String(message).slice(0, 180)}`;
}

function shortProviderError(error) {
  const message = error instanceof Error ? error.message : String(error || '');
  return message.slice(0, 220);
}
