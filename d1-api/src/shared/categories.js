
import { VALID_CATEGORIES } from './constants.js';
import { normalizeKey } from './normalizers.js';

export async function classifyCategory(env, chatId, value, description = '') {
  const explicitCategory = normalizeExplicitCategory(value);
  if (explicitCategory) {
    return {
      category: explicitCategory,
      source: 'explicit',
      keyword: '',
    };
  }

  const rules = await loadCategoryRules(env, chatId);
  const match = matchCategoryRule(rules, value, description);
  if (match) {
    return {
      category: normalizeCategory(match.category),
      source: match.chat_id === '*' ? 'rule_global' : 'rule_personal',
      keyword: match.keyword,
    };
  }

  const semanticCategory = semanticCategoryFromText(value, description);
  if (semanticCategory) {
    return {
      category: semanticCategory,
      source: 'fallback_keyword',
      keyword: semanticCategory,
    };
  }

  return {
    category: normalizeCategory(value),
    source: 'fallback',
    keyword: '',
  };
}

export async function loadCategoryRules(env, chatId) {
  const rows = await env.DB.prepare(`
    SELECT chat_id, keyword, category, priority
    FROM category_rules
    WHERE active = 1
      AND chat_id IN ('*', ?)
    ORDER BY
      CASE WHEN chat_id = ? THEN 0 ELSE 1 END,
      priority DESC,
      length(keyword) DESC,
      keyword ASC
  `).bind(chatId, chatId).all();

  return rows.results || [];
}

export function matchCategoryRule(rules, value, description = '') {
  const text = normalizeRuleKeyword(`${value || ''} ${description || ''}`);
  if (!text) return null;

  for (const rule of rules || []) {
    const keyword = normalizeRuleKeyword(rule.keyword);
    if (keyword && text.includes(keyword)) return rule;
  }

  return null;
}

export function classifyCategoryFromLoadedRules(rules, value, description = '') {
  const explicitCategory = normalizeExplicitCategory(value);
  if (explicitCategory) return explicitCategory;

  const match = matchCategoryRule(rules, value, description);
  return match ? normalizeCategory(match.category) : (semanticCategoryFromText(value, description) || normalizeCategory(value));
}

export async function loadBudgetRules(env, chatId) {
  const rows = await env.DB.prepare(`
    SELECT chat_id, budget_category, included_category
    FROM budget_category_rules
    WHERE active = 1
      AND chat_id IN ('*', ?)
    ORDER BY
      CASE WHEN chat_id = ? THEN 0 ELSE 1 END,
      budget_category ASC,
      included_category ASC
  `).bind(chatId, chatId).all();

  const map = {};
  for (const row of rows.results || []) {
    const budgetCategory = normalizeBaseCategory(row.budget_category);
    const includedCategory = normalizeBaseCategory(row.included_category);
    if (!budgetCategory || !includedCategory) continue;
    if (!map[budgetCategory]) map[budgetCategory] = [];
    if (!map[budgetCategory].includes(includedCategory)) map[budgetCategory].push(includedCategory);
  }

  return map;
}

export function budgetCategoryKeysFromRules(rules, category) {
  const key = normalizeBaseCategory(category);
  const included = rules[key] || [];
  return [...new Set([key].concat(included).filter(Boolean))];
}

export function budgetSpendWithRules(spending, category, rules) {
  return budgetCategoryKeysFromRules(rules, category)
    .reduce((total, key) => total + Number(spending[key] || 0), 0);
}

export function budgetRulesForDashboard(rules) {
  return Object.keys(rules || {}).flatMap((budgetCategory) => {
    return (rules[budgetCategory] || []).map((includedCategory) => ({
      budgetCategory,
      includedCategory,
    }));
  });
}

export function normalizeCategory(value) {
  return normalizeBaseCategory(value) || 'otro';
}

export function normalizeExplicitCategory(value) {
  const category = normalizeBaseCategory(value);
  return category && category !== 'otro' ? category : '';
}

export function normalizeBaseCategory(value) {
  const key = normalizeKey(value);
  const aliases = {
    alimentacion: 'supermercado',
    alimento: 'supermercado',
    alimentos: 'supermercado',
    comida: 'supermercado',
    mercado: 'supermercado',
    supermercado: 'supermercado',
    supermercados: 'supermercado',
    abarrotes: 'supermercado',
    transporte: 'transporte',
    servicios: 'servicios',
    servicio: 'servicios',
    entretenimiento: 'entretenimiento',
    salud: 'salud',
    ropa: 'ropa',
    educacion: 'educacion',
    salario: 'salario',
    sueldo: 'salario',
    freelance: 'freelance',
    deuda: 'deudas',
    deudas: 'deudas',
    prestamo: 'deudas',
    prestamos: 'deudas',
    inversion: 'inversion',
    venta: 'venta',
    otro: 'otro',
    otros: 'otro',
  };

  return aliases[key] || (VALID_CATEGORIES.includes(key) ? key : semanticCategoryFromText(key, ''));
}

export function semanticCategoryFromText(value, description = '') {
  const text = normalizeRuleKeyword(`${value || ''} ${description || ''}`);
  if (!text) return '';

  const entertainmentKeywords = [
    'comida rapida',
    'fast food',
    'kfc',
    'popeyes',
    'bembos',
    'mcdonalds',
    'mc donald',
    'burger king',
    'pizza hut',
    'dominos',
    'papa john',
    'hamburguesa',
    'salchipapa',
  ];
  if (entertainmentKeywords.some((keyword) => hasKeyword(text, keyword))) return 'entretenimiento';

  const supermarketKeywords = [
    'supermercado',
    'supermercados',
    'comida',
    'alimentacion',
    'alimento',
    'alimentos',
    'abarrotes',
    'mercado',
    'fruta',
    'frutas',
    'hortaliza',
    'hortalizas',
    'verdura',
    'verduras',
  ];
  if (supermarketKeywords.some((keyword) => hasKeyword(text, keyword))) return 'supermercado';

  return '';
}

export function hasKeyword(text, keyword) {
  const clean = normalizeRuleKeyword(keyword);
  if (!clean) return false;
  const pattern = clean.split(/\s+/).filter(Boolean).join('\\s+');
  return new RegExp(`(^|\\s)${pattern}(\\s|$)`).test(text);
}

export function normalizeRuleKeyword(value) {
  return normalizeKey(value)
    .replace(/[^a-z0-9ñ\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function safeRuleId(value) {
  return normalizeRuleKeyword(value)
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9ñ-]/g, '')
    .slice(0, 90) || 'rule';
}
