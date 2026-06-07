import { COLORS } from '../shared/constants.js';
import { json, corsResponse, httpError, safeJson, safeJsonParse } from '../shared/http.js';
import { getChatId, payloadChatId } from '../shared/request.js';
import { round, parseAmount, currencyToPen, formatCurrency } from '../shared/money.js';
import { clamp, normalizeCurrency, normalizeDateOnly, normalizeMonthKey, normalizePaymentMethod, normalizeKey, title } from '../shared/normalizers.js';
import { cleanBase64, base64ToBytes, imageExtension, normalizeImageContentType, safeFileName, safeHeaderFileName, safeObjectSegment, stableTransactionId } from '../shared/files.js';
import { dateFromKey, dateKeyFromParts, daysBetween, formatMonth, localDateKey, localIso, monthLongName, monthLongNameFromKey, monthRangeFromKey, monthShortNameFromKey, parseDateKeyParts, payCycleFromDate, payCycleRelative } from '../shared/dates.js';
import { budgetRulesForDashboard, budgetSpendWithRules, classifyCategory, classifyCategoryFromLoadedRules, loadBudgetRules, loadCategoryRules, normalizeBaseCategory, normalizeCategory, normalizeRuleKeyword, safeRuleId } from '../shared/categories.js';
import { getAppSetting, readJsonCache, setAppSetting, setJsonCache, timeoutSignal } from '../shared/settings-store.js';
import { changePassword, login, requireAdminKey, requireDashboardAccess, requireDashboardOrAdminAccess } from '../auth/service.js';
import { categoryDefinitions, dashboardSettings, disableCategoryDefinition, ensureUserForChat, getUserSettings, linkTelegramUser, normalizeSettingsConfig, profile, updateDashboardSettings, upsertCategoryDefinition, userSettingsToConfig, usersList } from '../modules/settings/service.js';
import { budgetSummary, closureRuleSuggestion, fixedExpensesSummary, freeMoneyPlan, monthlyCalendar, netWorthInsights, realExpenses, smartAlerts, smartInsights, weeklyGoalPlan } from '../modules/dashboard/planning.js';
import { automationCenter } from '../modules/dashboard/automation.js';
import { advisorResponse } from '../modules/ai/advisor.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const receiptFileMatch = url.pathname.match(/^\/api\/receipts\/([^/]+)\/file$/);
    const transactionMatch = url.pathname.match(/^\/api\/transactions\/([^/]+)$/);
    const fixedExpenseMatch = url.pathname.match(/^\/api\/fixed-expenses\/([^/]+)$/);
    const fixedExpenseStatusMatch = url.pathname.match(/^\/api\/fixed-expenses\/([^/]+)\/status$/);
    const debtMatch = url.pathname.match(/^\/api\/debts\/([^/]+)$/);
    const debtPaymentMatch = url.pathname.match(/^\/api\/debts\/([^/]+)\/payments$/);
    const investmentMatch = url.pathname.match(/^\/api\/investments\/([^/]+)$/);

    if (request.method === 'OPTIONS') {
      return corsResponse(null, 204);
    }

    try {
      if (url.pathname === '/' || url.pathname === '/health') {
        return json(await health(env));
      }

      if (url.pathname === '/api/login' && request.method === 'POST') {
        const payload = await request.json();
        return json(await login(env, payload));
      }

      if (url.pathname === '/api/session' && request.method === 'GET') {
        await requireDashboardAccess(request, env);
        return json({ ok: true, authenticated: true });
      }

      if (url.pathname === '/api/logout' && request.method === 'POST') {
        return json({ ok: true });
      }

      if (url.pathname === '/api/password' && request.method === 'POST') {
        await requireDashboardAccess(request, env);
        const payload = await request.json();
        return json(await changePassword(env, payload));
      }

      if (url.pathname === '/api/settings' && request.method === 'GET') {
        await requireDashboardAccess(request, env);
        return json(await dashboardSettings(env, url.searchParams));
      }

      if (url.pathname === '/api/settings' && request.method === 'POST') {
        await requireDashboardAccess(request, env);
        const payload = await request.json();
        return json(await updateDashboardSettings(env, payload, url.searchParams));
      }

      if (url.pathname === '/api/profile' && request.method === 'GET') {
        await requireDashboardAccess(request, env);
        return json(await profile(env, url.searchParams));
      }

      if (url.pathname === '/api/categories' && request.method === 'GET') {
        await requireDashboardAccess(request, env);
        return json(await categoryDefinitions(env, url.searchParams));
      }

      if (url.pathname === '/api/categories' && request.method === 'POST') {
        await requireDashboardAccess(request, env);
        const payload = await request.json();
        return json(await upsertCategoryDefinition(env, payload, url.searchParams), 201);
      }

      if (url.pathname === '/api/categories/delete' && request.method === 'POST') {
        await requireDashboardAccess(request, env);
        const payload = await request.json();
        return json(await disableCategoryDefinition(env, payload, url.searchParams));
      }

      if (url.pathname === '/api/system-health' && request.method === 'GET') {
        await requireDashboardAccess(request, env);
        return json(await systemHealth(env));
      }

      if (url.pathname === '/api/apps-script/setup-triggers' && request.method === 'POST') {
        await requireDashboardAccess(request, env);
        return json(await gasConfigRequest(env, 'setup_triggers'));
      }

      if (url.pathname === '/api/apps-script/send-daily-email' && request.method === 'POST') {
        await requireDashboardAccess(request, env);
        return json(await gasConfigRequest(env, 'send_daily_email'));
      }

      if (url.pathname === '/api/apps-script/send-monthly-email' && request.method === 'POST') {
        await requireDashboardAccess(request, env);
        return json(await gasConfigRequest(env, 'send_monthly_email', url.searchParams));
      }

      if (url.pathname === '/api/apps-script/send-yearly-email' && request.method === 'POST') {
        await requireDashboardAccess(request, env);
        return json(await gasConfigRequest(env, 'send_yearly_email', url.searchParams));
      }

      if (url.pathname === '/api/apps-script/send-daily-telegram' && request.method === 'POST') {
        await requireDashboardAccess(request, env);
        return json(await gasConfigRequest(env, 'send_daily_telegram', url.searchParams));
      }

      if (url.pathname === '/api/exchange-rate' && request.method === 'GET') {
        await requireDashboardAccess(request, env);
        return json(await exchangeRate(env));
      }

      if (url.pathname === '/api/calendar' && request.method === 'GET') {
        await requireDashboardAccess(request, env);
        return json(await calendarOnly(env, url.searchParams));
      }

      if (url.pathname === '/api/bootstrap' && request.method === 'GET') {
        await requireDashboardAccess(request, env);
        return json(await bootstrap(env, url.searchParams));
      }

      if (url.pathname === '/api/dashboard' && request.method === 'GET') {
        await requireDashboardOrAdminAccess(request, env);
        return json(await dashboard(env, url.searchParams));
      }

      if (url.pathname === '/api/ai/advisor' && request.method === 'POST') {
        await requireDashboardAccess(request, env);
        const payload = await safeJson(request);
        return json(await aiAdvisor(env, url.searchParams, payload));
      }

      if (url.pathname === '/api/net-worth' && request.method === 'GET') {
        await requireDashboardAccess(request, env);
        return json(await netWorth(env, url.searchParams));
      }

      if (url.pathname === '/api/net-worth/snapshot' && request.method === 'POST') {
        await requireDashboardAccess(request, env);
        return json(await saveNetWorthSnapshot(env, url.searchParams), 201);
      }

      if (url.pathname === '/api/closures' && request.method === 'GET') {
        await requireDashboardAccess(request, env);
        return json(await financialClosures(env, url.searchParams));
      }

      if (url.pathname === '/api/closures' && request.method === 'POST') {
        await requireDashboardAccess(request, env);
        const payload = await safeJson(request);
        return json(await saveFinancialClosure(env, url.searchParams, payload), payload?.dryRun ? 200 : 201);
      }

      if (url.pathname === '/api/rules' && request.method === 'GET') {
        await requireDashboardOrAdminAccess(request, env);
        return json(await rulesList(env, url.searchParams));
      }

      if (url.pathname === '/api/rules/classify' && request.method === 'POST') {
        requireAdminKey(request, env);
        const payload = await request.json();
        return json(await classifyRulePayload(env, payload));
      }

      if (url.pathname === '/api/rules/budget/keys' && request.method === 'POST') {
        requireAdminKey(request, env);
        const payload = await request.json();
        return json(await budgetKeysPayload(env, payload));
      }

      if (url.pathname === '/api/rules/category' && request.method === 'POST') {
        await requireDashboardOrAdminAccess(request, env);
        const payload = await request.json();
        return json(await upsertCategoryRule(env, payload), 201);
      }

      if (url.pathname === '/api/rules/category/delete' && request.method === 'POST') {
        await requireDashboardOrAdminAccess(request, env);
        const payload = await request.json();
        return json(await deleteCategoryRule(env, payload));
      }

      if (url.pathname === '/api/rules/budget' && request.method === 'POST') {
        await requireDashboardOrAdminAccess(request, env);
        const payload = await request.json();
        return json(await upsertBudgetCategoryRule(env, payload), 201);
      }

      if (url.pathname === '/api/rules/budget/delete' && request.method === 'POST') {
        await requireDashboardOrAdminAccess(request, env);
        const payload = await request.json();
        return json(await deleteBudgetCategoryRule(env, payload));
      }

      if (url.pathname === '/api/sync' && request.method === 'POST') {
        await requireDashboardAccess(request, env);
        return json(await syncFromGas(env, url.searchParams));
      }

      if (url.pathname === '/api/transactions' && request.method === 'GET') {
        await requireDashboardOrAdminAccess(request, env);
        return json(await transactions(env, url.searchParams));
      }

      if (url.pathname === '/api/users' && request.method === 'GET') {
        await requireDashboardAccess(request, env);
        return json(await usersList(env));
      }

      if (url.pathname === '/api/users/link' && request.method === 'POST') {
        requireAdminKey(request, env);
        const payload = await request.json();
        return json(await linkTelegramUser(env, payload), 201);
      }

      if (url.pathname === '/api/transactions' && request.method === 'POST') {
        requireAdminKey(request, env);
        const payload = await request.json();
        return json(await insertTransaction(env, payload), 201);
      }

      if (url.pathname === '/api/budgets' && request.method === 'POST') {
        await requireDashboardOrAdminAccess(request, env);
        const payload = await request.json();
        return json(await upsertBudgetFromPayload(env, payload, url.searchParams), 201);
      }

      if (transactionMatch && request.method === 'DELETE') {
        await requireDashboardAccess(request, env);
        return json(await deleteTransaction(env, {
          id: decodeURIComponent(transactionMatch[1]),
          chatId: getChatId(env, url.searchParams),
          deleteFromGas: true,
        }));
      }

      if (transactionMatch && request.method === 'PATCH') {
        await requireDashboardAccess(request, env);
        const payload = await request.json();
        return json(await updateTransactionFromDashboard(env, decodeURIComponent(transactionMatch[1]), payload, url.searchParams));
      }

      if (url.pathname === '/api/transactions/delete' && request.method === 'POST') {
        requireAdminKey(request, env);
        const payload = await request.json();
        return json(await deleteTransaction(env, {
          id: String(payload.id || payload.transaction_id || payload.transactionId || '').trim(),
          chatId: String(payload.chat_id || payload.chatId || env.DEFAULT_CHAT_ID || '').trim(),
          deleteFromGas: false,
        }));
      }

      if (url.pathname === '/api/transactions/category' && request.method === 'POST') {
        requireAdminKey(request, env);
        const payload = await request.json();
        return json(await updateTransactionCategory(env, payload));
      }

      if (url.pathname === '/api/transactions/payment' && request.method === 'POST') {
        requireAdminKey(request, env);
        const payload = await request.json();
        return json(await updateTransactionPayment(env, payload));
      }

      if (url.pathname === '/api/fixed-expenses' && request.method === 'POST') {
        await requireDashboardOrAdminAccess(request, env);
        const payload = await request.json();
        return json(await upsertFixedExpenseFromPayload(env, payload, url.searchParams), 201);
      }

      if (fixedExpenseMatch && request.method === 'PATCH') {
        await requireDashboardAccess(request, env);
        const payload = await request.json();
        return json(await updateFixedExpenseFromDashboard(env, decodeURIComponent(fixedExpenseMatch[1]), payload, url.searchParams));
      }

      if (fixedExpenseMatch && request.method === 'DELETE') {
        await requireDashboardOrAdminAccess(request, env);
        return json(await deleteFixedExpense(env, decodeURIComponent(fixedExpenseMatch[1]), url.searchParams));
      }

      if (fixedExpenseStatusMatch && request.method === 'POST') {
        await requireDashboardOrAdminAccess(request, env);
        const payload = await request.json();
        return json(await setFixedExpenseMonthStatus(env, decodeURIComponent(fixedExpenseStatusMatch[1]), payload, url.searchParams));
      }

      if (url.pathname === '/api/debts' && request.method === 'POST') {
        await requireDashboardOrAdminAccess(request, env);
        const payload = await request.json();
        return json(await upsertDebtFromPayload(env, payload), 201);
      }

      if (debtMatch && request.method === 'PATCH') {
        await requireDashboardAccess(request, env);
        const payload = await request.json();
        return json(await updateDebtFromDashboard(env, decodeURIComponent(debtMatch[1]), payload, url.searchParams));
      }

      if (debtMatch && request.method === 'DELETE') {
        await requireDashboardAccess(request, env);
        return json(await deleteDebt(env, decodeURIComponent(debtMatch[1]), url.searchParams));
      }

      if (debtPaymentMatch && request.method === 'POST') {
        await requireDashboardOrAdminAccess(request, env);
        const payload = await request.json();
        return json(await addDebtPayment(env, decodeURIComponent(debtPaymentMatch[1]), payload, url.searchParams), 201);
      }

      if (url.pathname === '/api/investments' && request.method === 'GET') {
        await requireDashboardAccess(request, env);
        return json(await investmentsList(env, url.searchParams));
      }

      if (url.pathname === '/api/investments' && request.method === 'POST') {
        await requireDashboardAccess(request, env);
        const payload = await request.json();
        return json(await upsertInvestmentFromDashboard(env, payload, url.searchParams), 201);
      }

      if (investmentMatch && request.method === 'PATCH') {
        await requireDashboardAccess(request, env);
        const payload = await request.json();
        return json(await updateInvestmentFromDashboard(env, decodeURIComponent(investmentMatch[1]), payload, url.searchParams));
      }

      if (investmentMatch && request.method === 'DELETE') {
        await requireDashboardAccess(request, env);
        return json(await deleteInvestment(env, decodeURIComponent(investmentMatch[1]), url.searchParams));
      }

      if (url.pathname === '/api/receipts' && request.method === 'POST') {
        requireAdminKey(request, env);
        const payload = await request.json();
        return json(await uploadReceipt(env, payload), 201);
      }

      if (receiptFileMatch && request.method === 'GET') {
        await requireDashboardAccess(request, env);
        return receiptFile(env, decodeURIComponent(receiptFileMatch[1]));
      }

      if (url.pathname === '/api/sync/gas' && request.method === 'POST') {
        requireAdminKey(request, env);
        return json(await syncFromGas(env, url.searchParams));
      }

      return json({ ok: false, error: 'Not found' }, 404);
    } catch (error) {
      const status = error.status || 500;
      return json({ ok: false, error: error.message || String(error) }, status);
    }
  },

  async scheduled(_event, env, ctx) {
    if (String(env.ENABLE_AUTO_GAS_SYNC || '').toLowerCase() !== 'true') {
      return;
    }
    const params = new URLSearchParams({ limit: '500' });
    ctx.waitUntil(syncFromGas(env, params));
  },
};

async function health(env) {
  const row = await env.DB.prepare('SELECT COUNT(*) AS total FROM transactions').first();
  const fixed = await env.DB.prepare('SELECT COUNT(*) AS total FROM fixed_expenses WHERE active = 1').first();
  const receipts = await env.DB.prepare('SELECT COUNT(*) AS total FROM receipts').first();
  const debts = await env.DB.prepare("SELECT COUNT(*) AS total FROM debts WHERE status = 'activa'").first();

  return {
    ok: true,
    database: 'finanzas_mayeson',
    environment: workerEnvironment(env),
    transactions: row?.total || 0,
    fixedExpenses: fixed?.total || 0,
    receipts: receipts?.total || 0,
    debts: debts?.total || 0,
    checkedAt: new Date().toISOString(),
  };
}

