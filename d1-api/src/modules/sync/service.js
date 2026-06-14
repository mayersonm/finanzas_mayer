import { httpError } from '../../shared/http.js';
import { clamp } from '../../shared/normalizers.js';
import { readJsonCache, setJsonCache, timeoutSignal } from '../../shared/settings-store.js';
import { normalizeTransaction, upsertTransaction, deleteTransaction } from '../transactions/service.js';
import { upsertBudget } from '../budgeting/service.js';
import { upsertGoal } from '../goals/service.js';
import { upsertFixedExpense } from '../commitments/fixed-expenses.js';
import { upsertDebt } from '../commitments/debts.js';

export async function syncFromGas(env, params) {
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

export async function emailConfigFromGas(env) {
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

export async function pruneTransactionsNotInSheets(env, chatId, sheetTransactionIds) {
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
