
import { round, currencyToPen, formatCurrency } from '../../shared/money.js';
import { clamp, normalizeCurrency, normalizeInvestorProfile, normalizeInvestmentHorizon, normalizeKey, title } from '../../shared/normalizers.js';
import { dateFromKey, dateInRange, dateKeyFromParts, daysBetween, localDateKey, monthRangeFromKey, nextFinancialClose, parseDateKeyParts, payCycleFromDate, weekRangeFromDate } from '../../shared/dates.js';

export function netWorthInsights({ assets, liabilities, net, availableBalance, debtToAssetsPct, investmentSharePct, liquiditySharePct }) {
  const insights = [];
  if (availableBalance < 0) {
    insights.push({ level: 'warning', title: 'Patrimonio disponible negativo', message: `Despues de deudas y fijos pendientes, quedas en ${formatCurrency(availableBalance, 'PEN')}.` });
  } else {
    insights.push({ level: 'success', title: 'Patrimonio disponible', message: `Despues de deudas y fijos pendientes, te queda ${formatCurrency(availableBalance, 'PEN')}.` });
  }
  if (net < 0) {
    insights.push({ level: 'danger', title: 'Patrimonio negativo', message: 'Tus deudas y fijos pendientes superan tus activos. Prioriza reducir compromisos o aumentar liquidez.' });
  } else {
    insights.push({ level: 'success', title: 'Patrimonio total positivo', message: `Sumando inversiones y metas, tu patrimonio total es ${formatCurrency(net, 'PEN')}.` });
  }
  if (debtToAssetsPct >= 50) {
    insights.push({ level: 'warning', title: 'Pasivos altos frente a activos', message: `Tus deudas y fijos pendientes equivalen al ${debtToAssetsPct.toFixed(1)}% de tus activos.` });
  }
  if (liabilities.fixedExpenses > 0 && assets.cash > 0) {
    const fixedCashPct = round((liabilities.fixedExpenses / assets.cash) * 100);
    insights.push({ level: fixedCashPct >= 50 ? 'warning' : 'info', title: 'Fijos pendientes del mes', message: `Tienes ${formatCurrency(liabilities.fixedExpenses, 'PEN')} por cubrir, equivalente al ${fixedCashPct.toFixed(1)}% de tu efectivo.` });
  }
  if (investmentSharePct < 10 && assets.total > 0) {
    insights.push({ level: 'info', title: 'Poca exposicion a inversiones', message: `Las inversiones representan ${investmentSharePct.toFixed(1)}% de tus activos.` });
  }
  if (liquiditySharePct > 70 && assets.total > 0 && assets.cash > liabilities.total) {
    insights.push({ level: 'info', title: 'Alta liquidez', message: 'Tienes bastante efectivo frente al resto de activos. Puede ser intencional o una oportunidad para metas.' });
  }
  if (liabilities.total === 0 && assets.total > 0) {
    insights.push({ level: 'success', title: 'Sin deuda registrada', message: 'No tienes pasivos activos en el sistema.' });
  }
  return insights.slice(0, 4);
}

export function realExpenses(fixedExpenses, budgets, usdRate = 3.85) {
  const fixedSummary = fixedExpensesSummary(fixedExpenses, usdRate);
  const totalPresupuesto = budgets.reduce((total, item) => {
    const spent = Number(item.gasto || 0);
    const limit = Number(item.limite || 0);
    return total + (spent > 0 ? spent : limit);
  }, 0);

  return {
    totalFijos: fixedSummary.pending,
    totalFijosPendientes: fixedSummary.pending,
    totalFijosPagados: fixedSummary.paid,
    totalFijosSaltados: fixedSummary.skipped,
    totalPresupuesto: round(totalPresupuesto),
    total: round(fixedSummary.pending + totalPresupuesto),
    regla: 'pending_fixed_plus_budget_spent_or_limit',
  };
}

export function budgetSummary(budgets) {
  const summary = (budgets || []).reduce((acc, item) => {
    const spent = Number(item.gasto || 0);
    const limit = Number(item.limite || 0);
    acc.limit += limit;
    acc.spent += spent;
    acc.remaining += Math.max(limit - spent, 0);
    acc.over += Math.max(spent - limit, 0);
    return acc;
  }, { limit: 0, spent: 0, remaining: 0, over: 0 });

  return {
    limit: round(summary.limit),
    spent: round(summary.spent),
    remaining: round(summary.remaining),
    over: round(summary.over),
  };
}

