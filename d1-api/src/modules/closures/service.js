import { httpError, safeJsonParse } from '../../shared/http.js';
import { getChatId } from '../../shared/request.js';
import { round } from '../../shared/money.js';
import { dateFromKey, localDateKey, localIso, payCycleFromDate, payCycleRelative } from '../../shared/dates.js';
import { dashboard } from '../dashboard/service.js';

export async function financialClosures(env, params) {
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

export async function saveFinancialClosure(env, params, payload = {}) {
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
  const currentCycle = payCycleFromDate(dateFromKey(closure.start || data.cycleStart || `${closureKey}-22`));
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

export async function currentFinancialClosure(env, chatId, closureKey) {
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

export function financialClosureShape(row) {
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

export function cycleShape(cycle) {
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

export function closureNextCycleShape(row) {
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

export function nextCycleBudgetSuggestion(budgets = []) {
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
