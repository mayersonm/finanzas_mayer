import { classifyCategoryFromLoadedRules, matchCategoryRule, normalizeRuleKeyword } from '../../shared/categories.js';
import { daysBetween, localDateKey } from '../../shared/dates.js';
import { formatCurrency, round, currencyToPen } from '../../shared/money.js';
import { normalizeKey, title } from '../../shared/normalizers.js';

export async function automationCenter(env, {
  chatId,
  now,
  cycle,
  expenseRows,
  categoryRules,
  budgetRules,
  budgets,
  alerts,
  freeMoney,
  cierre,
  cierreAutomatico,
  topFugas,
  fixedSummary,
  deudaPendiente,
  usdRate = 3.85,
}) {
  const [sync, ruleStats] = await Promise.all([
    syncStatus(env, chatId, now),
    rulesStatus({
      expenseRows,
      categoryRules,
      budgetRules,
      usdRate,
    }),
  ]);
  const budgetWatch = budgetWatchList(budgets);
  const actions = automationActions({
    sync,
    ruleStats,
    budgetWatch,
    alerts,
    freeMoney,
    cierre,
    cierreAutomatico,
    topFugas,
    fixedSummary,
    deudaPendiente,
  });
  const score = automationScore({ sync, ruleStats, budgetWatch, freeMoney, cierre, alerts });
  const status = score >= 80 ? 'ok' : score >= 60 ? 'watch' : 'attention';

  return {
    status,
    statusLabel: status === 'ok' ? 'En control' : status === 'watch' ? 'Vigilar' : 'Atencion',
    score,
    title: 'Piloto automatico',
    message: automationMessage(status, freeMoney, cierre),
    cycle: {
      start: cycle.startKey,
      end: cycle.endKey,
      closeDate: cycle.closeDate,
      range: cycle.rangeLabel,
    },
    daily: {
      safe: round(freeMoney?.daily?.safe || 0),
      normal: round(freeMoney?.daily?.normal || 0),
      flexible: round(freeMoney?.daily?.flexible || 0),
      availableToSpend: round(freeMoney?.availableToSpend || 0),
      daysLeft: Number(freeMoney?.daysLeft || 0),
    },
    sync,
    rules: ruleStats,
    budgets: {
      watched: budgetWatch,
      risky: budgetWatch.filter((item) => item.status !== 'ok').length,
    },
    actions,
    updatedAt: new Date().toISOString(),
  };
}

async function syncStatus(env, chatId, now) {
  const rows = await env.DB.prepare(`
    SELECT source, status, details, created_at
    FROM sync_runs
    ORDER BY created_at DESC
    LIMIT 10
  `).all();
  const latest = (rows.results || []).find((row) => {
    const details = safeJson(row.details);
    return !details.chatId || String(details.chatId) === String(chatId);
  });

  if (!latest) {
    return {
      status: 'missing',
      statusLabel: 'Sin sync',
      lastAt: '',
      ageHours: null,
      message: 'Todavia no hay una sincronizacion registrada.',
    };
  }

  const today = localDateKey(now || new Date());
  const lastDate = String(latest.created_at || '').slice(0, 10);
  const ageDays = lastDate ? Math.max(0, daysBetween(lastDate, today)) : 999;
  const ageHours = round(ageDays * 24);
  const status = latest.status !== 'ok'
    ? 'error'
    : ageHours > 24
      ? 'stale'
      : 'ok';

  return {
    status,
    statusLabel: status === 'ok' ? 'Al dia' : status === 'stale' ? 'Atrasado' : 'Revisar',
    lastAt: latest.created_at || '',
    ageHours,
    source: latest.source || 'gas',
    details: safeJson(latest.details),
    message: status === 'ok'
      ? 'Sheets y D1 tienen sync reciente.'
      : status === 'stale'
        ? 'Conviene sincronizar para evitar diferencias con Sheets.'
        : 'La ultima sync no quedo OK.',
  };
}

function rulesStatus({ expenseRows, categoryRules, budgetRules, usdRate }) {
  const rows = expenseRows || [];
  const categoryRuleCount = (categoryRules || []).length;
  const budgetRuleCount = Object.values(budgetRules || {}).reduce((total, list) => total + (list || []).length, 0);
  let covered = 0;
  let weak = 0;

  for (const row of rows) {
    const classified = classifyCategoryFromLoadedRules(categoryRules, row.cat, row.desc);
    const matched = matchCategoryRule(categoryRules, row.cat, row.desc);
    if (matched || classified !== 'otro') covered++;
    if (classified === 'otro') weak++;
  }

  const coveragePct = rows.length ? Math.round((covered / rows.length) * 100) : 100;
  const suggestions = ruleSuggestions(rows, categoryRules, usdRate);

  return {
    categoryRules: categoryRuleCount,
    budgetRules: budgetRuleCount,
    coveragePct,
    weakTransactions: weak,
    suggestions,
    message: suggestions.length
      ? `${suggestions.length} regla${suggestions.length === 1 ? '' : 's'} candidata${suggestions.length === 1 ? '' : 's'} para revisar.`
      : 'Las reglas cubren bien el ciclo actual.',
  };
}