export function fixedExpensesSummary(fixedExpenses, usdRate = 3.85) {
  const summary = (fixedExpenses || []).reduce((acc, item) => {
    const value = Number(item.montoPen ?? currencyToPen(Number(item.monto || 0), item.currency || 'PEN', usdRate)) || 0;
    if (item.estado === 'pendiente') acc.pending += value;
    if (item.estado === 'saltado') acc.skipped += value;
    if (item.estado === 'pagado' && item.pagadoManual && !item.pagadoPorTransaccion) acc.paid += value;
    return acc;
  }, { pending: 0, paid: 0, skipped: 0 });

  return {
    pending: round(summary.pending),
    paid: round(summary.paid),
    skipped: round(summary.skipped),
  };
}

export function freeMoneyPlan({ now, settings, cierre, budget, fixedSummary, deudaPendiente, debtDueCycle = 0, goals = [], cashBalance, patrimonioDisponible, ingresosMes, gastosMes }) {
  const close = nextFinancialClose(now);
  const daysLeft = close.daysLeft;
  const income = round(ingresosMes || 0);
  const spent = round(gastosMes || 0);
  const fixedPending = round(fixedSummary?.pending || 0);
  const debtPending = round(deudaPendiente || 0);
  // Deudas que vencen dentro de este ciclo: son las que de verdad hay que
  // reservar de la caja (la deuda total puede repartirse en varios ciclos).
  const debtDue = round(Math.max(0, Number(debtDueCycle || 0)));
  const cash = round(Number.isFinite(Number(cashBalance)) ? Number(cashBalance) : Number(cierre?.balance || 0));
  const availableBase = cash;
  const baseBalance = cash;
  const configuredSavingsGoal = round(Math.max(0, Number(settings.savingsTargetAmount || 0)));
  const actualSavings = round((goals || []).reduce((total, item) => total + Number(item.ahorrado || 0), 0));
  const emergencyBuffer = round(Math.max(0, Number(settings.emergencyBufferAmount || 0)));
  const budgetLimit = round(budget?.limit || 0);
  const budgetRemaining = round(Math.max(0, budget?.remaining || 0));
  const hasBudget = budgetLimit > 0;
  const savingsTarget = actualSavings;
  // Obligaciones del ciclo que se descuentan antes del gasto variable, para que
  // "puedes gastar" no incluya plata que ya tiene dueño (fijos y deudas).
  const committedObligations = round(fixedPending + debtDue);
  const commitments = round(savingsTarget + emergencyBuffer);
  const freeAfterCommitments = round(availableBase - savingsTarget - emergencyBuffer - committedObligations);
  const variableReserve = hasBudget ? budgetRemaining : Math.max(0, freeAfterCommitments);
  const availableToSpend = round(Math.max(0, hasBudget ? Math.min(freeAfterCommitments, variableReserve) : freeAfterCommitments));
  const roomAfterPlannedSpend = hasBudget
    ? Math.max(0, freeAfterCommitments - budgetRemaining)
    : Math.max(0, freeAfterCommitments * 0.25);
  const suggestedSavingsGoal = configuredSavingsGoal > 0 ? configuredSavingsGoal : roomAfterPlannedSpend;
  const recommendedSavings = round(Math.min(Math.max(0, suggestedSavingsGoal), roomAfterPlannedSpend));
  const extraAfterPlan = round(Math.max(0, freeAfterCommitments - availableToSpend - recommendedSavings));
  const dailyNormal = round(availableToSpend / daysLeft);
  const dailySafe = round(dailyNormal * 0.7);
  const dailyFlexible = round(Math.min(availableToSpend, dailyNormal * 1.35));
  const requiredDailySavings = round(recommendedSavings / daysLeft);
  const investableNow = extraAfterPlan;
  const status = freeAfterCommitments < 0
    ? 'danger'
    : dailyNormal <= 0
      ? 'warning'
      : dailyNormal < 25
        ? 'tight'
        : 'healthy';
  const statusLabel = {
    danger: 'Plan en rojo',
    warning: 'Sin margen libre',
    tight: 'Margen ajustado',
    healthy: 'Plan sano',
  }[status];
  const actions = freeMoneyActions({
    actualSavings,
    configuredSavingsGoal,
    recommendedSavings,
    emergencyBuffer,
    fixedPending,
    debtPending,
    committedObligations,
    freeAfterCommitments,
    dailyNormal,
    budgetLimit,
    investableNow,
  });

  return {
    status,
    statusLabel,
    closeDate: close.closeDate,
    closeLabel: `Cierre ${close.closeDate.slice(8, 10)}/${close.closeDate.slice(5, 7)}`,
    daysLeft,
    income,
    spent,
    baseBalance,
    commitments,
    fixedPending,
    debtPending,
    debtDueCycle: debtDue,
    committedObligations,
    savingsTarget,
    actualSavings,
    configuredSavingsGoal,
    savingsConfigured: actualSavings > 0,
    recommendedSavings,
    emergencyBuffer,
    budgetLimit,
    budgetRemaining,
    variableReserve,
    freeAfterCommitments,
    availableToSpend,
    daily: {
      safe: dailySafe,
      normal: dailyNormal,
      flexible: dailyFlexible,
      requiredSavings: requiredDailySavings,
    },
    purchaseLimits: {
      green: dailyNormal,
      amber: dailyFlexible,
      hard: availableToSpend,
    },
    investment: investmentSuggestion({
      amount: investableNow,
      profile: settings.investorProfile,
      horizon: settings.investmentHorizon,
      emergencyBuffer,
      freeAfterCommitments,
      debtPending,
      actualSavings,
      recommendedSavings,
    }),
    actions,
  };
}