function workerEnvironment(env) {
  return String(env.ENVIRONMENT || '').trim().toLowerCase() || 'production';
}

function isQaEnv(env) {
  return workerEnvironment(env) === 'qa';
}

function gasActionHasSideEffects(action) {
  const clean = String(action || '').trim().toLowerCase();
  return !['health', 'dashboard', 'txs'].includes(clean);
}

async function systemHealth(env) {
  const checks = [];
  const started = Date.now();
  const dbInfo = await health(env);

  checks.push({
    id: 'worker',
    label: 'Cloudflare Worker',
    status: 'ok',
    message: 'Worker activo y respondiendo.',
  });

  checks.push({
    id: 'd1',
    label: 'D1',
    status: 'ok',
    message: `${dbInfo.transactions} movimientos, ${dbInfo.receipts} recibos, ${dbInfo.debts} deudas.`,
  });

  checks.push({
    id: 'r2',
    label: 'R2 recibos',
    status: env.RECEIPTS_BUCKET ? 'ok' : 'error',
    message: env.RECEIPTS_BUCKET ? 'Binding RECEIPTS_BUCKET disponible.' : 'Falta binding RECEIPTS_BUCKET.',
  });

  [
    ['dashboardApiKey', 'DASHBOARD_API_KEY', env.DASHBOARD_API_KEY, 'error'],
    ['gasApiUrl', 'GAS_API_URL', env.GAS_API_URL],
    ['gasApiKey', 'GAS_API_KEY', env.GAS_API_KEY],
    ['adminKey', 'ADMIN_KEY', env.ADMIN_KEY],
    ['defaultChatId', 'DEFAULT_CHAT_ID', env.DEFAULT_CHAT_ID],
    ['sessionSecret', 'SESSION_SECRET', env.SESSION_SECRET],
  ].forEach(([id, label, value, missingStatus = 'error']) => {
    checks.push({
      id,
      label,
      status: value ? 'ok' : missingStatus,
      message: value ? 'Configurado.' : missingStatus === 'warning' ? 'Opcional si el dashboard no usa login.' : 'Falta configurar este secreto en Worker.',
    });
  });

  let gasHealth = null;
  if (env.GAS_API_URL && env.GAS_API_KEY) {
    try {
      gasHealth = await gasConfigRequest(env, 'health');
      checks.push({
        id: 'appsScript',
        label: 'Apps Script',
        status: 'ok',
        message: gasHealth.spreadsheetName ? `Conectado a ${gasHealth.spreadsheetName}.` : 'Apps Script responde.',
      });

      Object.entries(gasHealth.sheets || {}).forEach(([name, exists]) => {
        checks.push({
          id: `sheet:${name}`,
          label: `Sheet ${name}`,
          status: exists ? 'ok' : 'warning',
          message: exists ? 'Pestana encontrada.' : 'No existe todavia o no fue inicializada.',
        });
      });

      Object.entries(gasHealth.services || {}).forEach(([name, exists]) => {
        checks.push({
          id: `gas:${name}`,
          label: serviceLabel(name),
          status: exists ? 'ok' : 'warning',
          message: exists ? 'Configurado en Apps Script.' : 'Falta en Script Properties.',
        });
      });
    } catch (error) {
      checks.push({
        id: 'appsScript',
        label: 'Apps Script',
        status: 'error',
        message: error.message || 'No se pudo consultar Apps Script.',
      });
    }
  } else {
    checks.push({
      id: 'appsScript',
      label: 'Apps Script',
      status: 'error',
      message: 'Faltan GAS_API_URL o GAS_API_KEY en Worker.',
    });
  }

  const errors = checks.filter((item) => item.status === 'error').length;
  const warnings = checks.filter((item) => item.status === 'warning').length;

  return {
    ok: errors === 0,
    status: errors ? 'error' : warnings ? 'warning' : 'ok',
    summary: {
      total: checks.length,
      ok: checks.filter((item) => item.status === 'ok').length,
      warnings,
      errors,
      latencyMs: Date.now() - started,
    },
    checks,
    gasHealth,
    checkedAt: new Date().toISOString(),
  };
}

async function gasConfigRequest(env, action, extraParams = new URLSearchParams()) {
  if (isQaEnv(env) && gasActionHasSideEffects(action)) {
    return {
      ok: true,
      skipped: true,
      environment: 'qa',
      action,
      message: 'Accion externa bloqueada en QA para no afectar Apps Script, correos, Telegram ni Sheets de produccion.',
    };
  }

  if (!env.GAS_API_URL || !env.GAS_API_KEY) {
    throw httpError(400, 'Faltan secrets GAS_API_URL o GAS_API_KEY');
  }

  const url = new URL(env.GAS_API_URL);
  url.searchParams.set('action', action);
  url.searchParams.set('key', env.GAS_API_KEY);
  for (const [key, value] of extraParams.entries()) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url.toString());
  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.ok === false) {
    throw httpError(502, data.error || 'No se pudo leer configuracion desde Apps Script');
  }

  return data;
}

function serviceLabel(name) {
  const labels = {
    telegramToken: 'Telegram token',
    workerUrl: 'Worker URL',
    claudeApiKey: 'IA API key',
    d1ApiUrl: 'D1 API URL',
    d1AdminKey: 'D1 admin key',
  };
  return labels[name] || name;
}

async function calendarOnly(env, params) {
  const chatId = getChatId(env, params);
  const now = new Date();
  const requestedMonth = normalizeMonthKey(params.get('calendar_month') || params.get('calendarMonth') || '');
  const usdRate = Number((await exchangeRate(env)).rate || 3.85);
  const cycle = payCycleFromDate(now);
  const debts = await debtsList(env, chatId);
  const calendario = await monthlyCalendar(env, chatId, now, cycle, [], debts, [], null, usdRate, requestedMonth, { fixedExpensesList });

  return {
    ok: true,
    calendario,
    source: 'd1-calendar',
    updatedAt: localIso(now),
  };
}

async function bootstrap(env, params) {
  const started = Date.now();
  const [dashboardData, usersData] = await Promise.all([
    dashboard(env, params),
    usersList(env),
  ]);

  return {
    ok: true,
    dashboard: dashboardData,
    users: usersData.users || [],
    defaultChatId: usersData.defaultChatId || '',
    exchangeRate: dashboardData.exchangeRate || 3.85,
    exchangeRateSource: dashboardData.exchangeRateSource || '',
    source: 'd1-bootstrap',
    latencyMs: Date.now() - started,
    updatedAt: localIso(new Date()),
  };
}

async function aiAdvisor(env, params, payload) {
  const dashboardData = await dashboard(env, params);
  const chatId = getChatId(env, params);
  const user = await ensureUserForChat(env, chatId);
  const settings = normalizeSettingsConfig(userSettingsToConfig(await getUserSettings(env, user.id)));

  return advisorResponse(env, dashboardData, settings, payload);
}

