import { httpError } from '../../shared/http.js';
import { getChatId } from '../../shared/request.js';
import { round } from '../../shared/money.js';
import { normalizeBaseCategory } from '../../shared/categories.js';

export async function upsertBudgetFromPayload(env, payload, params) {
  const chatId = String(payload.chat_id || payload.chatId || getChatId(env, params) || '').trim();
  if (!chatId) throw httpError(400, 'chat_id requerido');

  const budget = await upsertBudget(env, chatId, payload);
  if (!budget) throw httpError(400, 'Presupuesto invalido');

  return {
    ok: true,
    budget,
  };
}

export async function upsertBudget(env, chatId, raw) {
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

export async function budgetsRows(env, chatId) {
  const rows = await env.DB.prepare(`
    SELECT category AS cat, limit_amount AS limite
    FROM budgets
    WHERE chat_id = ?
  `).bind(chatId).all();

  return rows.results || [];
}