export async function closureRuleSuggestion(env, chatId, now, cycle, plan, deps = {}) {
  const today = localDateKey(now || new Date());
  const todayParts = parseDateKeyParts(today);
  // El cierre no se sugiere/activa mientras el ciclo siga esperando el sueldo
  // nuevo (ver resolveCurrentCycle): la fecha 22 es solo la malla nominal.
  // targetCycle SIEMPRE es el ciclo anclado que llega (cycle) - nunca se
  // reconstruye desde la malla 22 fija, o el cierre calcularia ingresos/gastos
  // con el rango equivocado (ej. deja fuera o duplica el sueldo real).
  const awaitingSalary = Boolean(cycle.awaitingSalary);
  const isCloseDay = !awaitingSalary && todayParts.day === 22;
  const targetCycle = cycle;
  const daysToClose = isCloseDay ? 0 : daysBetween(today, targetCycle.closeDate);
  const isSoon = !awaitingSalary && !isCloseDay && daysToClose >= 0 && daysToClose <= 3;
  const findClosure = deps.currentFinancialClosure;
  const saved = findClosure ? await findClosure(env, chatId, targetCycle.key) : null;
  const suggestedSavings = round(Math.max(0, Number(plan?.recommendedSavings || 0)));
  const active = !awaitingSalary && (isCloseDay || isSoon) && !saved;
  const status = saved
    ? 'closed'
    : awaitingSalary
      ? 'awaiting_salary'
      : isCloseDay
        ? 'due'
        : isSoon
          ? 'soon'
          : 'waiting';
  const titleText = saved
    ? 'Ciclo ya cerrado'
    : awaitingSalary
      ? 'Cierre en pausa: falta tu sueldo'
      : isCloseDay
        ? 'Cierre de ciclo listo'
        : isSoon
          ? 'Cierre de ciclo cercano'
          : 'Cierre programado';
  const message = saved
    ? `El ciclo ${targetCycle.rangeLabel} ya tiene cierre guardado.`
    : awaitingSalary
      ? `El ciclo ${cycle.rangeLabel} sigue abierto hasta que registres el sueldo del ciclo nuevo.`
      : active
        ? 'Cerrar ciclo, separar ahorro sugerido y reiniciar presupuesto.'
        : `Faltan ${Math.max(daysToClose, 0)} dia${Math.max(daysToClose, 0) === 1 ? '' : 's'} para el cierre ${targetCycle.closeDate.slice(8, 10)}/${targetCycle.closeDate.slice(5, 7)}.`;

  return {
    status,
    active,
    title: titleText,
    message,
    closeDate: targetCycle.closeDate,
    daysToClose: Math.max(daysToClose, 0),
    targetCycleKey: targetCycle.key,
    targetCycleStart: targetCycle.startKey,
    targetCycleEnd: targetCycle.endKey,
    targetCycleRange: targetCycle.rangeLabel,
    suggestedSavings,
    availableToSpend: round(plan?.availableToSpend || 0),
    saved: Boolean(saved),
    savedAt: saved?.updated_at || '',
    action: active ? 'save_closure' : 'watch',
  };
}