function ruleSuggestions(rows, categoryRules, usdRate) {
  const grouped = {};
  for (const row of rows || []) {
    const source = normalizeKey(row.source || '');
    if (source === 'debt_payment') continue;

    const desc = String(row.desc || '').trim();
    const key = keywordFromDescription(desc);
    if (!key || key.length < 3) continue;
    if (isGenericRuleKeyword(key)) continue;
    if (matchCategoryRule(categoryRules, key, desc)) continue;

    const category = classifyCategoryFromLoadedRules(categoryRules, row.cat, desc);
    if (category === 'deudas') continue;
    if (category === 'otro' && key === 'otro') continue;
    if (normalizeKey(category) === key) continue;

    if (!grouped[key]) {
      grouped[key] = {
        keyword: key,
        category,
        count: 0,
        amount: 0,
        example: title(desc).slice(0, 90),
      };
    }
    grouped[key].count += 1;
    grouped[key].amount += currencyToPen(Number(row.amount || 0), row.currency || 'PEN', usdRate);
  }

  return Object.values(grouped)
    .filter((item) => item.count >= 2 || item.amount >= 80 || item.category === 'otro')
    .map((item) => ({
      keyword: item.keyword,
      category: item.category,
      label: title(item.keyword),
      count: item.count,
      amount: round(item.amount),
      example: item.example,
      reason: item.category === 'otro'
        ? 'Categoria debil: conviene decidir una regla.'
        : `${item.count} movimiento${item.count === 1 ? '' : 's'} por ${formatCurrency(item.amount, 'PEN')}.`,
    }))
    .sort((a, b) => b.amount - a.amount || b.count - a.count || a.keyword.localeCompare(b.keyword))
    .slice(0, 4);
}

function isGenericRuleKeyword(value) {
  return new Set([
    'otro',
    'otros',
    'salud',
    'transporte',
    'supermercado',
    'entretenimiento',
    'servicios',
    'servicio',
    'ropa',
    'educacion',
    'salario',
    'freelance',
    'deudas',
    'deuda',
    'inversion',
    'venta',
  ]).has(normalizeKey(value));
}

function keywordFromDescription(value) {
  const stopWords = new Set([
    'compra',
    'pago',
    'consumo',
    'boleta',
    'factura',
    'ticket',
    'con',
    'de',
    'del',
    'en',
    'la',
    'el',
    'los',
    'las',
    'por',
    'para',
    's',
    'soles',
  ]);
  const words = normalizeRuleKeyword(value)
    .split(/\s+/)
    .filter((word) => word.length > 2 && !stopWords.has(word));

  return words.slice(0, 4).join(' ');
}

function budgetWatchList(budgets) {
  return (budgets || [])
    .map((item) => {
      const limit = Number(item.limite || 0);
      const spent = Number(item.gasto || 0);
      const pct = limit > 0 ? Math.round((spent / limit) * 100) : 0;
      return {
        category: item.cat,
        limit: round(limit),
        spent: round(spent),
        remaining: round(Math.max(limit - spent, 0)),
        pct,
        status: pct >= 100 ? 'over' : pct >= 85 ? 'risk' : pct >= 70 ? 'watch' : 'ok',
      };
    })
    .filter((item) => item.status !== 'ok')
    .sort((a, b) => b.pct - a.pct || b.spent - a.spent)
    .slice(0, 4);
}

