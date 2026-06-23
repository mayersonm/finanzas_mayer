import { getChatId } from '../../shared/request.js';
import { round, currencyToPen } from '../../shared/money.js';
import { localDateKey, localIso, payCycleFromDate } from '../../shared/dates.js';
import { fixedExpensesSummary, netWorthInsights } from '../dashboard/planning.js';
import { computeCashBalance } from '../transactions/service.js';
import { investmentsList } from '../investments/service.js';
import { exchangeRate } from '../system/exchange-rate.js';
import { fixedExpensesList } from '../commitments/fixed-expenses.js';
import { debtsList } from '../commitments/debts.js';
import { goalsList } from '../goals/service.js';

export async function netWorth(env, params) {
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
  const cashResult = await computeCashBalance(env, chatId, rate, { ingresos: incomePen, gastos: expensesPen, fixedPaid: fixedSummary.paid });
  const cash = cashResult.balance;

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

export async function saveNetWorthSnapshot(env, params) {
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

export async function netWorthSnapshots(env, chatId) {
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