export async function weeklyGoalPlan(env, chatId, now, cycle, plan, usdRate = 3.85) {
  const today = localDateKey(now || new Date());
  const range = weekRangeFromDate(today, cycle);
  const row = await env.DB.prepare(`
    SELECT COALESCE(SUM(CASE WHEN currency = 'USD' THEN amount * ? ELSE amount END), 0) AS spent
    FROM transactions
    WHERE chat_id = ?
      AND type = 'gasto'
      AND tx_date BETWEEN ? AND ?
      AND COALESCE(source, '') <> 'debt_payment'
      AND lower(description) NOT LIKE 'fijo pagado%'
  `).bind(usdRate, chatId, range.startKey, range.endKey).first();

  const spent = round(row?.spent || 0);
  const daysInWeek = Math.max(1, daysBetween(range.startKey, range.endKey) + 1);
  const daysLeft = Math.max(1, daysBetween(today, range.endKey) + 1);
  const dailyNormal = round(Math.max(0, Number(plan?.daily?.normal || 0)));
  const target = round(Math.max(0, dailyNormal * daysInWeek));
  const remaining = round(Math.max(target - spent, 0));
  const over = round(Math.max(spent - target, 0));
  const dailyRemaining = round(remaining / daysLeft);
  const progressPct = target > 0 ? clamp(Math.round((spent / target) * 100), 0, 150) : 0;
  const status = target <= 0
    ? 'empty'
    : over > 0
      ? 'over'
      : progressPct >= 85
        ? 'tight'
        : 'ok';

  return {
    status,
    label: 'Objetivo semanal',
    range: `${range.startKey.slice(8, 10)}/${range.startKey.slice(5, 7)} - ${range.endKey.slice(8, 10)}/${range.endKey.slice(5, 7)}`,
    start: range.startKey,
    end: range.endKey,
    daysLeft,
    target,
    spent,
    remaining,
    over,
    dailyRemaining,
    progressPct: Math.min(progressPct, 100),
    message: weeklyGoalMessage(status, remaining, over, dailyRemaining),
  };
}

export function weeklyGoalMessage(status, remaining, over, dailyRemaining) {
  if (status === 'empty') return 'Configura presupuestos o espera nuevo ingreso para calcular la semana.';
  if (status === 'over') return `Esta semana ya excediste el objetivo por ${formatCurrency(over, 'PEN')}. Baja el ritmo hasta el cierre.`;
  if (status === 'tight') return `Queda poco margen semanal: ${formatCurrency(remaining, 'PEN')} en total.`;
  return `Puedes gastar hasta ${formatCurrency(dailyRemaining, 'PEN')} por dia esta semana.`;
}