async function dashboard(env, params) {
  const chatId = getChatId(env, params);
  const now = new Date();
  const requestedCycleStart = normalizeDateOnly(params.get('cycle_start') || params.get('cycleStart') || '');
  const requestedCalendarMonth = normalizeMonthKey(params.get('calendar_month') || params.get('calendarMonth') || '');
  const cycle = requestedCycleStart ? payCycleFromDate(dateFromKey(requestedCycleStart)) : payCycleFromDate(now);
  const monthKey = cycle.key;
  const calendarMonth = cycle;
  const cycleKey = monthKey;
  const monthName = monthLongNameFromKey(localDateKey(now));
  const rateInfo = await exchangeRate(env);
  const usdRate = Number(rateInfo.rate || 3.85);
  const user = await ensureUserForChat(env, chatId);
  const settings = normalizeSettingsConfig(userSettingsToConfig(await getUserSettings(env, user.id)));
  const cycleStartParts = parseDateKeyParts(calendarMonth.startKey);
  const cycleIncomeLeadDays = clamp(Number(settings.cycleIncomeLeadDays ?? 1), 0, 7);
  const cycleIncomeStartKey = dateKeyFromParts(
    cycleStartParts.year,
    cycleStartParts.monthIndex,
    cycleStartParts.day - cycleIncomeLeadDays,
  );

  const totalsPromise = env.DB.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN type = 'ingreso' THEN CASE WHEN currency = 'USD' THEN amount * ? ELSE amount END ELSE 0 END), 0) AS ingresos,
      COALESCE(SUM(CASE WHEN type = 'gasto' THEN CASE WHEN currency = 'USD' THEN amount * ? ELSE amount END ELSE 0 END), 0) AS gastos,
      COUNT(*) AS movimientos
    FROM transactions
    WHERE chat_id = ?
  `).bind(usdRate, usdRate, chatId).first();

  const monthTotalsPromise = env.DB.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN type = 'ingreso' THEN CASE WHEN currency = 'USD' THEN amount * ? ELSE amount END ELSE 0 END), 0) AS ingresosMes,
      COALESCE(SUM(CASE WHEN type = 'gasto' THEN CASE WHEN currency = 'USD' THEN amount * ? ELSE amount END ELSE 0 END), 0) AS gastosMes,
      COUNT(*) AS movimientosMes
    FROM transactions
    WHERE chat_id = ? AND tx_date BETWEEN ? AND ?
  `).bind(usdRate, usdRate, chatId, calendarMonth.startKey, calendarMonth.endKey).first();

  const cycleIncomeTotalsPromise = env.DB.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN currency = 'USD' THEN amount * ? ELSE amount END), 0) AS ingresosMes,
      COUNT(*) AS ingresosMovimientos,
      COALESCE(SUM(CASE WHEN tx_date < ? THEN 1 ELSE 0 END), 0) AS ingresosPreviosMovimientos
    FROM transactions
    WHERE chat_id = ? AND type = 'ingreso' AND tx_date BETWEEN ? AND ?
  `).bind(usdRate, calendarMonth.startKey, chatId, cycleIncomeStartKey, calendarMonth.endKey).first();

  const latestPromise = env.DB.prepare(`
    SELECT
      t.id,
      t.tx_date AS fecha,
      t.tx_time AS hora,
      t.type AS tipo,
      t.description AS desc,
      t.category AS cat,
      t.amount AS monto,
      t.currency,
      t.payment_method,
      t.payment_due_date,
      t.card_name,
      r.id AS receipt_id,
      r.file_name AS receipt_file_name,
      r.content_type AS receipt_content_type,
      r.size AS receipt_size,
      r.created_at AS receipt_uploaded_at
    FROM transactions t
    LEFT JOIN receipts r ON r.transaction_id = t.id
    WHERE t.chat_id = ?
    ORDER BY t.tx_date DESC, t.tx_time DESC, t.created_at DESC
    LIMIT 20
  `).bind(chatId).all();

  const [
    totals,
    monthTotals,
    cycleIncomeTotals,
    latest,
    cycleExpenses,
    categoryRules,
    budgetRules,
    budgetRows,
    months,
    fixedExpenses,
    debts,
    goals,
    emailConfig,
  ] = await Promise.all([
    totalsPromise,
    monthTotalsPromise,
    cycleIncomeTotalsPromise,
    latestPromise,
    cycleExpenseRows(env, chatId, calendarMonth),
    loadCategoryRules(env, chatId),
    loadBudgetRules(env, chatId),
    budgetsRows(env, chatId),
    lastMonths(env, chatId, now, usdRate),
    fixedExpensesList(env, chatId, monthKey, usdRate, calendarMonth),
    debtsList(env, chatId),
    goalsList(env, chatId),
    emailConfigFromGas(env),
  ]);
  const categories = categoriesFromExpenseRows(cycleExpenses, categoryRules, usdRate);
  const topFugas = topLeaksFromExpenseRows(cycleExpenses, categoryRules, usdRate);
  const budgets = budgetsFromExpenseRows(budgetRows, cycleExpenses, categoryRules, budgetRules, usdRate);
  const fixedSummary = fixedExpensesSummary(fixedExpenses, usdRate);
  const deudaPendiente = round(debts
    .filter((item) => item.estado !== 'pagada')
    .reduce((total, item) => total + currencyToPen(Number(item.pendiente || 0), item.currency || 'PEN', usdRate), 0));

  const ingresos = Number(totals?.ingresos || 0);
  const gastos = Number(totals?.gastos || 0);
  const ingresosMes = Number(cycleIncomeTotals?.ingresosMes || 0);
  const gastosMes = Number(monthTotals?.gastosMes || 0);
  const movimientosMes = Number(monthTotals?.movimientosMes || 0) + Number(cycleIncomeTotals?.ingresosPreviosMovimientos || 0);
  const ingresosCierre = ingresosMes;
  const gastosCierre = gastosMes;
  const gastosConFijosPagados = round(gastos + fixedSummary.paid);
  const gastosMesConFijosPagados = round(gastosMes + fixedSummary.paid);
  const balanceCaja = round(ingresos - gastosConFijosPagados);
  const balanceMesCaja = round(ingresosMes - gastosMesConFijosPagados);
  const patrimonioDisponible = round(balanceCaja - deudaPendiente - fixedSummary.pending);
  const budget = budgetSummary(budgets);
  const gastosCierreConFijos = round(gastosCierre + fixedSummary.paid);
  const balanceCierre = round(ingresosCierre - gastosCierreConFijos);
  const pendienteComprometido = round(deudaPendiente + fixedSummary.pending + budget.remaining);
  const cierre = {
    label: `Cierre ${calendarMonth.closeDate.slice(8, 10)}/${calendarMonth.closeDate.slice(5, 7)}`,
    range: calendarMonth.rangeLabel,
    start: calendarMonth.startKey,
    end: calendarMonth.endKey,
    incomeStart: cycleIncomeStartKey,
    incomeEnd: calendarMonth.endKey,
    incomeLeadDays: cycleIncomeLeadDays,
    closeDate: calendarMonth.closeDate,
    ingresos: round(ingresosCierre),
    gastos: gastosCierreConFijos,
    gastosMovimientos: round(gastosCierre),
    balance: balanceCierre,
    movimientos: movimientosMes,
    ingresosMovimientos: Number(cycleIncomeTotals?.ingresosMovimientos || 0),
    fijosPagados: fixedSummary.paid,
    fijosPendientes: fixedSummary.pending,
    deudasPendientes: deudaPendiente,
    presupuestoLimite: budget.limit,
    presupuestoUsado: budget.spent,
    presupuestoRestante: budget.remaining,
    presupuestoExcedido: budget.over,
    pendienteComprometido,
    queQueda: round(patrimonioDisponible - budget.remaining),
    patrimonioDisponible,
  };
  const dineroLibre = freeMoneyPlan({
    now,
    settings,
    cierre,
    budget,
    fixedSummary,
    deudaPendiente,
    goals,
    cashBalance: balanceCaja,
    patrimonioDisponible,
    ingresosMes,
    gastosMes: gastosMesConFijosPagados,
  });
  const savedClosure = await currentFinancialClosure(env, chatId, monthKey);
  if (savedClosure) {
    cierre.saved = true;
    cierre.savedAt = savedClosure.updated_at || '';
    cierre.snapshotId = savedClosure.id || '';
    cierre.status = savedClosure.status || 'closed';
    cierre.closed = (savedClosure.status || 'closed') === 'closed';
    cierre.closedAt = savedClosure.closed_at || savedClosure.updated_at || '';
    cierre.suggestedSavings = round(savedClosure.suggested_savings || 0);
    cierre.savingsAction = savedClosure.savings_action || 'suggested';
    cierre.nextCycle = closureNextCycleShape(savedClosure);
    cierre.nextBudget = safeJsonParse(savedClosure.next_budget_json, []);
  }
  const cierreAutomatico = await closureRuleSuggestion(env, chatId, now, calendarMonth, dineroLibre, { currentFinancialClosure });
  const objetivoSemanal = await weeklyGoalPlan(env, chatId, now, calendarMonth, dineroLibre, usdRate);

  const alerts = smartAlerts({
    now,
    monthKey,
    cycle,
    ingresosMes,
    gastosMes: gastosMesConFijosPagados,
    budgets,
    fixedExpenses,
    debts,
    latest: (latest.results || []).map(txShape),
  });
  if (cierreAutomatico.active && !cierreAutomatico.saved) {
    alerts.unshift({
      level: cierreAutomatico.status === 'due' ? 'warning' : 'info',
      title: cierreAutomatico.title,
      message: cierreAutomatico.message,
    });
  }
  const insights = smartInsights({
    ingresosMes,
    gastosMes: gastosMesConFijosPagados,
    balanceMes: balanceMesCaja,
    cashBalance: balanceCaja,
    freeMoney: dineroLibre,
    categories,
    budgets,
    debts,
    months,
  });
  const calendario = await monthlyCalendar(env, chatId, now, calendarMonth, fixedExpenses, debts, alerts, objetivoSemanal, usdRate, requestedCalendarMonth, { fixedExpensesList });
  const automatizacion = await automationCenter(env, {
    chatId,
    now,
    cycle: calendarMonth,
    expenseRows: cycleExpenses,
    categoryRules,
    budgetRules,
    budgets,
    alerts,
    freeMoney: dineroLibre,
    cierre,
    cierreAutomatico,
    topFugas,
    fixedSummary,
    deudaPendiente,
    usdRate,
  });

  return {
    ok: true,
    balance: balanceCaja,
    patrimonio: patrimonioDisponible,
    patrimonioDisponible,
    balanceGeneralNeto: patrimonioDisponible,
    balanceNeto: patrimonioDisponible,
    ingresos: round(ingresos),
    gastos: gastosConFijosPagados,
    ingresosMes: round(ingresosMes),
    gastosMes: gastosMesConFijosPagados,
    balanceMes: balanceMesCaja,
    movimientos: Number(totals?.movimientos || 0),
    mes: monthName,
    mesKey: monthKey,
    cycleKey,
    cycleLabel: cycle.label,
    cycleStart: calendarMonth.startKey,
    cycleEnd: calendarMonth.endKey,
    cycleIncomeStart: cycleIncomeStartKey,
    cycleIncomeEnd: calendarMonth.endKey,
    cycleIncomeLeadDays,
    cycleClose: calendarMonth.closeDate,
    cycleRange: calendarMonth.rangeLabel,
    movimientosMes,
    cierre,
    cierreAutomatico,
    dineroLibre,
    objetivoSemanal,
    calendario,
    topFugas,
    transacciones: (latest.results || []).map(txShape),
    categorias: categories,
    budgetRules: budgetRulesForDashboard(budgetRules),
    meses: months,
    presupuestos: budgets,
    fijos: fixedExpenses,
    deudas: debts,
    deudaPendiente,
    fijosPendientes: fixedSummary.pending,
    fijosPagadosMes: fixedSummary.paid,
    gastosReales: realExpenses(fixedExpenses, budgets, usdRate),
    metas: goals,
    alertas: alerts,
    insights: insights,
    automatizacion,
    emailConfig,
    exchangeRate: usdRate,
    exchangeRateSource: rateInfo.source || '',
    source: 'd1',
    updatedAt: localIso(now),
  };
}

async function transactions(env, params) {
  const chatId = getChatId(env, params);
  const limit = clamp(Number(params.get('limit') || 100), 1, 500);
  const search = normalizeKey(params.get('q') || params.get('search') || '');
  const category = normalizeBaseCategory(params.get('category') || '');
  const type = String(params.get('type') || '').toLowerCase();
  const payment = normalizePaymentMethod(params.get('payment') || params.get('payment_method') || '');
  const currency = String(params.get('currency') || '').trim().toUpperCase();
  const month = String(params.get('month') || '').trim();
  const where = ['t.chat_id = ?'];
  const values = [chatId];

  if (search) {
    where.push('(lower(t.description) LIKE ? OR lower(t.category) LIKE ?)');
    values.push(`%${search}%`, `%${search}%`);
  }
  if (category) {
    where.push('t.category = ?');
    values.push(category);
  }
  if (type === 'ingreso' || type === 'gasto') {
    where.push('t.type = ?');
    values.push(type);
  }
  if (payment) {
    where.push('t.payment_method = ?');
    values.push(payment);
  }
  if (currency === 'PEN' || currency === 'USD') {
    where.push('t.currency = ?');
    values.push(currency);
  }
  if (/^\d{4}-\d{2}$/.test(month)) {
    where.push('substr(t.tx_date, 1, 7) = ?');
    values.push(month);
  }

  const rows = await env.DB.prepare(`
    SELECT
      t.id,
      t.tx_date AS fecha,
      t.tx_time AS hora,
      t.type AS tipo,
      t.description AS desc,
      t.category AS cat,
      t.amount AS monto,
      t.currency,
      t.payment_method,
      t.payment_due_date,
      t.card_name,
      r.id AS receipt_id,
      r.file_name AS receipt_file_name,
      r.content_type AS receipt_content_type,
      r.size AS receipt_size,
      r.created_at AS receipt_uploaded_at
    FROM transactions t
    LEFT JOIN receipts r ON r.transaction_id = t.id
    WHERE ${where.join(' AND ')}
    ORDER BY t.tx_date DESC, t.tx_time DESC, t.created_at DESC
    LIMIT ?
  `).bind(...values, limit).all();

  return {
    ok: true,
    total: rows.results?.length || 0,
    limit,
    transacciones: (rows.results || []).map(txShape),
  };
}

async function financialClosures(env, params) {
  const chatId = getChatId(env, params);
  const rows = await env.DB.prepare(`
    SELECT *
    FROM financial_closures
    WHERE chat_id = ?
    ORDER BY closure_key DESC
    LIMIT 12
  `).bind(chatId).all();

  return {
    ok: true,
    closures: (rows.results || []).map(financialClosureShape),
  };
}

async function saveFinancialClosure(env, params, payload = {}) {
  const chatId = getChatId(env, params);
  const dashboardParams = new URLSearchParams(params);
  const requestedCycleStart = normalizeDateOnly(payload?.cycle_start || payload?.cycleStart || '');
  if (requestedCycleStart) dashboardParams.set('cycle_start', requestedCycleStart);
  const data = await dashboard(env, dashboardParams);
  const closure = data.cierre;
  if (!closure) throw httpError(500, 'No se pudo calcular el cierre');

  if (payload?.dryRun) {
    return {
      ok: true,
      dryRun: true,
      closure,
      topFugas: data.topFugas || [],
    };
  }

  const closureKey = data.mesKey || closure.closeDate?.slice(0, 7) || localDateKey(new Date()).slice(0, 7);
  const id = `closure:${chatId}:${closureKey}`.slice(0, 180);
  const currentCycle = payCycleFromDate(dateFromKey(closure.start || data.cycleStart || `${closureKey}-23`));
  const nextCycle = payCycleRelative(currentCycle, 1);
  const closedAt = localIso(new Date());
  const suggestedSavings = round(Math.max(0, Number(data.dineroLibre?.recommendedSavings ?? data.cierreAutomatico?.suggestedSavings ?? 0)));
  const savingsAction = suggestedSavings > 0 ? 'pending_confirmation' : 'not_available';
  const nextBudget = nextCycleBudgetSuggestion(data.presupuestos || []);
  const topFugasJson = JSON.stringify(data.topFugas || []);
  const nextBudgetJson = JSON.stringify(nextBudget);
  const detailsJson = JSON.stringify({
    cierre: closure,
    status: 'closed',
    closedAt,
    suggestedSavings,
    savingsAction,
    nextCycle: cycleShape(nextCycle),
    nextBudget,
    topFugas: data.topFugas || [],
    presupuestos: data.presupuestos || [],
    fijos: data.fijos || [],
    deudas: data.deudas || [],
    source: data.source || 'd1',
    updatedAt: data.updatedAt || '',
  });

  await env.DB.prepare(`
    INSERT INTO financial_closures (
      id, chat_id, closure_key, close_date, label, month_key, start_date, end_date,
      ingresos, gastos, balance, fijos_pagados, fijos_pendientes, deudas_pendientes,
      presupuesto_limite, presupuesto_usado, presupuesto_restante, presupuesto_excedido,
      pendiente_comprometido, que_queda, patrimonio_disponible, movimientos,
      top_fugas_json, details_json,
      status, closed_at, next_cycle_key, next_cycle_start, next_cycle_end, next_close_date,
      suggested_savings, savings_action, next_budget_json, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(chat_id, closure_key) DO UPDATE SET
      close_date = excluded.close_date,
      label = excluded.label,
      month_key = excluded.month_key,
      start_date = excluded.start_date,
      end_date = excluded.end_date,
      ingresos = excluded.ingresos,
      gastos = excluded.gastos,
      balance = excluded.balance,
      fijos_pagados = excluded.fijos_pagados,
      fijos_pendientes = excluded.fijos_pendientes,
      deudas_pendientes = excluded.deudas_pendientes,
      presupuesto_limite = excluded.presupuesto_limite,
      presupuesto_usado = excluded.presupuesto_usado,
      presupuesto_restante = excluded.presupuesto_restante,
      presupuesto_excedido = excluded.presupuesto_excedido,
      pendiente_comprometido = excluded.pendiente_comprometido,
      que_queda = excluded.que_queda,
      patrimonio_disponible = excluded.patrimonio_disponible,
      movimientos = excluded.movimientos,
      top_fugas_json = excluded.top_fugas_json,
      details_json = excluded.details_json,
      status = excluded.status,
      closed_at = excluded.closed_at,
      next_cycle_key = excluded.next_cycle_key,
      next_cycle_start = excluded.next_cycle_start,
      next_cycle_end = excluded.next_cycle_end,
      next_close_date = excluded.next_close_date,
      suggested_savings = excluded.suggested_savings,
      savings_action = excluded.savings_action,
      next_budget_json = excluded.next_budget_json,
      updated_at = CURRENT_TIMESTAMP
  `).bind(
    id,
    chatId,
    closureKey,
    closure.closeDate || '',
    closure.label || 'Cierre',
    data.mesKey || closureKey,
    closure.start || '',
    closure.end || '',
    round(closure.ingresos || 0),
    round(closure.gastos || 0),
    round(closure.balance || 0),
    round(closure.fijosPagados || 0),
    round(closure.fijosPendientes || 0),
    round(closure.deudasPendientes || 0),
    round(closure.presupuestoLimite || 0),
    round(closure.presupuestoUsado || 0),
    round(closure.presupuestoRestante || 0),
    round(closure.presupuestoExcedido || 0),
    round(closure.pendienteComprometido || 0),
    round(closure.queQueda || 0),
    round(closure.patrimonioDisponible || 0),
    Number(closure.movimientos || 0),
    topFugasJson,
    detailsJson,
    'closed',
    closedAt,
    nextCycle.key,
    nextCycle.startKey,
    nextCycle.endKey,
    nextCycle.closeDate,
    suggestedSavings,
    savingsAction,
    nextBudgetJson,
  ).run();

  const saved = await env.DB.prepare('SELECT * FROM financial_closures WHERE id = ?')
    .bind(id)
    .first();

  return {
    ok: true,
    saved: true,
    closure: financialClosureShape(saved),
  };
}

async function currentFinancialClosure(env, chatId, closureKey) {
  try {
    return await env.DB.prepare(`
      SELECT *
      FROM financial_closures
      WHERE chat_id = ? AND closure_key = ?
      LIMIT 1
    `).bind(chatId, closureKey).first();
  } catch (_error) {
    return null;
  }
}

function financialClosureShape(row) {
  if (!row) return null;

  return {
    id: row.id,
    chatId: row.chat_id,
    key: row.closure_key,
    closeDate: row.close_date,
    label: row.label,
    monthKey: row.month_key,
    start: row.start_date,
    end: row.end_date,
    ingresos: round(row.ingresos),
    gastos: round(row.gastos),
    balance: round(row.balance),
    fijosPagados: round(row.fijos_pagados),
    fijosPendientes: round(row.fijos_pendientes),
    deudasPendientes: round(row.deudas_pendientes),
    presupuestoLimite: round(row.presupuesto_limite),
    presupuestoUsado: round(row.presupuesto_usado),
    presupuestoRestante: round(row.presupuesto_restante),
    presupuestoExcedido: round(row.presupuesto_excedido),
    pendienteComprometido: round(row.pendiente_comprometido),
    queQueda: round(row.que_queda),
    patrimonioDisponible: round(row.patrimonio_disponible),
    movimientos: Number(row.movimientos || 0),
    topFugas: safeJsonParse(row.top_fugas_json, []),
    status: row.status || 'closed',
    closed: (row.status || 'closed') === 'closed',
    closedAt: row.closed_at || row.updated_at || '',
    suggestedSavings: round(row.suggested_savings || 0),
    savingsAction: row.savings_action || 'suggested',
    nextCycle: closureNextCycleShape(row),
    nextBudget: safeJsonParse(row.next_budget_json, []),
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || '',
  };
}

function cycleShape(cycle) {
  if (!cycle) return null;
  return {
    key: cycle.key,
    start: cycle.startKey,
    end: cycle.endKey,
    closeDate: cycle.closeDate,
    label: cycle.label,
    range: cycle.rangeLabel,
  };
}

function closureNextCycleShape(row) {
  if (!row?.next_cycle_key && !row?.next_cycle_start) return null;
  return {
    key: row.next_cycle_key || '',
    start: row.next_cycle_start || '',
    end: row.next_cycle_end || '',
    closeDate: row.next_close_date || '',
    range: row.next_cycle_start && row.next_cycle_end
      ? `${row.next_cycle_start.slice(8, 10)}/${row.next_cycle_start.slice(5, 7)}/${row.next_cycle_start.slice(0, 4)} - ${row.next_cycle_end.slice(8, 10)}/${row.next_cycle_end.slice(5, 7)}/${row.next_cycle_end.slice(0, 4)}`
      : '',
  };
}

function nextCycleBudgetSuggestion(budgets = []) {
  return (budgets || [])
    .filter((item) => Number(item.limite || 0) > 0 || Number(item.gasto || 0) > 0)
    .map((item) => {
      const limit = round(item.limite || 0);
      const spent = round(item.gasto || 0);
      const over = Math.max(spent - limit, 0);
      const under = Math.max(limit - spent, 0);
      const suggestedLimit = round(Math.max(
        0,
        over > 0
          ? Math.ceil((spent * 1.05) / 10) * 10
          : Math.max(limit, Math.ceil((spent * 1.1) / 10) * 10),
      ));
      const status = over > 0 ? 'subir_o_recortar' : under > limit * 0.35 ? 'puede_bajar' : 'mantener';
      const reason = over > 0
        ? 'Cerraste por encima del limite; sube el presupuesto o recorta esta categoria.'
        : under > limit * 0.35
          ? 'Quedo bastante margen sin usar; puedes bajar el limite si quieres liberar caja.'
          : 'El presupuesto calza con el gasto del ciclo.';

      return {
        category: item.cat,
        currentLimit: limit,
        spent,
        remaining: round(under),
        over: round(over),
        suggestedLimit,
        status,
        reason,
      };
    })
    .sort((a, b) => b.spent - a.spent)
    .slice(0, 8);
}

async function rulesList(env, params) {
  const chatId = getChatId(env, params);
  const categoryRows = await env.DB.prepare(`
    SELECT id, chat_id, keyword, category, priority, active, notes, updated_at
    FROM category_rules
    WHERE chat_id IN ('*', ?)
    ORDER BY
      CASE WHEN chat_id = ? THEN 0 ELSE 1 END,
      active DESC,
      priority DESC,
      keyword ASC
  `).bind(chatId, chatId).all();

  const budgetRows = await env.DB.prepare(`
    SELECT id, chat_id, budget_category, included_category, active, notes, updated_at
    FROM budget_category_rules
    WHERE chat_id IN ('*', ?)
    ORDER BY
      CASE WHEN chat_id = ? THEN 0 ELSE 1 END,
      active DESC,
      budget_category ASC,
      included_category ASC
  `).bind(chatId, chatId).all();

  return {
    ok: true,
    categoryRules: (categoryRows.results || []).map((row) => ({
      id: row.id,
      scope: row.chat_id === '*' ? 'global' : 'personal',
      keyword: row.keyword,
      category: row.category,
      priority: Number(row.priority || 0),
      active: Boolean(row.active),
      notes: row.notes || '',
      updatedAt: row.updated_at || '',
    })),
    budgetRules: (budgetRows.results || []).map((row) => ({
      id: row.id,
      scope: row.chat_id === '*' ? 'global' : 'personal',
      budgetCategory: row.budget_category,
      includedCategory: row.included_category,
      active: Boolean(row.active),
      notes: row.notes || '',
      updatedAt: row.updated_at || '',
    })),
  };
}

async function classifyRulePayload(env, payload) {
  const chatId = payloadChatId(env, payload);
  const rawCategory = payload.cat || payload.category || 'otro';
  const description = payload.desc || payload.description || '';
  const result = await classifyCategory(env, chatId, rawCategory, description);

  return {
    ok: true,
    category: result.category,
    source: result.source,
    keyword: result.keyword || '',
  };
}

async function budgetKeysPayload(env, payload) {
  const chatId = payloadChatId(env, payload);
  const category = normalizeBaseCategory(payload.cat || payload.category || payload.budget_category || payload.budgetCategory || 'otro');
  const rules = await loadBudgetRules(env, chatId);

  return {
    ok: true,
    category,
    keys: budgetCategoryKeysFromRules(rules, category),
  };
}

async function upsertCategoryRule(env, payload) {
  const chatId = payloadChatId(env, payload);
  const scope = payload.global === true || payload.scope === 'global' ? '*' : chatId;
  const keyword = normalizeRuleKeyword(payload.keyword || payload.palabra || payload.word || '');
  const category = normalizeBaseCategory(payload.category || payload.cat || '');
  const priority = clamp(Number(payload.priority || 100), 1, 999);
  const notes = String(payload.notes || payload.nota || '').trim().slice(0, 240);

  if (!keyword) throw httpError(400, 'keyword requerido');
  if (!category) throw httpError(400, 'categoria invalida');

  const id = `cat:${scope}:${safeRuleId(keyword)}`.slice(0, 180);
  await env.DB.prepare(`
    INSERT INTO category_rules (id, chat_id, keyword, category, priority, active, notes, updated_at)
    VALUES (?, ?, ?, ?, ?, 1, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(chat_id, keyword) DO UPDATE SET
      category = excluded.category,
      priority = excluded.priority,
      active = 1,
      notes = excluded.notes,
      updated_at = CURRENT_TIMESTAMP
  `).bind(id, scope, keyword, category, priority, notes).run();

  return {
    ok: true,
    rule: { id, scope: scope === '*' ? 'global' : 'personal', keyword, category, priority, active: true },
  };
}

async function deleteCategoryRule(env, payload) {
  const chatId = payloadChatId(env, payload);
  const keyword = normalizeRuleKeyword(payload.keyword || payload.palabra || payload.word || '');
  if (!keyword) throw httpError(400, 'keyword requerido');

  const result = await env.DB.prepare(`
    UPDATE category_rules
    SET active = 0, updated_at = CURRENT_TIMESTAMP
    WHERE keyword = ? AND chat_id IN (?, '*')
  `).bind(keyword, chatId).run();

  return {
    ok: true,
    keyword,
    deleted: true,
    changed: result.meta?.changes || 0,
  };
}

async function upsertBudgetCategoryRule(env, payload) {
  const chatId = payloadChatId(env, payload);
  const scope = payload.global === true || payload.scope === 'global' ? '*' : chatId;
  const budgetCategory = normalizeBaseCategory(payload.budget_category || payload.budgetCategory || payload.presupuesto || payload.cat || '');
  const includedCategory = normalizeBaseCategory(payload.included_category || payload.includedCategory || payload.incluye || payload.include || '');
  const notes = String(payload.notes || payload.nota || '').trim().slice(0, 240);

  if (!budgetCategory || !includedCategory) throw httpError(400, 'categorias invalidas');
  if (budgetCategory === includedCategory) throw httpError(400, 'La categoria base ya se cuenta sola');

  const id = `budget:${scope}:${budgetCategory}:${includedCategory}`.slice(0, 180);
  await env.DB.prepare(`
    INSERT INTO budget_category_rules (id, chat_id, budget_category, included_category, active, notes, updated_at)
    VALUES (?, ?, ?, ?, 1, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(chat_id, budget_category, included_category) DO UPDATE SET
      active = 1,
      notes = excluded.notes,
      updated_at = CURRENT_TIMESTAMP
  `).bind(id, scope, budgetCategory, includedCategory, notes).run();

  return {
    ok: true,
    rule: {
      id,
      scope: scope === '*' ? 'global' : 'personal',
      budgetCategory,
      includedCategory,
      active: true,
    },
  };
}

async function deleteBudgetCategoryRule(env, payload) {
  const chatId = payloadChatId(env, payload);
  const budgetCategory = normalizeBaseCategory(payload.budget_category || payload.budgetCategory || payload.presupuesto || payload.cat || '');
  const includedCategory = normalizeBaseCategory(payload.included_category || payload.includedCategory || payload.incluye || payload.include || '');

  if (!budgetCategory || !includedCategory) throw httpError(400, 'categorias invalidas');

  const result = await env.DB.prepare(`
    UPDATE budget_category_rules
    SET active = 0, updated_at = CURRENT_TIMESTAMP
    WHERE budget_category = ?
      AND included_category = ?
      AND chat_id IN (?, '*')
  `).bind(budgetCategory, includedCategory, chatId).run();

  return {
    ok: true,
    deleted: true,
    budgetCategory,
    includedCategory,
    changed: result.meta?.changes || 0,
  };
}

async function insertTransaction(env, payload) {
  const chatId = String(payload.chat_id || env.DEFAULT_CHAT_ID || '').trim();
  if (!chatId) throw httpError(400, 'chat_id requerido');

  const tx = await normalizeTransaction(env, payload, chatId);
  await upsertTransaction(env, tx);
  return { ok: true, transaction: tx };
}

async function upsertBudgetFromPayload(env, payload, params) {
  const chatId = String(payload.chat_id || payload.chatId || getChatId(env, params) || '').trim();
  if (!chatId) throw httpError(400, 'chat_id requerido');

  const budget = await upsertBudget(env, chatId, payload);
  if (!budget) throw httpError(400, 'Presupuesto invalido');

  return {
    ok: true,
    budget,
  };
}

async function deleteTransaction(env, { id, chatId, deleteFromGas = false }) {
  const cleanId = String(id || '').trim();
  const cleanChatId = String(chatId || '').trim();

  if (!cleanId) throw httpError(400, 'id requerido');
  if (!cleanChatId) throw httpError(400, 'chat_id requerido');

  const tx = await env.DB.prepare('SELECT * FROM transactions WHERE id = ? AND chat_id = ?')
    .bind(cleanId, cleanChatId)
    .first();

  if (!tx) throw httpError(404, 'Transaccion no encontrada');

  let gasResult = null;
  if (deleteFromGas) {
    gasResult = await deleteTransactionFromGas(env, tx);
  }

  const receipts = await env.DB.prepare('SELECT id, storage, r2_key FROM receipts WHERE transaction_id = ?')
    .bind(cleanId)
    .all();

  if (env.RECEIPTS_BUCKET) {
    for (const receipt of receipts.results || []) {
      if (receipt.storage === 'r2' && receipt.r2_key) {
        await env.RECEIPTS_BUCKET.delete(receipt.r2_key).catch(() => undefined);
      }
    }
  }

  await env.DB.prepare('DELETE FROM receipts WHERE transaction_id = ?')
    .bind(cleanId)
    .run();

  await env.DB.prepare('DELETE FROM transactions WHERE id = ? AND chat_id = ?')
    .bind(cleanId, cleanChatId)
    .run();

  return {
    ok: true,
    deleted: true,
    id: cleanId,
    gas: gasResult,
  };
}

async function updateTransactionFromDashboard(env, id, payload, params) {
  const chatId = String(params.get('chat_id') || payload.chat_id || payload.chatId || env.DEFAULT_CHAT_ID || '').trim();
  const cleanId = String(id || '').trim();
  if (!chatId) throw httpError(400, 'chat_id requerido');
  if (!cleanId) throw httpError(400, 'id requerido');

  const existing = await env.DB.prepare('SELECT * FROM transactions WHERE id = ? AND chat_id = ?')
    .bind(cleanId, chatId)
    .first();
  if (!existing) throw httpError(404, 'Transaccion no encontrada');

  const description = String(payload.desc ?? payload.description ?? existing.description).trim().slice(0, 240);
  const category = normalizeCategory(payload.cat ?? payload.category ?? existing.category, description);
  const amount = parseAmount(payload.monto ?? payload.amount ?? existing.amount);
  const currency = normalizeCurrency(payload.currency ?? existing.currency);
  const txDate = normalizeDateOnly(payload.fecha ?? payload.tx_date ?? existing.tx_date) || existing.tx_date;
  const txTime = String(payload.hora ?? payload.tx_time ?? existing.tx_time ?? '00:00').slice(0, 5);
  const type = String(payload.tipo ?? payload.type ?? existing.type).toLowerCase() === 'ingreso' ? 'ingreso' : 'gasto';
  const paymentMethod = normalizePaymentMethod(payload.paymentMethod ?? payload.payment_method ?? existing.payment_method) || 'debito';
  const paymentDueDate = paymentMethod === 'credito'
    ? normalizeDateOnly(payload.paymentDueDate ?? payload.payment_due_date ?? existing.payment_due_date)
    : '';
  const cardName = paymentMethod === 'credito'
    ? String(payload.cardName ?? payload.card_name ?? existing.card_name ?? '').trim().slice(0, 80)
    : '';

  if (!description) throw httpError(400, 'descripcion requerida');
  if (amount <= 0) throw httpError(400, 'monto invalido');

  await env.DB.prepare(`
    UPDATE transactions
    SET tx_date = ?,
        tx_time = ?,
        type = ?,
        description = ?,
        category = ?,
        amount = ?,
        currency = ?,
        payment_method = ?,
        payment_due_date = ?,
        card_name = ?,
        source = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND chat_id = ?
  `).bind(
    txDate,
    txTime,
    type,
    description,
    category,
    round(amount),
    currency,
    paymentMethod,
    paymentDueDate || null,
    cardName,
    existing.source && existing.source !== 'gas' ? existing.source : 'dashboard_edit',
    cleanId,
    chatId,
  ).run();

  await env.DB.prepare(`
    UPDATE receipts
    SET tx_date = ?,
        tx_time = ?,
        type = ?,
        description = ?,
        category = ?,
        amount = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE transaction_id = ?
  `).bind(txDate, txTime, type, description, category, round(amount), cleanId).run();

  return {
    ok: true,
    transaction: {
      id: cleanId,
      fecha: txDate,
      hora: txTime,
      tipo: type,
      desc: description,
      cat: category,
      monto: round(amount),
      currency,
      paymentMethod,
      paymentDueDate,
      cardName,
    },
  };
}

async function updateTransactionCategory(env, payload) {
  const chatId = String(payload.chat_id || payload.chatId || env.DEFAULT_CHAT_ID || '').trim();
  const oldId = String(payload.old_id || payload.id || '').trim();
  const newId = String(payload.new_id || '').trim();
  const newCategory = normalizeCategory(payload.cat || payload.category || 'otro', payload.desc || payload.description || '');

  if (!chatId) throw httpError(400, 'chat_id requerido');
  if (!newCategory) throw httpError(400, 'categoria requerida');

  const existing = await findTransactionForCategoryUpdate(env, payload, chatId, oldId);
  if (!existing) throw httpError(404, 'Transaccion no encontrada');

  const targetId = (newId || stableTransactionId({
    rawId: '',
    chatId,
    fecha: existing.tx_date,
    hora: existing.tx_time,
    tipo: existing.type,
    cat: newCategory,
    monto: existing.amount,
    desc: existing.description,
  })).slice(0, 180);
  const nextSource = existing.source && existing.source !== 'gas' ? existing.source : 'telegram_edit';

  if (targetId !== existing.id) {
    await env.DB.prepare(`
      INSERT INTO transactions (
        id, chat_id, tx_date, tx_time, type, description, category, amount,
        currency, payment_method, payment_due_date, card_name, source, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        category = excluded.category,
        currency = excluded.currency,
        payment_method = excluded.payment_method,
        payment_due_date = excluded.payment_due_date,
        card_name = excluded.card_name,
        source = excluded.source,
        updated_at = CURRENT_TIMESTAMP
    `).bind(
      targetId,
      existing.chat_id,
      existing.tx_date,
      existing.tx_time,
      existing.type,
      existing.description,
      newCategory,
      existing.amount,
      normalizeCurrency(existing.currency),
      existing.payment_method || 'debito',
      existing.payment_due_date || null,
      existing.card_name || '',
      nextSource,
      existing.created_at,
    ).run();

    await env.DB.prepare(`
      UPDATE receipts
      SET transaction_id = ?, category = ?, updated_at = CURRENT_TIMESTAMP
      WHERE transaction_id = ?
    `).bind(targetId, newCategory, existing.id).run();

    await env.DB.prepare('DELETE FROM transactions WHERE id = ?')
      .bind(existing.id)
      .run();
  } else {
    await env.DB.prepare(`
      UPDATE transactions
      SET category = ?, source = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(newCategory, nextSource, existing.id).run();

    await env.DB.prepare(`
      UPDATE receipts
      SET category = ?, updated_at = CURRENT_TIMESTAMP
      WHERE transaction_id = ?
    `).bind(newCategory, existing.id).run();
  }

  return {
    ok: true,
    transaction: {
      id: targetId,
      oldId: existing.id,
      cat: newCategory,
    },
  };
}

async function findTransactionForCategoryUpdate(env, payload, chatId, oldId) {
  if (oldId) {
    const byId = await env.DB.prepare('SELECT * FROM transactions WHERE id = ? AND chat_id = ?')
      .bind(oldId, chatId)
      .first();
    if (byId) return byId;
  }

  const fecha = String(payload.fecha || payload.tx_date || '').slice(0, 10);
  const hora = String(payload.hora || payload.tx_time || '00:00').slice(0, 5);
  const tipo = String(payload.tipo || payload.type || '').toLowerCase() === 'ingreso' ? 'ingreso' : 'gasto';
  const desc = String(payload.desc || payload.description || '').trim();
  const amount = parseAmount(payload.monto || payload.amount || 0);
  const oldCategory = normalizeCategory(payload.old_cat || payload.oldCategory || payload.previous_category || '', desc);

  if (!fecha || !desc || amount <= 0) return null;

  return env.DB.prepare(`
    SELECT *
    FROM transactions
    WHERE chat_id = ?
      AND tx_date = ?
      AND tx_time = ?
      AND type = ?
      AND lower(trim(description)) = lower(trim(?))
      AND ABS(amount - ?) < 0.005
      AND (? = '' OR category = ?)
    ORDER BY
      CASE WHEN source <> 'gas' THEN 0 ELSE 1 END,
      created_at ASC
    LIMIT 1
  `).bind(chatId, fecha, hora, tipo, desc, amount, oldCategory, oldCategory).first();
}

async function updateTransactionPayment(env, payload) {
  const chatId = String(payload.chat_id || payload.chatId || env.DEFAULT_CHAT_ID || '').trim();
  const method = normalizePaymentMethod(payload.payment_method || payload.paymentMethod || payload.metodo_pago || payload.metodoPago);
  const dueDate = method === 'credito'
    ? normalizeDateOnly(payload.payment_due_date || payload.paymentDueDate || payload.fecha_pago || payload.fechaPago)
    : '';
  const cardName = method === 'credito'
    ? String(payload.card_name || payload.cardName || payload.tarjeta || '').trim().slice(0, 80)
    : '';

  if (!chatId) throw httpError(400, 'chat_id requerido');
  if (!method) throw httpError(400, 'payment_method requerido');

  const existing = await findTransactionForPaymentUpdate(env, payload, chatId);
  if (!existing) throw httpError(404, 'Transaccion no encontrada');

  await env.DB.prepare(`
    UPDATE transactions
    SET payment_method = ?,
        payment_due_date = ?,
        card_name = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(method, dueDate || null, cardName, existing.id).run();

  return {
    ok: true,
    transaction: {
      id: existing.id,
      paymentMethod: method,
      paymentDueDate: dueDate,
      cardName,
    },
  };
}

async function findTransactionForPaymentUpdate(env, payload, chatId) {
  const id = String(payload.id || payload.transaction_id || payload.transactionId || '').trim();
  if (id) {
    const byId = await env.DB.prepare('SELECT * FROM transactions WHERE id = ? AND chat_id = ?')
      .bind(id, chatId)
      .first();
    if (byId) return byId;
  }

  const fecha = String(payload.fecha || payload.tx_date || '').slice(0, 10);
  const hora = String(payload.hora || payload.tx_time || '00:00').slice(0, 5);
  const tipo = String(payload.tipo || payload.type || '').toLowerCase() === 'ingreso' ? 'ingreso' : 'gasto';
  const desc = String(payload.desc || payload.description || '').trim();
  const amount = parseAmount(payload.monto || payload.amount || 0);
  const category = normalizeCategory(payload.cat || payload.category || 'otro', desc);

  if (!fecha || !desc || amount <= 0) return null;

  return env.DB.prepare(`
    SELECT *
    FROM transactions
    WHERE chat_id = ?
      AND tx_date = ?
      AND tx_time = ?
      AND type = ?
      AND lower(trim(description)) = lower(trim(?))
      AND category = ?
      AND ABS(amount - ?) < 0.005
    ORDER BY
      CASE WHEN source <> 'gas' THEN 0 ELSE 1 END,
      created_at ASC
    LIMIT 1
  `).bind(chatId, fecha, hora, tipo, desc, category, amount).first();
}

async function uploadReceipt(env, payload) {
  const chatId = String(payload.chat_id || payload.chatId || env.DEFAULT_CHAT_ID || '').trim();
  const transactionId = String(payload.transaction_id || payload.transactionId || '').trim();
  const imageBase64 = String(payload.image_base64 || payload.imageBase64 || '').trim();
  const contentType = normalizeImageContentType(payload.content_type || payload.contentType || payload.mimeType);
  const fileName = safeFileName(payload.file_name || payload.fileName || `recibo.${imageExtension(contentType)}`);

  if (!chatId) throw httpError(400, 'chat_id requerido');
  if (!transactionId) throw httpError(400, 'transaction_id requerido');
  if (!imageBase64) throw httpError(400, 'image_base64 requerido');

  const cleanedBase64 = cleanBase64(imageBase64);
  const bytes = base64ToBytes(cleanedBase64);
  if (!bytes.byteLength) throw httpError(400, 'Imagen vacia');
  if (bytes.byteLength > 10 * 1024 * 1024) throw httpError(413, 'Imagen demasiado grande');

  const txDate = String(payload.fecha || payload.tx_date || '').slice(0, 10);
  const txTime = String(payload.hora || payload.tx_time || '').slice(0, 5);
  const type = String(payload.tipo || payload.type || 'gasto').toLowerCase() === 'ingreso' ? 'ingreso' : 'gasto';
  const description = String(payload.desc || payload.description || '').trim();
  const category = (await classifyCategory(env, chatId, payload.cat || payload.category || 'otro', description)).category;
  const amount = parseAmount(payload.monto || payload.amount || 0);
  const receiptId = String(payload.id || `receipt_${(await sha256Hex(`${chatId}|${transactionId}|${fileName}`)).slice(0, 32)}`).slice(0, 180);
  const month = txDate.slice(0, 7) || formatMonth(new Date());
  const r2Key = `receipts/${safeObjectSegment(chatId)}/${month}/${safeObjectSegment(receiptId)}.${imageExtension(contentType)}`;
  let storage = 'd1';
  let storedR2Key = null;
  let storedBase64 = cleanedBase64;
  let storageWarning = '';

  if (env.RECEIPTS_BUCKET) {
    try {
      await env.RECEIPTS_BUCKET.put(r2Key, bytes, {
        httpMetadata: {
          contentType,
        },
        customMetadata: {
          chat_id: chatId,
          transaction_id: transactionId,
        },
      });
      storage = 'r2';
      storedR2Key = r2Key;
      storedBase64 = null;
    } catch (error) {
      storageWarning = `R2 no disponible, guardado en D1: ${error.message || String(error)}`;
    }
  }

  await env.DB.prepare(`
    INSERT INTO receipts (
      id, transaction_id, chat_id, storage, r2_key, image_base64, file_name, content_type, size,
      telegram_file_id, telegram_file_path, tx_date, tx_time, type,
      description, category, amount, currency, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(transaction_id) DO UPDATE SET
      storage = excluded.storage,
      r2_key = excluded.r2_key,
      image_base64 = excluded.image_base64,
      file_name = excluded.file_name,
      content_type = excluded.content_type,
      size = excluded.size,
      telegram_file_id = excluded.telegram_file_id,
      telegram_file_path = excluded.telegram_file_path,
      tx_date = excluded.tx_date,
      tx_time = excluded.tx_time,
      type = excluded.type,
      description = excluded.description,
      category = excluded.category,
      amount = excluded.amount,
      currency = excluded.currency,
      updated_at = CURRENT_TIMESTAMP
  `).bind(
    receiptId,
    transactionId,
    chatId,
    storage,
    storedR2Key,
    storedBase64,
    fileName,
    contentType,
    bytes.byteLength,
    String(payload.telegram_file_id || payload.telegramFileId || ''),
    String(payload.telegram_file_path || payload.telegramFilePath || ''),
    txDate,
    txTime,
    type,
    description,
    category,
    amount || null,
    normalizeCurrency(payload.currency || payload.moneda),
  ).run();

  return {
    ok: true,
    receipt: {
      id: receiptId,
      transactionId,
      fileName,
      contentType,
      size: bytes.byteLength,
      storage,
      warning: storageWarning,
    },
  };
}

async function receiptFile(env, receiptId) {
  const row = await env.DB.prepare(`
    SELECT storage, r2_key, image_base64, file_name, content_type
    FROM receipts
    WHERE id = ?
  `).bind(receiptId).first();

  if (!row) throw httpError(404, 'Recibo no encontrado');

  if (row.storage === 'r2') {
    if (!env.RECEIPTS_BUCKET) throw httpError(500, 'RECEIPTS_BUCKET no configurado');

    const object = await env.RECEIPTS_BUCKET.get(row.r2_key);
    if (!object) throw httpError(404, 'Archivo no encontrado');

    return corsResponse(object.body, 200, {
      'content-type': row.content_type || 'application/octet-stream',
      'cache-control': 'private, max-age=60',
      'content-disposition': `inline; filename="${safeHeaderFileName(row.file_name || 'recibo')}"`,
    });
  }

  if (!row.image_base64) throw httpError(404, 'Imagen no disponible');

  return corsResponse(base64ToBytes(row.image_base64), 200, {
    'content-type': row.content_type || 'application/octet-stream',
    'cache-control': 'private, max-age=60',
    'content-disposition': `inline; filename="${safeHeaderFileName(row.file_name || 'recibo')}"`,
  });
}

async function syncFromGas(env, params) {
  if (!env.GAS_API_URL || !env.GAS_API_KEY) {
    throw httpError(400, 'Faltan secrets GAS_API_URL o GAS_API_KEY');
  }

  const limit = clamp(Number(params.get('limit') || 500), 1, 500);
  const chatId = String(params.get('chat_id') || env.DEFAULT_CHAT_ID || '').trim();
  if (!chatId) throw httpError(400, 'Falta chat_id o DEFAULT_CHAT_ID');

  const txUrl = new URL(env.GAS_API_URL);
  txUrl.searchParams.set('action', 'txs');
  txUrl.searchParams.set('key', env.GAS_API_KEY);
  txUrl.searchParams.set('limit', String(limit));
  txUrl.searchParams.set('chat_id', chatId);

  const dashUrl = new URL(env.GAS_API_URL);
  dashUrl.searchParams.set('action', 'dashboard');
  dashUrl.searchParams.set('key', env.GAS_API_KEY);
  dashUrl.searchParams.set('chat_id', chatId);

  const [txResp, dashResp] = await Promise.all([fetch(txUrl), fetch(dashUrl)]);
  const txData = await txResp.json();
  const dashData = await dashResp.json();

  if (!txData.ok) throw httpError(502, txData.error || 'Error leyendo txs desde GAS');
  if (!dashData.ok) throw httpError(502, dashData.error || 'Error leyendo dashboard desde GAS');

  const gasTransactions = txData.transacciones;
  if (!Array.isArray(gasTransactions)) {
    throw httpError(502, 'GAS no devolvio una lista valida de transacciones');
  }

  const gasTotal = Number(txData.total || gasTransactions.length);
  const mirrorTransactions = Number.isFinite(gasTotal) && gasTotal <= gasTransactions.length;
  const sheetTransactionIds = new Set();

  let txCount = 0;
  for (const raw of gasTransactions) {
    const tx = await normalizeTransaction(env, raw, chatId);
    await upsertTransaction(env, tx);
    sheetTransactionIds.add(tx.id);
    txCount++;
  }

  const removedTransactions = mirrorTransactions
    ? await pruneTransactionsNotInSheets(env, chatId, sheetTransactionIds)
    : 0;

  let budgetCount = 0;
  for (const raw of dashData.presupuestos || []) {
    await upsertBudget(env, chatId, raw);
    budgetCount++;
  }

  let goalCount = 0;
  for (const raw of dashData.metas || []) {
    if (await upsertGoal(env, chatId, raw)) goalCount++;
  }

  let fixedCount = 0;
  for (const raw of dashData.fijos || []) {
    await upsertFixedExpense(env, chatId, raw);
    fixedCount++;
  }

  let debtCount = 0;
  for (const raw of dashData.deudas || dashData.debts || []) {
    if (await upsertDebt(env, chatId, raw)) debtCount++;
  }

  const runId = crypto.randomUUID();
  await env.DB.prepare(`
    INSERT INTO sync_runs (id, source, status, details)
    VALUES (?, 'gas', 'ok', ?)
  `).bind(runId, JSON.stringify({
    chatId,
    txCount,
    removedTransactions,
    mirrorTransactions,
    gasTotal,
    budgetCount,
    goalCount,
    fixedCount,
    debtCount,
    limit,
  })).run();

  return {
    ok: true,
    source: 'gas',
    chatId,
    transactions: txCount,
    removedTransactions,
    mirrorTransactions,
    budgets: budgetCount,
    goals: goalCount,
    fixedExpenses: fixedCount,
    debts: debtCount,
    syncedAt: new Date().toISOString(),
  };
}

async function emailConfigFromGas(env) {
  const cacheKey = 'email_config_cache';
  const cached = await readJsonCache(env, cacheKey, 10 * 60 * 1000);
  if (cached.fresh) return cached.value;
  if (!env.GAS_API_URL || !env.GAS_API_KEY) return cached.value;

  try {
    const url = new URL(env.GAS_API_URL);
    url.searchParams.set('action', 'dashboard');
    url.searchParams.set('key', env.GAS_API_KEY);

    const response = await fetch(url, { signal: timeoutSignal(900) });
    const data = await response.json();
    if (data?.emailConfig) {
      await setJsonCache(env, cacheKey, data.emailConfig);
      return data.emailConfig;
    }
    return cached.value;
  } catch (_error) {
    await setJsonCache(env, cacheKey, null);
    return cached.value;
  }
}

async function deleteTransactionFromGas(env, tx) {
  if (isQaEnv(env)) {
    return {
      ok: true,
      skipped: true,
      environment: 'qa',
      reason: 'QA no borra movimientos en Apps Script/Sheets.',
    };
  }

  if (!env.GAS_API_URL || !env.GAS_API_KEY) {
    return { ok: false, skipped: true, reason: 'GAS_API_URL o GAS_API_KEY no configurado' };
  }

  const url = new URL(env.GAS_API_URL);
  url.searchParams.set('action', 'delete_tx');
  url.searchParams.set('key', env.GAS_API_KEY);
  url.searchParams.set('chat_id', tx.chat_id);
  url.searchParams.set('id', tx.id);
  url.searchParams.set('fecha', tx.tx_date || '');
  url.searchParams.set('hora', tx.tx_time || '');
  url.searchParams.set('tipo', tx.type || 'gasto');
  url.searchParams.set('desc', tx.description || '');
  url.searchParams.set('cat', tx.category || 'otro');
  url.searchParams.set('monto', String(tx.amount || 0));

  const response = await fetch(url.toString());
  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.ok === false) {
    throw httpError(502, data.error || 'No se pudo eliminar en Sheets');
  }

  return data;
}

async function upsertTransaction(env, tx) {
  await mergeDuplicateTransaction(env, tx);

  await env.DB.prepare(`
    INSERT INTO transactions (
      id, chat_id, tx_date, tx_time, type, description, category, amount,
      currency, payment_method, payment_due_date, card_name, source, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      tx_date = excluded.tx_date,
      tx_time = excluded.tx_time,
      type = excluded.type,
      description = excluded.description,
      category = excluded.category,
      amount = excluded.amount,
      currency = excluded.currency,
      payment_method = excluded.payment_method,
      payment_due_date = excluded.payment_due_date,
      card_name = excluded.card_name,
      source = CASE
        WHEN excluded.source = 'gas' AND transactions.source <> 'gas' THEN transactions.source
        ELSE excluded.source
      END,
      updated_at = CURRENT_TIMESTAMP
  `).bind(
    tx.id,
    tx.chat_id,
    tx.fecha,
    tx.hora,
    tx.tipo,
    tx.desc,
    tx.cat,
    tx.monto,
    tx.currency,
    tx.payment_method,
    tx.payment_due_date || null,
    tx.card_name,
    tx.source,
  ).run();
}

async function mergeDuplicateTransaction(env, tx) {
  const duplicate = await env.DB.prepare(`
    SELECT id, source
    FROM transactions
    WHERE id <> ?
      AND chat_id = ?
      AND tx_date = ?
      AND tx_time = ?
      AND type = ?
      AND lower(trim(description)) = lower(trim(?))
      AND ABS(amount - ?) < 0.005
    ORDER BY
      CASE WHEN source <> 'gas' THEN 0 ELSE 1 END,
      created_at ASC
    LIMIT 1
  `).bind(
    tx.id,
    tx.chat_id,
    tx.fecha,
    tx.hora,
    tx.tipo,
    tx.desc,
    tx.monto,
  ).first();

  if (!duplicate) return;

  await env.DB.prepare(`
    UPDATE receipts
    SET transaction_id = ?, updated_at = CURRENT_TIMESTAMP
    WHERE transaction_id = ?
  `).bind(tx.id, duplicate.id).run();

  if (tx.source === 'gas' && duplicate.source && duplicate.source !== 'gas') {
    tx.source = duplicate.source;
  }

  await env.DB.prepare('DELETE FROM transactions WHERE id = ?')
    .bind(duplicate.id)
    .run();
}

async function upsertBudget(env, chatId, raw) {
  const category = normalizeBaseCategory(raw.cat || raw.category || raw.categoria || 'otro');
  const limit = Number(raw.limite || raw.limit_amount || raw.limit || 0);
  if (!category || limit <= 0) return null;

  await env.DB.prepare(`
    INSERT INTO budgets (id, chat_id, category, limit_amount, updated_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(chat_id, category) DO UPDATE SET
      limit_amount = excluded.limit_amount,
      updated_at = CURRENT_TIMESTAMP
  `).bind(`budget:${chatId}:${category}`, chatId, category, limit).run();

  return {
    id: `budget:${chatId}:${category}`,
    chat_id: chatId,
    cat: category,
    limite: round(limit),
  };
}

async function pruneTransactionsNotInSheets(env, chatId, sheetTransactionIds) {
  const keepIds = [...sheetTransactionIds].filter(Boolean);
  const keepPlaceholders = keepIds.map(() => '?').join(', ');
  const rows = keepIds.length
    ? await env.DB.prepare(`
      SELECT id
      FROM transactions
      WHERE chat_id = ?
        AND id NOT IN (${keepPlaceholders})
    `).bind(chatId, ...keepIds).all()
    : await env.DB.prepare(`
      SELECT id
      FROM transactions
      WHERE chat_id = ?
    `).bind(chatId).all();

  const idsToRemove = (rows.results || []).map((row) => row.id).filter(Boolean);
  for (const id of idsToRemove) {
    await deleteTransaction(env, { id, chatId, deleteFromGas: false });
  }

  return idsToRemove.length;
}

async function upsertGoal(env, chatId, raw) {
  const name = normalizeKey(raw.nombre || raw.name || '');
  const target = parseAmount(raw.objetivo || raw.target_amount || 0);
  const saved = parseAmount(raw.ahorrado || raw.saved_amount || 0);
  if (!name || target <= 0) return false;

  await env.DB.prepare(`
    INSERT INTO goals (id, chat_id, name, target_amount, saved_amount, updated_at)
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(chat_id, name) DO UPDATE SET
      target_amount = excluded.target_amount,
      saved_amount = excluded.saved_amount,
      updated_at = CURRENT_TIMESTAMP
  `).bind(`goal:${chatId}:${name}`, chatId, name, target, saved).run();

  return true;
}

async function upsertFixedExpense(env, chatId, raw) {
  const fixed = await normalizeFixedExpense(env, chatId, raw);
  if (!fixed) return false;
  await saveFixedExpense(env, fixed);
  return true;
}

async function upsertFixedExpenseFromPayload(env, payload, params) {
  const chatId = String(payload.chat_id || payload.chatId || params.get('chat_id') || env.DEFAULT_CHAT_ID || '').trim();
  if (!chatId) throw httpError(400, 'chat_id requerido');

  const fixed = await normalizeFixedExpense(env, chatId, payload);
  if (!fixed) throw httpError(400, 'Gasto fijo invalido');
  const saved = await saveFixedExpense(env, fixed);

  return {
    ok: true,
    fixedExpense: fixedExpenseShape(saved),
  };
}

async function normalizeFixedExpense(env, chatId, raw) {
  const name = normalizeKey(raw.nombre || raw.name || '');
  const amount = parseAmount(raw.monto || raw.amount || 0);
  const category = (await classifyCategory(env, chatId, raw.cat || raw.category || 'servicios', name)).category;
  const rawCurrency = raw.currency ?? raw.moneda;
  const hasCurrency = rawCurrency !== undefined && rawCurrency !== null && String(rawCurrency).trim() !== '';
  const currency = hasCurrency ? normalizeCurrency(rawCurrency) : 'PEN';
  const active = raw.active === undefined ? 1 : (raw.active === false || raw.active === 0 ? 0 : 1);
  if (!name || amount <= 0) return null;

  return {
    id: String(raw.id || `fixed:${chatId}:${name}`).slice(0, 180),
    chat_id: chatId,
    name,
    amount: round(amount),
    category,
    currency,
    has_currency: hasCurrency,
    active,
  };
}

async function saveFixedExpense(env, fixed) {
  await env.DB.prepare(`
    INSERT INTO fixed_expenses (id, chat_id, name, amount, category, currency, active, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(chat_id, name) DO UPDATE SET
      amount = excluded.amount,
      category = excluded.category,
      currency = CASE WHEN ? = 1 THEN excluded.currency ELSE fixed_expenses.currency END,
      active = excluded.active,
      updated_at = CURRENT_TIMESTAMP
  `).bind(
    fixed.id,
    fixed.chat_id,
    fixed.name,
    fixed.amount,
    fixed.category,
    fixed.currency,
    fixed.active,
    fixed.has_currency ? 1 : 0,
  ).run();

  const byId = await env.DB.prepare('SELECT * FROM fixed_expenses WHERE id = ? AND chat_id = ?')
    .bind(fixed.id, fixed.chat_id)
    .first();
  if (byId) return byId;

  return env.DB.prepare('SELECT * FROM fixed_expenses WHERE chat_id = ? AND lower(name) = lower(?)')
    .bind(fixed.chat_id, fixed.name)
    .first();
}

async function updateFixedExpenseFromDashboard(env, id, payload, params) {
  const chatId = String(params.get('chat_id') || payload.chat_id || payload.chatId || env.DEFAULT_CHAT_ID || '').trim();
  const cleanId = String(id || '').trim();
  if (!chatId) throw httpError(400, 'chat_id requerido');
  if (!cleanId) throw httpError(400, 'id requerido');

  const existing = await env.DB.prepare('SELECT * FROM fixed_expenses WHERE id = ? AND chat_id = ?')
    .bind(cleanId, chatId)
    .first();
  if (!existing) throw httpError(404, 'Gasto fijo no encontrado');

  const name = normalizeKey(payload.nombre ?? payload.name ?? existing.name);
  const amount = parseAmount(payload.monto ?? payload.amount ?? existing.amount);
  const category = (await classifyCategory(env, chatId, payload.cat ?? payload.category ?? existing.category, name)).category;
  const currency = normalizeCurrency(payload.currency ?? payload.moneda ?? existing.currency ?? 'PEN');
  const active = payload.active === undefined ? Number(existing.active ?? 1) : (payload.active === false || payload.active === 0 ? 0 : 1);

  if (!name) throw httpError(400, 'nombre requerido');
  if (amount <= 0) throw httpError(400, 'monto invalido');

  const conflict = await env.DB.prepare('SELECT id FROM fixed_expenses WHERE chat_id = ? AND lower(name) = lower(?) AND id <> ?')
    .bind(chatId, name, cleanId)
    .first();
  if (conflict) throw httpError(409, 'Ya existe otro gasto fijo con ese nombre');

  await env.DB.prepare(`
    UPDATE fixed_expenses
    SET name = ?,
        amount = ?,
        category = ?,
        currency = ?,
        active = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND chat_id = ?
  `).bind(name, round(amount), category, currency, active, cleanId, chatId).run();

  const saved = await env.DB.prepare('SELECT * FROM fixed_expenses WHERE id = ? AND chat_id = ?')
    .bind(cleanId, chatId)
    .first();
  return { ok: true, fixedExpense: fixedExpenseShape(saved) };
}

async function deleteFixedExpense(env, id, params) {
  const chatId = String(params.get('chat_id') || env.DEFAULT_CHAT_ID || '').trim();
  const cleanId = String(id || '').trim();
  if (!chatId) throw httpError(400, 'chat_id requerido');
  if (!cleanId) throw httpError(400, 'id requerido');

  const existing = await env.DB.prepare('SELECT id FROM fixed_expenses WHERE id = ? AND chat_id = ?')
    .bind(cleanId, chatId)
    .first();
  if (!existing) throw httpError(404, 'Gasto fijo no encontrado');

  await env.DB.prepare(`
    UPDATE fixed_expenses
    SET active = 0,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND chat_id = ?
  `).bind(cleanId, chatId).run();

  return { ok: true, deleted: true, id: cleanId };
}

async function setFixedExpenseMonthStatus(env, id, payload, params) {
  const chatId = String(params.get('chat_id') || payload.chat_id || payload.chatId || env.DEFAULT_CHAT_ID || '').trim();
  const cleanId = String(id || '').trim();
  const monthKey = String(payload.month_key || payload.monthKey || payCycleFromDate(new Date()).key).trim();
  const status = normalizeKey(payload.status || payload.estado || 'pagado');
  const paidDate = normalizeDateOnly(payload.paid_date || payload.paidDate || payload.fecha || localDateKey(new Date())) || localDateKey(new Date());
  const notes = String(payload.notes || payload.notas || '').trim().slice(0, 240);

  if (!chatId) throw httpError(400, 'chat_id requerido');
  if (!cleanId) throw httpError(400, 'id requerido');
  if (!/^\d{4}-\d{2}$/.test(monthKey)) throw httpError(400, 'month_key invalido');
  if (!['pagado', 'saltado', 'pendiente'].includes(status)) throw httpError(400, 'estado invalido');

  const fixed = await env.DB.prepare('SELECT * FROM fixed_expenses WHERE id = ? AND chat_id = ? AND active = 1')
    .bind(cleanId, chatId)
    .first();
  if (!fixed) throw httpError(404, 'Gasto fijo no encontrado');

  if (status === 'pendiente') {
    await env.DB.prepare('DELETE FROM fixed_expense_month_status WHERE fixed_id = ? AND chat_id = ? AND month_key = ?')
      .bind(cleanId, chatId, monthKey)
      .run();
  } else {
    const statusId = `fixed-status:${chatId}:${cleanId}:${monthKey}`.slice(0, 220);
    await env.DB.prepare(`
      INSERT INTO fixed_expense_month_status (id, fixed_id, chat_id, month_key, status, paid_date, notes, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(fixed_id, chat_id, month_key) DO UPDATE SET
        status = excluded.status,
        paid_date = excluded.paid_date,
        notes = excluded.notes,
        updated_at = CURRENT_TIMESTAMP
    `).bind(statusId, cleanId, chatId, monthKey, status, paidDate, notes).run();
  }

  return {
    ok: true,
    id: cleanId,
    monthKey,
    status,
    fixedExpense: fixedExpenseShape(fixed),
  };
}

function fixedExpenseShape(row) {
  const currency = normalizeCurrency(row.currency || 'PEN');
  return {
    id: row.id,
    nombre: title(row.name || row.nombre || ''),
    monto: round(row.amount ?? row.monto ?? 0),
    currency,
    cat: title(row.category || row.cat || 'servicios'),
    active: Number(row.active ?? 1) === 1,
  };
}

async function upsertDebtFromPayload(env, payload) {
  const chatId = String(payload.chat_id || payload.chatId || env.DEFAULT_CHAT_ID || '').trim();
  if (!chatId) throw httpError(400, 'chat_id requerido');

  const debt = normalizeDebt(payload, chatId);
  if (!debt) throw httpError(400, 'Deuda invalida');
  const saved = await saveDebt(env, debt);

  return {
    ok: true,
    debt: debtShape(saved),
  };
}

async function upsertDebt(env, chatId, raw) {
  const debt = normalizeDebt(raw, chatId);
  if (!debt) return false;
  await saveDebt(env, debt);
  return true;
}

function normalizeDebt(raw, chatId) {
  const name = normalizeKey(raw.nombre || raw.name || '');
  const totalAmount = parseAmount(raw.total || raw.total_amount || raw.totalAmount || raw.monto || raw.amount || 0);
  const paidAmount = parseAmount(raw.pagado || raw.paid_amount || raw.paidAmount || 0);
  const rawCurrency = raw.currency ?? raw.moneda;
  const hasCurrency = rawCurrency !== undefined && rawCurrency !== null && String(rawCurrency).trim() !== '';
  const currency = hasCurrency ? normalizeCurrency(rawCurrency) : 'PEN';
  const dueDate = normalizeDateOnly(raw.vencimiento || raw.due_date || raw.dueDate || raw.fecha || '');
  const statusRaw = normalizeKey(raw.estado || raw.status || '');
  const status = statusRaw === 'pagada' || statusRaw === 'pagado' || paidAmount >= totalAmount
    ? 'pagada'
    : 'activa';
  const notes = String(raw.notas || raw.notes || '').trim().slice(0, 240);

  if (!name || totalAmount <= 0) return null;

  return {
    id: String(raw.id || `debt:${chatId}:${name}`).slice(0, 180),
    chat_id: chatId,
    name,
    total_amount: round(totalAmount),
    paid_amount: round(Math.min(Math.max(paidAmount, 0), totalAmount)),
    currency,
    has_currency: hasCurrency,
    due_date: dueDate,
    status,
    notes,
  };
}

async function saveDebt(env, debt) {
  await env.DB.prepare(`
    INSERT INTO debts (
      id, chat_id, name, total_amount, paid_amount, currency, due_date, status, notes, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(chat_id, name) DO UPDATE SET
      total_amount = excluded.total_amount,
      paid_amount = excluded.paid_amount,
      currency = CASE WHEN ? = 1 THEN excluded.currency ELSE debts.currency END,
      due_date = excluded.due_date,
      status = excluded.status,
      notes = excluded.notes,
      updated_at = CURRENT_TIMESTAMP
  `).bind(
    debt.id,
    debt.chat_id,
    debt.name,
    debt.total_amount,
    debt.paid_amount,
    debt.currency,
    debt.due_date || null,
    debt.status,
    debt.notes,
    debt.has_currency ? 1 : 0,
  ).run();

  return env.DB.prepare('SELECT * FROM debts WHERE id = ? AND chat_id = ?')
    .bind(debt.id, debt.chat_id)
    .first();
}

async function updateDebtFromDashboard(env, id, payload, params) {
  const chatId = String(params.get('chat_id') || payload.chat_id || payload.chatId || env.DEFAULT_CHAT_ID || '').trim();
  const cleanId = String(id || '').trim();
  if (!chatId) throw httpError(400, 'chat_id requerido');
  if (!cleanId) throw httpError(400, 'id requerido');

  const existing = await env.DB.prepare('SELECT * FROM debts WHERE id = ? AND chat_id = ?')
    .bind(cleanId, chatId)
    .first();
  if (!existing) throw httpError(404, 'Deuda no encontrada');

  const name = normalizeKey(payload.nombre ?? payload.name ?? existing.name);
  const totalAmount = parseAmount(payload.total ?? payload.total_amount ?? payload.totalAmount ?? existing.total_amount);
  const paidAmount = parseAmount(payload.pagado ?? payload.paid_amount ?? payload.paidAmount ?? existing.paid_amount);
  const currency = normalizeCurrency(payload.currency ?? existing.currency);
  const dueDate = normalizeDateOnly(payload.vencimiento ?? payload.due_date ?? payload.dueDate ?? existing.due_date ?? '');
  const notes = String(payload.notas ?? payload.notes ?? existing.notes ?? '').trim().slice(0, 240);
  const statusRaw = normalizeKey(payload.estado ?? payload.status ?? existing.status ?? '');
  const paid = round(Math.min(Math.max(paidAmount, 0), totalAmount));
  const status = statusRaw === 'pagada' || statusRaw === 'pagado' || paid >= totalAmount ? 'pagada' : 'activa';

  if (!name) throw httpError(400, 'nombre requerido');
  if (totalAmount <= 0) throw httpError(400, 'total invalido');

  const conflict = await env.DB.prepare('SELECT id FROM debts WHERE chat_id = ? AND lower(name) = lower(?) AND id <> ?')
    .bind(chatId, name, cleanId)
    .first();
  if (conflict) throw httpError(409, 'Ya existe otra deuda con ese nombre');

  try {
    await env.DB.prepare(`
      UPDATE debts
      SET name = ?,
          total_amount = ?,
          paid_amount = ?,
          currency = ?,
          due_date = ?,
          status = ?,
          notes = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND chat_id = ?
    `).bind(name, round(totalAmount), paid, currency, dueDate || null, status, notes, cleanId, chatId).run();
  } catch (error) {
    throw httpError(409, error?.message || 'No se pudo actualizar la deuda');
  }

  const saved = await env.DB.prepare('SELECT * FROM debts WHERE id = ? AND chat_id = ?')
    .bind(cleanId, chatId)
    .first();
  if (!saved) throw httpError(404, 'Deuda no encontrada despues de actualizar');
  return { ok: true, debt: debtShape(saved) };
}

async function deleteDebt(env, id, params) {
  const chatId = String(params.get('chat_id') || env.DEFAULT_CHAT_ID || '').trim();
  const cleanId = String(id || '').trim();
  if (!chatId) throw httpError(400, 'chat_id requerido');
  if (!cleanId) throw httpError(400, 'id requerido');

  const existing = await env.DB.prepare('SELECT id FROM debts WHERE id = ? AND chat_id = ?')
    .bind(cleanId, chatId)
    .first();
  if (!existing) throw httpError(404, 'Deuda no encontrada');

  await env.DB.prepare('DELETE FROM debt_payments WHERE debt_id = ? AND chat_id = ?')
    .bind(cleanId, chatId)
    .run();
  await env.DB.prepare('DELETE FROM debts WHERE id = ? AND chat_id = ?')
    .bind(cleanId, chatId)
    .run();

  return { ok: true, deleted: true, id: cleanId };
}

async function addDebtPayment(env, id, payload, params) {
  const chatId = String(params.get('chat_id') || payload.chat_id || payload.chatId || env.DEFAULT_CHAT_ID || '').trim();
  const cleanId = String(id || '').trim();
  if (!chatId) throw httpError(400, 'chat_id requerido');
  if (!cleanId) throw httpError(400, 'id requerido');

  const existing = await env.DB.prepare('SELECT * FROM debts WHERE id = ? AND chat_id = ?')
    .bind(cleanId, chatId)
    .first();
  if (!existing) throw httpError(404, 'Deuda no encontrada');

  const amount = parseAmount(payload.amount ?? payload.monto ?? 0);
  const currency = normalizeCurrency(payload.currency || existing.currency || 'PEN');
  const paymentDate = normalizeDateOnly(payload.paymentDate || payload.payment_date || payload.fecha || localDateKey(new Date())) || localDateKey(new Date());
  const notes = String(payload.notes || payload.notas || '').trim().slice(0, 200);

  if (amount <= 0) throw httpError(400, 'monto invalido');
  if (currency !== normalizeCurrency(existing.currency || 'PEN')) {
    throw httpError(400, `La deuda esta en ${existing.currency || 'PEN'}. Registra el pago en la misma moneda.`);
  }

  const currentPaid = Number(existing.paid_amount || 0);
  const totalAmount = Number(existing.total_amount || 0);
  const appliedAmount = round(Math.min(amount, Math.max(totalAmount - currentPaid, 0)));
  if (appliedAmount <= 0) throw httpError(400, 'La deuda ya esta pagada');

  const paymentId = String(payload.id || `debtpay:${cleanId}:${Date.now()}`).slice(0, 180);
  await env.DB.prepare(`
    INSERT INTO debt_payments (id, debt_id, chat_id, amount, currency, payment_date, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).bind(paymentId, cleanId, chatId, appliedAmount, currency, paymentDate, notes).run();

  const nextPaid = round(Math.min(totalAmount, currentPaid + appliedAmount));
  const nextStatus = nextPaid >= totalAmount ? 'pagada' : 'activa';
  await env.DB.prepare(`
    UPDATE debts
    SET paid_amount = ?,
        status = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND chat_id = ?
  `).bind(nextPaid, nextStatus, cleanId, chatId).run();

  let transaction = null;
  if (payload.record_transaction !== false && payload.recordTransaction !== false) {
    transaction = await insertDebtPaymentTransaction(env, {
      chatId,
      paymentId,
      debtName: existing.name,
      amount: appliedAmount,
      currency,
      paymentDate,
    });
  }

  const debt = await env.DB.prepare('SELECT * FROM debts WHERE id = ? AND chat_id = ?')
    .bind(cleanId, chatId)
    .first();
  const payment = await env.DB.prepare('SELECT * FROM debt_payments WHERE id = ?')
    .bind(paymentId)
    .first();

  return { ok: true, debt: debtShape(debt), payment: debtPaymentShape(payment), transaction: transaction ? txShape(transaction) : null };
}

async function insertDebtPaymentTransaction(env, { chatId, paymentId, debtName, amount, currency, paymentDate }) {
  const now = new Date();
  const tx = await normalizeTransaction(env, {
    id: `tx:${paymentId}`,
    chat_id: chatId,
    fecha: paymentDate || localDateKey(now),
    hora: localIso(now).slice(11, 16),
    tipo: 'gasto',
    desc: `Pago deuda ${title(debtName)}`,
    cat: 'deudas',
    monto: amount,
    currency,
    payment_method: 'debito',
    source: 'debt_payment',
  }, chatId);

  await upsertTransaction(env, tx);
  return tx;
}

async function cycleExpenseRows(env, chatId, cycle) {
  const rows = await env.DB.prepare(`
    SELECT description AS desc, category AS cat, amount, currency, source
    FROM transactions
    WHERE chat_id = ?
      AND type = 'gasto'
      AND tx_date BETWEEN ? AND ?
  `).bind(chatId, cycle.startKey, cycle.endKey).all();

  return rows.results || [];
}

async function budgetsRows(env, chatId) {
  const rows = await env.DB.prepare(`
    SELECT category AS cat, limit_amount AS limite
    FROM budgets
    WHERE chat_id = ?
  `).bind(chatId).all();

  return rows.results || [];
}

function categoriesFromExpenseRows(rows, rules, usdRate = 3.85) {
  const spending = {};
  for (const row of rows || []) {
    const cat = classifyCategoryFromLoadedRules(rules, row.cat, row.desc);
    spending[cat] = (spending[cat] || 0) + currencyToPen(Number(row.amount || 0), row.currency || 'PEN', usdRate);
  }

  return Object.keys(spending)
    .map((cat) => ({
      cat: title(cat),
      monto: round(spending[cat]),
      color: COLORS[cat] || COLORS.otro,
    }))
    .sort((a, b) => b.monto - a.monto || a.cat.localeCompare(b.cat));
}

function topLeaksFromExpenseRows(rows, rules, usdRate = 3.85) {
  const grouped = {};
  let total = 0;

  for (const row of rows || []) {
    const cat = classifyCategoryFromLoadedRules(rules, row.cat, row.desc);
    const source = normalizeKey(row.source || '');
    const descKey = normalizeKey(row.desc || '');
    if (cat === 'deudas' || source === 'debt_payment' || descKey.startsWith('fijo pagado')) continue;

    const amount = currencyToPen(Number(row.amount || 0), row.currency || 'PEN', usdRate);
    if (amount <= 0) continue;

    const label = leakLabel(row.desc, cat);
    const key = `${normalizeKey(label)}|${cat}`;
    if (!grouped[key]) {
      grouped[key] = {
        label,
        category: title(cat),
        amount: 0,
        count: 0,
      };
    }
    grouped[key].amount += amount;
    grouped[key].count += 1;
    total += amount;
  }

  return Object.values(grouped)
    .map((item) => {
      const sharePct = total > 0 ? round((item.amount / total) * 100) : 0;
      return {
        label: item.label,
        category: item.category,
        amount: round(item.amount),
        count: item.count,
        sharePct,
        reason: item.count > 1
          ? `${item.count} movimientos - ${sharePct}% del gasto variable`
          : `${sharePct}% del gasto variable`,
      };
    })
    .sort((a, b) => b.amount - a.amount || b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, 5);
}

function budgetsFromExpenseRows(rows, expenseRows, categoryRules, budgetRules, usdRate = 3.85) {
  const spending = {};
  for (const row of expenseRows || []) {
    const cat = classifyCategoryFromLoadedRules(categoryRules, row.cat, row.desc);
    spending[cat] = (spending[cat] || 0) + currencyToPen(Number(row.amount || 0), row.currency || 'PEN', usdRate);
  }

  return (rows || []).map((row) => ({
    cat: title(row.cat),
    limite: round(row.limite),
    gasto: round(budgetSpendWithRules(spending, row.cat, budgetRules)),
  })).sort((a, b) => b.gasto - a.gasto || a.cat.localeCompare(b.cat));
}

async function lastMonths(env, chatId, now, usdRate = 3.85) {
  const result = [];
  const current = parseDateKeyParts(localDateKey(now));
  const startMonth = dateKeyFromParts(current.year, current.monthIndex - 5, 1);
  const endMonth = dateKeyFromParts(current.year, current.monthIndex + 1, 0);
  const rows = await env.DB.prepare(`
    SELECT
      substr(tx_date, 1, 7) AS month_key,
      COALESCE(SUM(CASE WHEN type = 'ingreso' THEN CASE WHEN currency = 'USD' THEN amount * ? ELSE amount END ELSE 0 END), 0) AS ingresos,
      COALESCE(SUM(CASE WHEN type = 'gasto' THEN CASE WHEN currency = 'USD' THEN amount * ? ELSE amount END ELSE 0 END), 0) AS gastos
    FROM transactions
    WHERE chat_id = ?
      AND tx_date BETWEEN ? AND ?
    GROUP BY substr(tx_date, 1, 7)
  `).bind(usdRate, usdRate, chatId, startMonth, endMonth).all();
  const byMonth = {};
  for (const row of rows.results || []) {
    byMonth[row.month_key] = row;
  }

  for (let i = 5; i >= 0; i--) {
    const monthStart = dateKeyFromParts(current.year, current.monthIndex - i, 1);
    const monthKey = monthStart.slice(0, 7);
    const row = byMonth[monthKey] || {};

    result.push({
      mes: monthShortNameFromKey(monthStart),
      key: monthKey,
      label: monthLongNameFromKey(monthStart),
      ingresos: round(row?.ingresos || 0),
      gastos: round(row?.gastos || 0),
    });
  }

  return result;
}

async function categoriesWithSpending(env, chatId, cycle, usdRate = 3.85) {
  const rowsPromise = env.DB.prepare(`
    SELECT category AS cat, description AS desc, amount, currency
    FROM transactions
    WHERE chat_id = ?
      AND type = 'gasto'
      AND tx_date BETWEEN ? AND ?
  `).bind(chatId, cycle.startKey, cycle.endKey).all();

  const [rows, rules] = await Promise.all([
    rowsPromise,
    loadCategoryRules(env, chatId),
  ]);
  const spending = {};
  for (const row of rows.results || []) {
    const cat = classifyCategoryFromLoadedRules(rules, row.cat, row.desc);
    spending[cat] = (spending[cat] || 0) + currencyToPen(Number(row.amount || 0), row.currency || 'PEN', usdRate);
  }

  return Object.keys(spending)
    .map((cat) => ({
      cat: title(cat),
      monto: round(spending[cat]),
      color: COLORS[cat] || COLORS.otro,
    }))
    .sort((a, b) => b.monto - a.monto || a.cat.localeCompare(b.cat));
}

async function topLeaks(env, chatId, period, usdRate = 3.85) {
  const rowsPromise = env.DB.prepare(`
    SELECT description AS desc, category AS cat, amount, currency, source
    FROM transactions
    WHERE chat_id = ?
      AND type = 'gasto'
      AND tx_date BETWEEN ? AND ?
  `).bind(chatId, period.startKey, period.endKey).all();

  const [rows, rules] = await Promise.all([
    rowsPromise,
    loadCategoryRules(env, chatId),
  ]);
  const grouped = {};
  let total = 0;

  for (const row of rows.results || []) {
    const cat = classifyCategoryFromLoadedRules(rules, row.cat, row.desc);
    const source = normalizeKey(row.source || '');
    const descKey = normalizeKey(row.desc || '');
    if (cat === 'deudas' || source === 'debt_payment' || descKey.startsWith('fijo pagado')) continue;

    const amount = currencyToPen(Number(row.amount || 0), row.currency || 'PEN', usdRate);
    if (amount <= 0) continue;

    const label = leakLabel(row.desc, cat);
    const key = `${normalizeKey(label)}|${cat}`;
    if (!grouped[key]) {
      grouped[key] = {
        label,
        category: title(cat),
        amount: 0,
        count: 0,
      };
    }
    grouped[key].amount += amount;
    grouped[key].count += 1;
    total += amount;
  }

  return Object.values(grouped)
    .map((item) => {
      const sharePct = total > 0 ? round((item.amount / total) * 100) : 0;
      return {
        label: item.label,
        category: item.category,
        amount: round(item.amount),
        count: item.count,
        sharePct,
        reason: item.count > 1
          ? `${item.count} movimientos - ${sharePct}% del gasto variable`
          : `${sharePct}% del gasto variable`,
      };
    })
    .sort((a, b) => b.amount - a.amount || b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, 5);
}

function leakLabel(description, category) {
  if (normalizeCategory(category) === 'supermercado') return 'Supermercado';

  const raw = normalizeKey(description || '');
  const cleaned = raw
    .replace(/^(compra|consumo|pago|gasto|recibo|boleta|factura)\s+(en|de|por)?\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  const label = title(cleaned || category || 'gasto');
  return label.length > 54 ? `${label.slice(0, 51).trim()}...` : label;
}

async function budgetsWithSpending(env, chatId, cycle, usdRate = 3.85) {
  const rowsPromise = env.DB.prepare(`
    SELECT category AS cat, limit_amount AS limite
    FROM budgets
    WHERE chat_id = ?
  `).bind(chatId).all();

  const spendingRowsPromise = env.DB.prepare(`
    SELECT category AS cat, description AS desc, amount, currency
    FROM transactions
    WHERE chat_id = ?
      AND type = 'gasto'
      AND tx_date BETWEEN ? AND ?
  `).bind(chatId, cycle.startKey, cycle.endKey).all();

  const [rows, spendingRows, categoryRules, budgetRules] = await Promise.all([
    rowsPromise,
    spendingRowsPromise,
    loadCategoryRules(env, chatId),
    loadBudgetRules(env, chatId),
  ]);
  const spending = {};
  for (const row of spendingRows.results || []) {
    const cat = classifyCategoryFromLoadedRules(categoryRules, row.cat, row.desc);
    spending[cat] = (spending[cat] || 0) + currencyToPen(Number(row.amount || 0), row.currency || 'PEN', usdRate);
  }

  return (rows.results || []).map((row) => ({
    cat: title(row.cat),
    limite: round(row.limite),
    gasto: round(budgetSpendWithRules(spending, row.cat, budgetRules)),
  })).sort((a, b) => b.gasto - a.gasto || a.cat.localeCompare(b.cat));
}

async function fixedExpensesList(env, chatId, monthKey, usdRate = 3.85, cycle = null) {
  const startKey = cycle?.startKey || `${monthKey}-01`;
  const endKey = cycle?.endKey || `${monthKey}-31`;
  const rows = await env.DB.prepare(`
    SELECT
      f.id AS id,
      f.name AS nombre,
      f.amount AS monto,
      f.category AS cat,
      f.currency AS currency,
      s.status AS month_status,
      s.paid_date AS paid_date,
      EXISTS (
        SELECT 1
        FROM transactions t
        WHERE t.chat_id = f.chat_id
          AND t.type = 'gasto'
          AND t.tx_date BETWEEN ? AND ?
          AND lower(t.description) = lower(f.name)
      ) AS pagadoMes
    FROM fixed_expenses f
    LEFT JOIN fixed_expense_month_status s
      ON s.fixed_id = f.id
      AND s.chat_id = f.chat_id
      AND s.month_key = ?
    WHERE f.chat_id = ? AND f.active = 1
    ORDER BY f.name ASC
  `).bind(startKey, endKey, monthKey, chatId).all();

  return (rows.results || [])
    .map((row) => {
      const currency = normalizeCurrency(row.currency || 'PEN');
      const monto = round(row.monto);
      const monthStatus = normalizeKey(row.month_status || '');
      const paidByTransaction = Boolean(row.pagadoMes);
      const paidByStatus = monthStatus === 'pagado';
      const paid = paidByTransaction || paidByStatus;
      const skipped = !paid && monthStatus === 'saltado';
      return {
        id: row.id,
        nombre: title(row.nombre),
        monto,
        montoPen: round(currencyToPen(monto, currency, usdRate)),
        currency,
        cat: title(row.cat),
        color: COLORS[row.cat] || COLORS.otro,
        pagadoMes: paid,
        pagadoManual: paidByStatus,
        pagadoPorTransaccion: paidByTransaction,
        saltadoMes: skipped,
        estado: paid ? 'pagado' : skipped ? 'saltado' : 'pendiente',
        paidDate: row.paid_date || '',
      };
    })
    .sort((a, b) => b.montoPen - a.montoPen || a.nombre.localeCompare(b.nombre));
}

async function debtsList(env, chatId) {
  const rows = await env.DB.prepare(`
    SELECT id, name, total_amount, paid_amount, currency, due_date, status, notes
    FROM debts
    WHERE chat_id = ?
    ORDER BY
      CASE WHEN status = 'activa' THEN 0 ELSE 1 END,
      CASE WHEN due_date IS NULL OR due_date = '' THEN 1 ELSE 0 END,
      due_date ASC,
      total_amount - paid_amount DESC
  `).bind(chatId).all();

  const debts = rows.results || [];
  if (!debts.length) return [];

  const paymentsRows = await env.DB.prepare(`
    SELECT id, debt_id, chat_id, amount, currency, payment_date, notes, created_at
    FROM debt_payments
    WHERE chat_id = ?
    ORDER BY payment_date DESC, created_at DESC
  `).bind(chatId).all();

  const paymentsByDebt = {};
  for (const payment of paymentsRows.results || []) {
    const key = payment.debt_id;
    if (!paymentsByDebt[key]) paymentsByDebt[key] = [];
    paymentsByDebt[key].push(payment);
  }

  return debts.map((row) => debtShape({
    ...row,
    payments: paymentsByDebt[row.id] || [],
  }));
}

function debtShape(row) {
  const total = round(row.total_amount);
  const paid = round(row.paid_amount);
  const pending = round(Math.max(total - paid, 0));

  return {
    id: row.id,
    nombre: title(row.name),
    total: total,
    pagado: paid,
    pendiente: pending,
    currency: normalizeCurrency(row.currency || 'PEN'),
    vencimiento: row.due_date || '',
    estado: row.status || (pending > 0 ? 'activa' : 'pagada'),
    notas: row.notes || '',
    payments: (row.payments || []).map(debtPaymentShape),
  };
}

function debtPaymentShape(row) {
  return {
    id: row.id,
    debtId: row.debt_id || row.debtId || '',
    amount: round(row.amount),
    currency: normalizeCurrency(row.currency || 'PEN'),
    paymentDate: row.payment_date || row.paymentDate || '',
    notes: row.notes || '',
    createdAt: row.created_at || row.createdAt || '',
  };
}

async function investmentsList(env, params) {
  const chatId = getChatId(env, params);
  const rows = await env.DB.prepare(`
    SELECT id, name, kind, amount, current_value, currency, notes, active, created_at, updated_at
    FROM investments
    WHERE chat_id = ? AND active = 1
    ORDER BY current_value DESC, amount DESC, name ASC
  `).bind(chatId).all();

  return {
    ok: true,
    investments: (rows.results || []).map(investmentShape),
  };
}

async function upsertInvestmentFromDashboard(env, payload, params) {
  const chatId = String(params.get('chat_id') || payload.chat_id || payload.chatId || env.DEFAULT_CHAT_ID || '').trim();
  if (!chatId) throw httpError(400, 'chat_id requerido');

  const investment = normalizeInvestment(payload, chatId);
  if (!investment) throw httpError(400, 'Inversion invalida');

  await env.DB.prepare(`
    INSERT INTO investments (
      id, chat_id, name, kind, amount, current_value, currency, notes, active, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
    ON CONFLICT(chat_id, name) DO UPDATE SET
      kind = excluded.kind,
      amount = excluded.amount,
      current_value = excluded.current_value,
      currency = excluded.currency,
      notes = excluded.notes,
      active = 1,
      updated_at = CURRENT_TIMESTAMP
  `).bind(
    investment.id,
    investment.chat_id,
    investment.name,
    investment.kind,
    investment.amount,
    investment.current_value,
    investment.currency,
    investment.notes,
  ).run();

  const saved = await env.DB.prepare('SELECT * FROM investments WHERE chat_id = ? AND name = ?')
    .bind(chatId, investment.name)
    .first();
  return { ok: true, investment: investmentShape(saved) };
}

async function updateInvestmentFromDashboard(env, id, payload, params) {
  const chatId = String(params.get('chat_id') || payload.chat_id || payload.chatId || env.DEFAULT_CHAT_ID || '').trim();
  const cleanId = String(id || '').trim();
  if (!chatId) throw httpError(400, 'chat_id requerido');
  if (!cleanId) throw httpError(400, 'id requerido');

  const existing = await env.DB.prepare('SELECT * FROM investments WHERE id = ? AND chat_id = ? AND active = 1')
    .bind(cleanId, chatId)
    .first();
  if (!existing) throw httpError(404, 'Inversion no encontrada');

  const name = normalizeKey(payload.name ?? payload.nombre ?? existing.name);
  const kind = normalizeKey(payload.kind ?? payload.tipo ?? existing.kind ?? 'otro') || 'otro';
  const amount = parseAmount(payload.amount ?? payload.monto ?? existing.amount);
  const currentValue = parseAmount(payload.currentValue ?? payload.current_value ?? payload.valorActual ?? existing.current_value);
  const currency = normalizeCurrency(payload.currency ?? existing.currency);
  const notes = String(payload.notes ?? payload.notas ?? existing.notes ?? '').trim().slice(0, 240);
  if (!name) throw httpError(400, 'nombre requerido');
  if (amount < 0 || currentValue < 0) throw httpError(400, 'monto invalido');

  const conflict = await env.DB.prepare('SELECT id FROM investments WHERE chat_id = ? AND lower(name) = lower(?) AND id <> ? AND active = 1')
    .bind(chatId, name, cleanId)
    .first();
  if (conflict) throw httpError(409, 'Ya existe otra inversion con ese nombre');

  await env.DB.prepare(`
    UPDATE investments
    SET name = ?,
        kind = ?,
        amount = ?,
        current_value = ?,
        currency = ?,
        notes = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND chat_id = ?
  `).bind(name, kind, round(amount), round(currentValue), currency, notes, cleanId, chatId).run();

  const saved = await env.DB.prepare('SELECT * FROM investments WHERE id = ? AND chat_id = ?')
    .bind(cleanId, chatId)
    .first();
  return { ok: true, investment: investmentShape(saved) };
}

async function deleteInvestment(env, id, params) {
  const chatId = String(params.get('chat_id') || env.DEFAULT_CHAT_ID || '').trim();
  const cleanId = String(id || '').trim();
  if (!chatId) throw httpError(400, 'chat_id requerido');
  if (!cleanId) throw httpError(400, 'id requerido');

  await env.DB.prepare(`
    UPDATE investments
    SET active = 0, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND chat_id = ?
  `).bind(cleanId, chatId).run();

  return { ok: true, deleted: true, id: cleanId };
}

function normalizeInvestment(raw, chatId) {
  const name = normalizeKey(raw.name || raw.nombre || '');
  const kind = normalizeKey(raw.kind || raw.tipo || 'otro') || 'otro';
  const amount = parseAmount(raw.amount || raw.monto || 0);
  const currentValue = parseAmount(raw.currentValue ?? raw.current_value ?? raw.valorActual ?? amount);
  const currency = normalizeCurrency(raw.currency || raw.moneda || 'PEN');
  const notes = String(raw.notes || raw.notas || '').trim().slice(0, 240);
  if (!name) return null;
  if (amount < 0 || currentValue < 0) return null;

  return {
    id: String(raw.id || `investment:${chatId}:${name}`).slice(0, 180),
    chat_id: chatId,
    name,
    kind,
    amount: round(amount),
    current_value: round(currentValue),
    currency,
    notes,
  };
}

function investmentShape(row) {
  const amount = round(row.amount || 0);
  const currentValue = round(row.current_value || row.currentValue || 0);
  return {
    id: row.id,
    name: title(row.name),
    kind: title(row.kind || 'otro'),
    amount,
    currentValue,
    currency: normalizeCurrency(row.currency || 'PEN'),
    gain: round(currentValue - amount),
    gainPct: amount > 0 ? Math.round(((currentValue - amount) / amount) * 10000) / 100 : 0,
    notes: row.notes || '',
    updatedAt: row.updated_at || row.updatedAt || '',
  };
}

async function netWorth(env, params) {
  const chatId = getChatId(env, params);
  const rateInfo = await exchangeRate(env);
  const rate = Number(rateInfo.rate || 3.85);
  const cycle = payCycleFromDate(new Date());
  const monthKey = cycle.key;

  const cashRows = await env.DB.prepare(`
    SELECT type, amount, currency
    FROM transactions
    WHERE chat_id = ?
  `).bind(chatId).all();
  let incomePen = 0;
  let expensesPen = 0;
  for (const row of cashRows.results || []) {
    const amount = currencyToPen(Number(row.amount || 0), row.currency || 'PEN', rate);
    if (row.type === 'ingreso') incomePen += amount;
    if (row.type === 'gasto') expensesPen += amount;
  }

  const investments = (await investmentsList(env, params)).investments || [];
  const debts = await debtsList(env, chatId);
  const goals = await goalsList(env, chatId);
  const fixedExpenses = await fixedExpensesList(env, chatId, monthKey, rate, cycle);
  const fixedSummary = fixedExpensesSummary(fixedExpenses, rate);
  const cash = round(incomePen - expensesPen - fixedSummary.paid);

  const investmentValue = round(investments.reduce((total, item) => (
    total + currencyToPen(Number(item.currentValue || 0), item.currency || 'PEN', rate)
  ), 0));
  const investmentCost = round(investments.reduce((total, item) => (
    total + currencyToPen(Number(item.amount || 0), item.currency || 'PEN', rate)
  ), 0));
  const goalsSaved = round(goals.reduce((total, item) => total + Number(item.ahorrado || 0), 0));
  const debtPending = round(debts
    .filter((item) => item.estado !== 'pagada')
    .reduce((total, item) => total + currencyToPen(Number(item.pendiente || 0), item.currency || 'PEN', rate), 0));
  const fixedPending = fixedSummary.pending;
  const availableBalance = round(cash - debtPending - fixedPending);

  const assets = {
    cash,
    investments: investmentValue,
    goals: goalsSaved,
    total: round(cash + investmentValue + goalsSaved),
  };
  const liabilities = {
    debts: debtPending,
    fixedExpenses: fixedPending,
    total: round(debtPending + fixedPending),
  };
  const net = round(assets.total - liabilities.total);
  const debtToAssetsPct = assets.total > 0 ? round((liabilities.total / assets.total) * 100) : 0;
  const investmentSharePct = assets.total > 0 ? round((assets.investments / assets.total) * 100) : 0;
  const liquiditySharePct = assets.total > 0 ? round((assets.cash / assets.total) * 100) : 0;

  const snapshots = await netWorthSnapshots(env, chatId);

  return {
    ok: true,
    currency: 'PEN',
    exchangeRate: rate,
    exchangeRateSource: rateInfo.source || '',
    cycleStart: cycle.startKey,
    cycleEnd: cycle.endKey,
    cycleLabel: cycle.label,
    assets,
    liabilities,
    netWorth: net,
    availableBalance,
    patrimonioDisponible: availableBalance,
    investmentGain: round(investmentValue - investmentCost),
    ratios: {
      debtToAssetsPct,
      investmentSharePct,
      liquiditySharePct,
    },
    composition: [
      { label: 'Efectivo', value: assets.cash, type: 'asset' },
      { label: 'Inversiones', value: assets.investments, type: 'asset' },
      { label: 'Metas', value: assets.goals, type: 'asset' },
      { label: 'Deudas', value: liabilities.debts, type: 'liability' },
      { label: 'Fijos pendientes', value: liabilities.fixedExpenses, type: 'liability' },
    ],
    insights: netWorthInsights({ assets, liabilities, net, availableBalance, debtToAssetsPct, investmentSharePct, liquiditySharePct }),
    snapshots,
    updatedAt: localIso(new Date()),
  };
}

async function saveNetWorthSnapshot(env, params) {
  const chatId = getChatId(env, params);
  const data = await netWorth(env, params);
  const snapshotDate = localDateKey(new Date());
  const id = `networth:${chatId}:${snapshotDate}`;
  const details = JSON.stringify({
    assets: data.assets,
    liabilities: data.liabilities,
    availableBalance: data.availableBalance,
    patrimonioDisponible: data.patrimonioDisponible,
    ratios: data.ratios,
    composition: data.composition,
  });

  await env.DB.prepare(`
    INSERT INTO net_worth_snapshots (
      id, chat_id, snapshot_date, assets_total, liabilities_total, net_worth, exchange_rate, details, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(chat_id, snapshot_date) DO UPDATE SET
      assets_total = excluded.assets_total,
      liabilities_total = excluded.liabilities_total,
      net_worth = excluded.net_worth,
      exchange_rate = excluded.exchange_rate,
      details = excluded.details,
      updated_at = CURRENT_TIMESTAMP
  `).bind(
    id,
    chatId,
    snapshotDate,
    data.assets.total,
    data.liabilities.total,
    data.netWorth,
    data.exchangeRate,
    details,
  ).run();

  return {
    ok: true,
    snapshot: {
      id,
      date: snapshotDate,
      assetsTotal: data.assets.total,
      liabilitiesTotal: data.liabilities.total,
      netWorth: data.netWorth,
      exchangeRate: data.exchangeRate,
    },
  };
}

async function netWorthSnapshots(env, chatId) {
  const rows = await env.DB.prepare(`
    SELECT id, snapshot_date, assets_total, liabilities_total, net_worth, exchange_rate, updated_at
    FROM net_worth_snapshots
    WHERE chat_id = ?
    ORDER BY snapshot_date DESC
    LIMIT 12
  `).bind(chatId).all();

  return (rows.results || []).map((row) => ({
    id: row.id,
    date: row.snapshot_date,
    assetsTotal: round(row.assets_total || 0),
    liabilitiesTotal: round(row.liabilities_total || 0),
    netWorth: round(row.net_worth || 0),
    exchangeRate: round(row.exchange_rate || 3.85),
    updatedAt: row.updated_at || '',
  }));
}

async function exchangeRate(env) {
  const cacheKey = 'exchange_rate_usd_pen';
  const cached = await getAppSetting(env, cacheKey);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (parsed.rate > 0 && Date.now() - Number(parsed.timestamp || 0) < 6 * 60 * 60 * 1000) {
        return {
          ok: true,
          base: 'USD',
          target: 'PEN',
          rate: parsed.rate,
          updatedAt: parsed.updatedAt || '',
          source: parsed.source || 'cache',
        };
      }
    } catch {
      // Malformed cache should not break the dashboard.
    }
  }

  let rate = 3.85;
  let updatedAt = new Date().toISOString();
  let source = 'fallback';

  try {
    const response = await fetch('https://open.er-api.com/v6/latest/USD', {
      headers: { accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const nextRate = Number(data?.rates?.PEN);
    if (nextRate > 0) {
      rate = round(nextRate);
      updatedAt = data?.time_last_update_utc || updatedAt;
      source = 'open.er-api.com';
    }
  } catch (_error) {
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed.rate > 0) {
          return {
            ok: true,
            base: 'USD',
            target: 'PEN',
            rate: parsed.rate,
            updatedAt: parsed.updatedAt || '',
            source: `${parsed.source || 'cache'}:stale`,
          };
        }
      } catch {
        // Fall through to fallback value.
      }
    }
  }

  await setAppSetting(env, cacheKey, JSON.stringify({ rate, timestamp: Date.now(), updatedAt, source }));
  return { ok: true, base: 'USD', target: 'PEN', rate, updatedAt, source };
}

async function goalsList(env, chatId) {
  const rows = await env.DB.prepare(`
    SELECT name AS nombre, target_amount AS objetivo, saved_amount AS ahorrado
    FROM goals
    WHERE chat_id = ?
    ORDER BY created_at ASC
  `).bind(chatId).all();

  return (rows.results || []).map((row) => ({
    nombre: title(row.nombre),
    objetivo: round(row.objetivo),
    ahorrado: round(row.ahorrado),
  }));
}

async function normalizeTransaction(env, raw, chatId) {
  const fecha = String(raw.fecha || raw.tx_date || '').slice(0, 10);
  const hora = String(raw.hora || raw.tx_time || '00:00').slice(0, 5);
  const tipo = String(raw.tipo || raw.type || '').toLowerCase() === 'ingreso' ? 'ingreso' : 'gasto';
  const desc = String(raw.desc || raw.description || 'Sin descripcion').trim();
  const cat = (await classifyCategory(env, chatId, raw.cat || raw.category || 'otro', desc)).category;
  const monto = Math.abs(parseAmount(raw.monto ?? raw.amount ?? 0));
  const currency = normalizeCurrency(raw.currency || raw.moneda);
  const rawId = String(raw.id || '').trim();
  const paymentMethod = normalizePaymentMethod(raw.payment_method || raw.paymentMethod || raw.metodo_pago || raw.metodoPago) || 'debito';
  const paymentDueDate = paymentMethod === 'credito'
    ? normalizeDateOnly(raw.payment_due_date || raw.paymentDueDate || raw.fecha_pago || raw.fechaPago)
    : '';
  const cardName = paymentMethod === 'credito'
    ? String(raw.card_name || raw.cardName || raw.tarjeta || '').trim().slice(0, 80)
    : '';

  if (!fecha || monto <= 0) {
    throw httpError(400, 'Transaccion invalida');
  }

  return {
    id: stableTransactionId({
      rawId,
      chatId,
      fecha,
      hora,
      tipo,
      cat,
      monto,
      currency,
      desc,
    }),
    chat_id: chatId,
    fecha,
    hora,
    tipo,
    desc,
    cat,
    monto: round(monto),
    currency,
    payment_method: paymentMethod,
    payment_due_date: paymentDueDate,
    card_name: cardName,
    source: String(raw.source || 'gas').slice(0, 40),
  };
}

function txShape(row) {
  return {
    id: row.id,
    fecha: row.fecha,
    hora: row.hora,
    tipo: row.tipo,
    desc: row.desc,
    cat: normalizeCategory(row.cat, row.desc),
    monto: round(row.monto),
    currency: normalizeCurrency(row.currency),
    paymentMethod: row.payment_method || 'debito',
    paymentDueDate: row.payment_due_date || '',
    cardName: row.card_name || '',
    receipt: row.receipt_id ? {
      id: row.receipt_id,
      fileName: row.receipt_file_name || 'recibo',
      contentType: row.receipt_content_type || 'image/jpeg',
      size: Number(row.receipt_size || 0),
      uploadedAt: row.receipt_uploaded_at || '',
    } : undefined,
  };
}
