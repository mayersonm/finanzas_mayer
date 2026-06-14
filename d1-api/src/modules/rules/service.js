import { httpError } from '../../shared/http.js';
import { payloadChatId } from '../../shared/request.js';
import { clamp } from '../../shared/normalizers.js';
import { classifyCategory, budgetCategoryKeysFromRules, loadBudgetRules, normalizeBaseCategory, normalizeRuleKeyword, safeRuleId } from '../../shared/categories.js';

export async function rulesList(env, params) {
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

export async function classifyRulePayload(env, payload) {
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

export async function budgetKeysPayload(env, payload) {
  const chatId = payloadChatId(env, payload);
  const category = normalizeBaseCategory(payload.cat || payload.category || payload.budget_category || payload.budgetCategory || 'otro');
  const rules = await loadBudgetRules(env, chatId);

  return {
    ok: true,
    category,
    keys: budgetCategoryKeysFromRules(rules, category),
  };
}

export async function upsertCategoryRule(env, payload) {
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

export async function deleteCategoryRule(env, payload) {
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

export async function upsertBudgetCategoryRule(env, payload) {
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

export async function deleteBudgetCategoryRule(env, payload) {
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