export async function monthlyCalendar(env, chatId, now, cycle, fixedExpenses, debts, alerts, weeklyGoal, usdRate = 3.85, requestedMonthKey = '', deps = {}) {
  const month = monthRangeFromKey(requestedMonthKey || localDateKey(now).slice(0, 7));
  const today = localDateKey(now);
  const events = [];
  const monthCloseParts = parseDateKeyParts(month.closeDate);
  const monthCycle = payCycleFromDate(dateFromKey(dateKeyFromParts(monthCloseParts.year, monthCloseParts.monthIndex, 22)));
  const loadFixedExpenses = deps.fixedExpensesList;
  const calendarFixedExpenses = month.key === cycle.closeKey && (fixedExpenses || []).length
    ? fixedExpenses
    : loadFixedExpenses
      ? await loadFixedExpenses(env, chatId, monthCycle.key, usdRate, monthCycle)
      : [];

  if (dateInRange(monthCycle.closeDate, month.startKey, month.endKey)) {
    events.push(calendarEvent({
      date: monthCycle.closeDate,
      type: 'cierre',
      title: `Cierre ${monthCycle.closeDate.slice(8, 10)}/${monthCycle.closeDate.slice(5, 7)}`,
      description: 'Cerrar ciclo, separar ahorro sugerido y reiniciar presupuesto.',
      priority: 'high',
    }));
  }

  if (weeklyGoal?.end && dateInRange(weeklyGoal.end, month.startKey, month.endKey)) {
    events.push(calendarEvent({
      date: weeklyGoal.end,
      type: 'objetivo',
      title: 'Objetivo semanal',
      description: weeklyGoal.message,
      amount: weeklyGoal.remaining,
      currency: 'PEN',
      priority: weeklyGoal.status === 'over' ? 'high' : weeklyGoal.status === 'tight' ? 'medium' : 'normal',
    }));
  }

  for (const item of calendarFixedExpenses || []) {
    const date = item.estado === 'pagado' && item.paidDate ? item.paidDate : monthCycle.closeDate;
    if (!dateInRange(date, month.startKey, month.endKey)) continue;
    events.push(calendarEvent({
      date,
      type: 'fijo',
      title: `${item.estado === 'pagado' ? 'Fijo pagado' : 'Fijo pendiente'}: ${item.nombre}`,
      description: item.cat || 'Gasto fijo',
      amount: item.monto,
      currency: item.currency || 'PEN',
      priority: item.estado === 'pendiente' ? 'medium' : 'normal',
    }));
  }

  for (const item of debts || []) {
    if (item.estado === 'pagada' || !item.vencimiento) continue;
    if (!dateInRange(item.vencimiento, month.startKey, month.endKey)) continue;
    events.push(calendarEvent({
      date: item.vencimiento,
      type: 'deuda',
      title: `Deuda: ${item.nombre}`,
      description: 'Vencimiento de deuda',
      amount: item.pendiente,
      currency: item.currency || 'PEN',
      priority: daysBetween(today, item.vencimiento) <= 7 ? 'high' : 'medium',
    }));
  }

  const creditRows = await env.DB.prepare(`
    SELECT description, amount, currency, payment_due_date, card_name
    FROM transactions
    WHERE chat_id = ?
      AND type = 'gasto'
      AND payment_method = 'credito'
      AND payment_due_date BETWEEN ? AND ?
    ORDER BY payment_due_date ASC, amount DESC
  `).bind(chatId, month.startKey, month.endKey).all();

  for (const row of creditRows.results || []) {
    events.push(calendarEvent({
      date: row.payment_due_date,
      type: 'credito',
      title: `Credito: ${title(row.description)}`,
      description: row.card_name ? `Tarjeta ${row.card_name}` : 'Pago de tarjeta',
      amount: row.amount,
      currency: row.currency || 'PEN',
      priority: daysBetween(today, row.payment_due_date) <= 5 ? 'high' : 'normal',
      amountPen: currencyToPen(Number(row.amount || 0), row.currency || 'PEN', usdRate),
    }));
  }

  for (const alert of (alerts || []).slice(0, 4)) {
    events.push(calendarEvent({
      date: today,
      type: 'alerta',
      title: alert.title,
      description: alert.message,
      priority: alert.level === 'danger' || alert.level === 'warning' ? 'high' : 'normal',
    }));
  }

  const dailyRows = await env.DB.prepare(`
    SELECT
      tx_date AS date,
      COALESCE(SUM(CASE WHEN type = 'gasto' THEN CASE WHEN currency = 'USD' THEN amount * ? ELSE amount END ELSE 0 END), 0) AS gastos,
      COALESCE(SUM(CASE WHEN type = 'ingreso' THEN CASE WHEN currency = 'USD' THEN amount * ? ELSE amount END ELSE 0 END), 0) AS ingresos,
      COUNT(*) AS movimientos
    FROM transactions
    WHERE chat_id = ?
      AND tx_date BETWEEN ? AND ?
    GROUP BY tx_date
    ORDER BY tx_date ASC
  `).bind(usdRate, usdRate, chatId, month.startKey, month.endKey).all();
  const dailyTotals = (dailyRows.results || []).map((row) => ({
    date: row.date,
    gastos: round(row.gastos || 0),
    ingresos: round(row.ingresos || 0),
    movimientos: Number(row.movimientos || 0),
  }));

  const sortedEvents = events.sort((a, b) => {
    return a.date.localeCompare(b.date) || priorityRank(b.priority) - priorityRank(a.priority) || a.title.localeCompare(b.title);
  });

  return {
    monthKey: month.key,
    label: month.label,
    start: month.startKey,
    end: month.endKey,
    today,
    cycleStart: monthCycle.startKey,
    cycleEnd: monthCycle.endKey,
    cycleClose: monthCycle.closeDate,
    cycleRange: monthCycle.rangeLabel,
    events: sortedEvents,
    dailyTotals,
    summary: {
      fijos: sortedEvents.filter((item) => item.type === 'fijo').length,
      deudas: sortedEvents.filter((item) => item.type === 'deuda').length,
      credito: sortedEvents.filter((item) => item.type === 'credito').length,
      alertas: sortedEvents.filter((item) => item.type === 'alerta').length,
      gastos: round(dailyTotals.reduce((total, item) => total + Number(item.gastos || 0), 0)),
    },
  };
}

