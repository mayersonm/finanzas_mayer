import { safeJsonParse } from '../../shared/http.js';
import { getChatId } from '../../shared/request.js';
import { round, currencyToPen } from '../../shared/money.js';
import { clamp, normalizeDateOnly, normalizeMonthKey } from '../../shared/normalizers.js';
import { dateFromKey, dateKeyFromParts, localDateKey, localIso, monthLongNameFromKey, parseDateKeyParts, payCycleFromDate, payCycleRelative } from '../../shared/dates.js';
import { budgetRulesForDashboard, loadBudgetRules, loadCategoryRules } from '../../shared/categories.js';
import { ensureUserForChat, getUserSettings, normalizeSettingsConfig, userSettingsToConfig, usersList } from '../settings/service.js';
import { budgetSummary, closureRuleSuggestion, fixedExpensesSummary, freeMoneyPlan, monthlyCalendar, realExpenses, smartAlerts, smartInsights, weeklyGoalPlan } from './planning.js';
import { automationCenter } from './automation.js';
import { advisorResponse } from '../ai/advisor.js';
import { exchangeRate } from '../system/exchange-rate.js';
import { computeCashBalance, loadSalaryDates, txShape } from '../transactions/service.js';
import { budgetsRows } from '../budgeting/service.js';
import { cycleExpenseRows, categoriesFromExpenseRows, topLeaksFromExpenseRows, budgetsFromExpenseRows, lastMonths } from './analytics.js';
import { fixedExpensesList } from '../commitments/fixed-expenses.js';
import { debtsList } from '../commitments/debts.js';
import { goalsList } from '../goals/service.js';
import { emailConfigFromGas } from '../sync/service.js';
import { currentFinancialClosure, closureNextCycleShape } from '../closures/service.js';

export async function calendarOnly(env, params) {
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

export async function bootstrap(env, params) {
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

export async function aiAdvisor(env, params, payload) {
  const dashboardData = await dashboard(env, params);
  const chatId = getChatId(env, params);
  const user = await ensureUserForChat(env, chatId);
  const settings = normalizeSettingsConfig(userSettingsToConfig(await getUserSettings(env, user.id)));

  return advisorResponse(env, dashboardData, settings, payload);
}

// El ciclo se ancla al SUELDO, no al dia 22: empieza el dia que se registra el
// sueldo. Las transacciones anteriores al sueldo quedan en el ciclo anterior.
// El 22 sigue siendo la malla nominal (mes contable y fallback sin sueldos).
export async function resolveCurrentCycle(env, chatId, now) {
  const today = localDateKey(now);
  const dateCycle = payCycleFromDate(now);
  const salaryDates = await loadSalaryDates(env, chatId, today);
  // Sin sueldos registrados -> malla 22->22 de siempre.
  if (!salaryDates.length) return dateCycle;

  const startKey = salaryDates[0]; // ultimo sueldo <= hoy: abre el ciclo actual.
  // Si el ultimo sueldo es anterior al corte nominal, todavia no cobramos el
  // ciclo nuevo: seguimos en el anterior, extendido hasta hoy.
  const awaitingSalary = startKey < dateCycle.startKey;
  const endKey = awaitingSalary ? today : dateCycle.endKey;
  const key = (awaitingSalary ? payCycleRelative(dateCycle, -1) : dateCycle).key;
  return {
    ...dateCycle,
    startKey,
    endKey,
    key,
    rangeLabel: `${startKey.slice(8, 10)}/${startKey.slice(5, 7)}/${startKey.slice(0, 4)} - ${endKey.slice(8, 10)}/${endKey.slice(5, 7)}/${endKey.slice(0, 4)}`,
    awaitingSalary,
  };
}

export async function dashboard(env, params) {
  const chatId = getChatId(env, params);
  const now = new Date();
  const requestedCycleStart = normalizeDateOnly(params.get('cycle_start') || params.get('cycleStart') || '');
  const requestedCalendarMonth = normalizeMonthKey(params.get('calendar_month') || params.get('calendarMonth') || '');
  const rateInfo = await exchangeRate(env);
  const usdRate = Number(rateInfo.rate || 3.85);
  const user = await ensureUserForChat(env, chatId);
  const settings = normalizeSettingsConfig(userSettingsToConfig(await getUserSettings(env, user.id)));
  const cycleIncomeLeadDays = clamp(Number(settings.cycleIncomeLeadDays ?? 0), 0, 7);
  // El ciclo no salta al siguiente solo por la fecha de corte: espera a que se
  // registre el sueldo del nuevo ciclo (ver resolveCurrentCycle).
  const cycle = requestedCycleStart
    ? payCycleFromDate(dateFromKey(requestedCycleStart))
    : await resolveCurrentCycle(env, chatId, now);
  const monthKey = cycle.key;
  const calendarMonth = cycle;
  const cycleKey = monthKey;
  const awaitingSalary = Boolean(cycle.awaitingSalary);
  const monthName = monthLongNameFromKey(localDateKey(now));
  const cycleStartParts = parseDateKeyParts(calendarMonth.startKey);
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
  // Deudas que vencen dentro del ciclo actual (las que conviene reservar de la
  // caja para el calculo de dinero libre). Las que no tienen vencimiento no se
  // fuerzan a reservar este ciclo.
  const deudaVenceCiclo = round(debts
    .filter((item) => item.estado !== 'pagada'
      && item.vencimiento
      && item.vencimiento >= calendarMonth.startKey
      && item.vencimiento <= calendarMonth.endKey)
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

  // Si se cerro caja, la caja parte del saldo de apertura anclado y solo suma
  // el neto de lo registrado despues del cierre. Si no, usa el acumulado total.
  const cashResult = await computeCashBalance(env, chatId, usdRate, { ingresos, gastos, fixedPaid: fixedSummary.paid });
  const balanceCaja = cashResult.balance;
  const cashOpening = cashResult.opening;

  // Si entro un sueldo despues del ultimo ancla de caja, el ciclo nuevo arranca
  // ahi: se pide confirmar el saldo real para anclar la caja (sueldo abre el
  // ciclo, el usuario reconcilia con el banco). created_at compara contra el at
  // del ancla (mismo formato 'YYYY-MM-DD HH:MM:SS').
  const lastSalaryRow = await env.DB.prepare(`
    SELECT tx_date, amount, currency, created_at
    FROM transactions
    WHERE chat_id = ? AND type = 'ingreso' AND category = 'salario'
    ORDER BY created_at DESC
    LIMIT 1
  `).bind(chatId).first();
  const cashAnchorPending = Boolean(lastSalaryRow && (!cashOpening || String(lastSalaryRow.created_at) > String(cashOpening.at)));
  const pendingSalary = cashAnchorPending && lastSalaryRow
    ? { date: lastSalaryRow.tx_date, amount: round(currencyToPen(Number(lastSalaryRow.amount || 0), lastSalaryRow.currency || 'PEN', usdRate)) }
    : null;

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
    debtDueCycle: deudaVenceCiclo,
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
    cashOpening,
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
    awaitingSalary,
    cashAnchorPending,
    pendingSalary,
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