function automationActions({ sync, ruleStats, budgetWatch, alerts, freeMoney, cierre, cierreAutomatico, topFugas, fixedSummary, deudaPendiente }) {
  const actions = [];

  if (sync.status !== 'ok') {
    actions.push({
      id: 'sync-now',
      type: 'sync',
      priority: sync.status === 'error' || sync.status === 'missing' ? 'high' : 'medium',
      title: 'Sincronizar Sheets con D1',
      message: sync.message,
      cta: 'Sync manual',
      runnable: true,
    });
  }

  if (cierreAutomatico?.active && !cierreAutomatico?.saved) {
    actions.push({
      id: 'close-cycle',
      type: 'closure',
      priority: 'high',
      title: cierreAutomatico.title,
      message: cierreAutomatico.message,
      cta: 'Cerrar mes',
      runnable: false,
    });
  }

  const daily = Number(freeMoney?.daily?.normal || 0);
  if (daily > 0) {
    actions.push({
      id: 'daily-guardrail',
      type: 'spending',
      priority: daily < 25 ? 'high' : 'medium',
      title: 'Limite diario recomendado',
      message: `Hoy mantente cerca de ${formatCurrency(daily, 'PEN')} para llegar al cierre.`,
      cta: 'Vigilar gasto',
      runnable: false,
    });
  } else {
    actions.push({
      id: 'freeze-variable',
      type: 'spending',
      priority: 'high',
      title: 'Pausar gasto variable',
      message: 'El plan no muestra margen diario positivo con la caja actual.',
      cta: 'Modo seguro',
      runnable: false,
    });
  }

  for (const item of budgetWatch.slice(0, 2)) {
    actions.push({
      id: `budget-${normalizeKey(item.category)}`,
      type: 'budget',
      priority: item.status === 'over' ? 'high' : 'medium',
      title: `${item.category}: ${item.pct}% del presupuesto`,
      message: item.status === 'over'
        ? `Ya excedio por ${formatCurrency(Math.max(item.spent - item.limit, 0), 'PEN')}.`
        : `Quedan ${formatCurrency(item.remaining, 'PEN')}.`,
      cta: 'Controlar',
      runnable: false,
    });
  }

  if (ruleStats.suggestions.length) {
    const first = ruleStats.suggestions[0];
    actions.push({
      id: 'review-rules',
      type: 'rules',
      priority: first.category === 'otro' ? 'high' : 'medium',
      title: 'Revisar reglas automaticas',
      message: `Candidata: "${first.keyword}" hacia ${title(first.category)}.`,
      cta: 'Crear regla',
      runnable: false,
    });
  }

  if (fixedSummary?.pending > 0 || deudaPendiente > 0) {
    actions.push({
      id: 'commitments',
      type: 'commitments',
      priority: 'medium',
      title: 'Compromisos pendientes',
      message: `Fijos pendientes ${formatCurrency(fixedSummary?.pending || 0, 'PEN')} y deudas ${formatCurrency(deudaPendiente || 0, 'PEN')}.`,
      cta: 'Revisar',
      runnable: false,
    });
  }

  if (!actions.length && (alerts || []).length) {
    const alert = alerts[0];
    actions.push({
      id: 'first-alert',
      type: 'alert',
      priority: alert.level === 'danger' ? 'high' : 'medium',
      title: alert.title,
      message: alert.message,
      cta: 'Ver alerta',
      runnable: false,
    });
  }

  if (topFugas?.length && actions.length < 4) {
    const leak = topFugas[0];
    actions.push({
      id: 'top-leak',
      type: 'leak',
      priority: 'medium',
      title: `Mayor fuga: ${leak.label}`,
      message: `${formatCurrency(leak.amount, 'PEN')} en ${leak.category}.`,
      cta: 'Reducir',
      runnable: false,
    });
  }

  return actions
    .sort((a, b) => priorityRank(b.priority) - priorityRank(a.priority))
    .slice(0, 5);
}

function automationScore({ sync, ruleStats, budgetWatch, freeMoney, cierre, alerts }) {
  let score = 100;
  if (sync.status === 'missing') score -= 18;
  if (sync.status === 'stale') score -= 12;
  if (sync.status === 'error') score -= 22;
  score -= Math.min(25, Math.max(0, 100 - Number(ruleStats.coveragePct || 0)) / 2);
  score -= Math.min(22, budgetWatch.reduce((total, item) => total + (item.status === 'over' ? 10 : 5), 0));
  if (Number(freeMoney?.daily?.normal || 0) <= 0) score -= 18;
  if (Number(cierre?.queQueda || 0) < 0) score -= 12;
  score -= Math.min(12, (alerts || []).filter((item) => item.level === 'danger' || item.level === 'warning').length * 4);
  return Math.max(0, Math.min(100, Math.round(score)));
}

function automationMessage(status, freeMoney, cierre) {
  if (status === 'ok') {
    return `Caja bajo control. Puedes gastar aprox. ${formatCurrency(freeMoney?.daily?.normal || 0, 'PEN')} por dia.`;
  }
  if (status === 'watch') {
    return `Hay margen, pero conviene vigilar el cierre: queda ${formatCurrency(cierre?.queQueda || 0, 'PEN')}.`;
  }
  return 'Hay acciones pendientes antes de seguir gastando con tranquilidad.';
}

function priorityRank(value) {
  if (value === 'high') return 3;
  if (value === 'medium') return 2;
  return 1;
}

function safeJson(value) {
  try {
    return JSON.parse(String(value || ''));
  } catch (_error) {
    return {};
  }
}