export function calendarEvent({ date, type, title: eventTitle, description = '', amount = 0, currency = 'PEN', priority = 'normal', amountPen }) {
  return {
    id: `${type}:${date}:${normalizeKey(eventTitle)}`.slice(0, 180),
    date,
    type,
    title: eventTitle,
    description,
    amount: round(amount || 0),
    currency: normalizeCurrency(currency || 'PEN'),
    amountPen: amountPen === undefined ? undefined : round(amountPen),
    priority,
  };
}

export function priorityRank(value) {
  if (value === 'high') return 3;
  if (value === 'medium') return 2;
  return 1;
}

export function freeMoneyActions({ actualSavings, configuredSavingsGoal, recommendedSavings, emergencyBuffer, fixedPending = 0, debtPending = 0, committedObligations = 0, freeAfterCommitments, dailyNormal, budgetLimit, investableNow }) {
  const actions = [];
  if (!actualSavings) actions.push('Aun no hay ahorro real registrado; el ahorro sugerido no reduce tu dinero libre.');
  if (recommendedSavings > 0) actions.push(`Puedes separar ${formatCurrency(recommendedSavings, 'PEN')} como ahorro sugerido este ciclo.`);
  if (!configuredSavingsGoal) actions.push('Si quieres una meta mas exacta, configura un ahorro sugerido del ciclo.');
  if (!emergencyBuffer) actions.push('Configura un colchon minimo para que el dinero libre no se coma tu seguridad.');
  if (!budgetLimit) actions.push('Agrega presupuestos por categoria para separar gasto permitido de excedente invertible.');
  if (committedObligations > 0) actions.push(`Ya reservamos ${formatCurrency(committedObligations, 'PEN')} para fijos y deudas de este ciclo; el gasto diario es lo que queda libre.`);
  if (freeAfterCommitments < 0) actions.push('Recorta gasto variable o pausa compras: la caja no cubre ahorro real y colchon.');
  if (dailyNormal > 0 && dailyNormal < 25) actions.push('Mantente en modo seguro unos dias para proteger el cierre.');
  if (investableNow > 0) actions.push('Hay margen extra despues de gasto y ahorro sugerido: revisa si conviene invertirlo o dejarlo liquido.');
  return actions.slice(0, 4);
}

export function investmentSuggestion({ amount, profile, horizon, emergencyBuffer, freeAfterCommitments, debtPending, actualSavings, recommendedSavings }) {
  const cleanProfile = normalizeInvestorProfile(profile);
  const cleanHorizon = normalizeInvestmentHorizon(horizon);
  const base = {
    amount: round(amount),
    profile: cleanProfile,
    horizon: cleanHorizon,
    title: '',
    message: '',
    allocation: [],
    nextStep: '',
    riskNote: 'Referencia educativa, no recomendacion personalizada. Verifica costos, liquidez, impuestos y que la entidad este supervisada por SBS o SMV.',
  };

  if (!actualSavings && recommendedSavings > 0) {
    return {
      ...base,
      title: 'Primero separa ahorro real',
      message: `Puedes ahorrar aproximadamente ${formatCurrency(recommendedSavings, 'PEN')} este ciclo. Separalo primero; despues evalua inversion.`,
      allocation: [{ label: 'Ahorro sugerido', pct: 100 }],
      nextStep: 'Registra el ahorro en una meta cuando lo separes de verdad.',
    };
  }

  if (freeAfterCommitments <= 0 || amount <= 0) {
    return {
      ...base,
      title: 'Todavia no hay excedente',
      message: 'Despues de ahorro, fijos, deudas y gasto planeado no queda dinero listo para invertir.',
      allocation: [{ label: 'Liquidez', pct: 100 }],
      nextStep: 'Protege caja y espera nuevo ingreso o cierre de compromisos.',
    };
  }

  if (debtPending > 0 && cleanProfile !== 'agresivo') {
    return {
      ...base,
      title: 'Prioriza deuda y liquidez',
      message: `Hay ${formatCurrency(debtPending, 'PEN')} pendiente. Si esa deuda tiene costo alto, suele ganar mas reducirla que invertir con riesgo.`,
      allocation: [
        { label: 'Prepago deuda cara', pct: 60 },
        { label: 'Liquidez regulada', pct: 40 },
      ],
      nextStep: 'Identifica la deuda con mayor tasa antes de mover excedentes.',
    };
  }

  if (emergencyBuffer > 0 && freeAfterCommitments < emergencyBuffer * 1.5) {
    return {
      ...base,
      title: 'Refuerza colchon',
      message: 'Tu excedente existe, pero aun esta cerca del colchon configurado.',
      allocation: [
        { label: 'Cuenta remunerada o deposito', pct: 80 },
        { label: 'Fondo conservador', pct: 20 },
      ],
      nextStep: 'Mantén disponibilidad antes de tomar riesgo de mercado.',
    };
  }

  if (cleanProfile === 'agresivo' && cleanHorizon === 'largo') {
    return {
      ...base,
      title: 'Excedente para crecimiento',
      message: 'Por perfil agresivo y horizonte largo, puedes evaluar aportes periodicos diversificados.',
      allocation: [
        { label: 'ETF/fondo diversificado', pct: 70 },
        { label: 'Liquidez oportunidad', pct: 20 },
        { label: 'Renta fija corta', pct: 10 },
      ],
      nextStep: 'Invierte por tramos y compara comisiones antes de elegir plataforma.',
    };
  }

  if (cleanProfile === 'moderado' || cleanHorizon === 'medio') {
    return {
      ...base,
      title: 'Ruta balanceada',
      message: 'El excedente puede dividirse entre liquidez y crecimiento sin comprometer el cierre.',
      allocation: [
        { label: 'Liquidez regulada', pct: 50 },
        { label: 'Fondo deuda/mixto', pct: 30 },
        { label: 'ETF/fondo diversificado', pct: 20 },
      ],
      nextStep: 'Define si ese dinero se usara en menos de 12 meses antes de tomar volatilidad.',
    };
  }

  return {
    ...base,
    title: 'Ruta conservadora',
    message: 'Para perfil conservador o plazo corto, manda liquidez y baja volatilidad.',
    allocation: [
      { label: 'Cuenta remunerada o deposito', pct: 70 },
      { label: 'Fondo mutuo conservador', pct: 20 },
      { label: 'USD solo si tienes gasto en USD', pct: 10 },
    ],
    nextStep: 'Compara tasa efectiva, plazo, penalidad de retiro y cobertura antes de mover dinero.',
  };
}

export function smartAlerts({ now, cycle, ingresosMes, gastosMes, budgets, fixedExpenses, debts, latest }) {
  const alerts = [];
  const today = localDateKey(now);
  const cycleLabel = cycle?.shortLabel || '22-22';

  budgets.forEach((item) => {
    const spent = Number(item.gasto || 0);
    const limit = Number(item.limite || 0);
    if (limit <= 0) return;

    const pct = Math.round((spent / limit) * 100);
    if (pct >= 100) {
      alerts.push({
        level: 'danger',
        title: `Presupuesto superado: ${item.cat}`,
        message: `Vas en S/ ${round(spent)} de S/ ${round(limit)} (${pct}%).`,
      });
    } else if (pct >= 80) {
      alerts.push({
        level: 'warning',
        title: `Presupuesto cerca del limite: ${item.cat}`,
        message: `Ya usaste ${pct}% del presupuesto.`,
      });
    }
  });

  fixedExpenses
    .filter((item) => item.estado === 'pendiente')
    .slice(0, 3)
    .forEach((item) => {
      alerts.push({
        level: 'info',
        title: `Gasto fijo pendiente: ${item.nombre}`,
        message: `Falta marcar ${formatCurrency(item.monto, item.currency)} como pagado o saltado en el ciclo ${cycleLabel}.`,
      });
    });

  debts
    .filter((item) => item.estado === 'activa' && item.vencimiento)
    .forEach((item) => {
      const days = daysBetween(today, item.vencimiento);
      const pending = formatCurrency(item.pendiente, item.currency);
      if (days < 0) {
        alerts.push({
          level: 'danger',
          title: `Deuda vencida: ${item.nombre}`,
          message: `Pendiente ${pending} desde ${item.vencimiento}.`,
        });
      } else if (days <= 7) {
        alerts.push({
          level: 'warning',
          title: `Deuda por vencer: ${item.nombre}`,
          message: `Vence en ${days} dia${days === 1 ? '' : 's'} y queda ${pending}.`,
        });
      }
    });

  latest
    .filter((tx) => tx.tipo === 'gasto' && tx.paymentMethod === 'credito' && tx.paymentDueDate)
    .forEach((tx) => {
      const days = daysBetween(today, tx.paymentDueDate);
      if (days >= 0 && days <= 5) {
        alerts.push({
          level: 'warning',
          title: 'Pago de credito cercano',
          message: `${tx.desc}: S/ ${round(tx.monto)} vence el ${tx.paymentDueDate}.`,
        });
      }
    });

  if (ingresosMes > 0 && gastosMes > ingresosMes) {
    alerts.push({
      level: 'danger',
      title: 'Gastos sobre ingresos',
      message: `En el ciclo ${cycleLabel} gastaste S/ ${round(gastosMes)} contra S/ ${round(ingresosMes)} de ingresos.`,
    });
  }

  return alerts.slice(0, 8);
}

export function smartInsights({ ingresosMes, gastosMes, balanceMes, cashBalance, freeMoney, categories, budgets, debts, months }) {
  const insights = [];
  const activeDebts = debts.filter((item) => item.estado === 'activa');
  const totalDebtPen = activeDebts
    .filter((item) => normalizeCurrency(item.currency || 'PEN') !== 'USD')
    .reduce((total, item) => total + Number(item.pendiente || 0), 0);
  const totalDebtUsd = activeDebts
    .filter((item) => normalizeCurrency(item.currency || 'PEN') === 'USD')
    .reduce((total, item) => total + Number(item.pendiente || 0), 0);
  const topCategory = [...categories].sort((a, b) => Number(b.monto || 0) - Number(a.monto || 0))[0];
  const categorizedSpend = categories.reduce((total, item) => total + Number(item.monto || 0), 0);
  const prev = months.length >= 2 ? months[months.length - 2] : null;
  const current = months.length ? months[months.length - 1] : null;

  if (topCategory && categorizedSpend > 0) {
    const topAmount = Number(topCategory.monto || 0);
    const pct = Math.round((topAmount / categorizedSpend) * 100);
    insights.push({
      title: `Mayor fuga: ${title(topCategory.cat)}`,
      message: `${formatCurrency(topAmount, 'PEN')} representa ${pct}% del gasto categorizado del ciclo. Revisa si ese ritmo sigue siendo intencional.`,
    });
  }

  if (prev && current && Number(prev.gastos || 0) > 0) {
    const currentSpend = Number(current.gastos || 0);
    const prevSpend = Number(prev.gastos || 0);
    const delta = Math.round(((currentSpend - prevSpend) / Number(prev.gastos || 1)) * 100);
    insights.push({
      title: delta >= 0 ? 'Gasto acelerado' : 'Gasto mas controlado',
      message: `En mes calendario vas ${Math.abs(delta)}% ${delta >= 0 ? 'por encima' : 'por debajo'} de ${prev.label || prev.mes}: ${formatCurrency(currentSpend, 'PEN')} vs ${formatCurrency(prevSpend, 'PEN')}.`,
    });
  }

  const riskyBudget = budgets
    .filter((item) => Number(item.limite || 0) > 0)
    .map((item) => ({ ...item, pct: Math.round((Number(item.gasto || 0) / Number(item.limite || 1)) * 100) }))
    .sort((a, b) => b.pct - a.pct)[0];
  if (riskyBudget && riskyBudget.pct >= 70) {
    insights.push({
      title: `Presupuesto sensible: ${riskyBudget.cat}`,
      message: `Lleva ${formatCurrency(riskyBudget.gasto || 0, 'PEN')} de ${formatCurrency(riskyBudget.limite || 0, 'PEN')} (${riskyBudget.pct}% del limite).`,
    });
  }

  if (totalDebtPen > 0 || totalDebtUsd > 0) {
    const totals = [
      totalDebtPen > 0 ? formatCurrency(totalDebtPen, 'PEN') : '',
      totalDebtUsd > 0 ? formatCurrency(totalDebtUsd, 'USD') : '',
    ].filter(Boolean).join(' + ');
    insights.push({
      title: 'Deuda pendiente',
      message: `Tienes ${totals} pendiente. Prioriza lo que vence primero.`,
    });
  }

  if (Number.isFinite(Number(cashBalance))) {
    insights.push({
      title: cashBalance > 0 ? 'Caja actual' : 'Caja ajustada',
      message: `Caja actual registrada: ${formatCurrency(cashBalance, 'PEN')}. Usa este monto como base; el balance del ciclo solo explica movimientos registrados.`,
    });
  } else if (ingresosMes > 0) {
    insights.push({
      title: balanceMes >= 0 ? 'Flujo positivo' : 'Flujo registrado negativo',
      message: `Entraron ${formatCurrency(ingresosMes, 'PEN')} y salieron ${formatCurrency(gastosMes, 'PEN')} registrados en el ciclo.`,
    });
  }

  return insights.slice(0, 6);
}
