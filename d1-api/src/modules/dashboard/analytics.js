import { COLORS } from '../../shared/constants.js';
import { round, currencyToPen } from '../../shared/money.js';
import { dateKeyFromParts, localDateKey, monthLongNameFromKey, monthShortNameFromKey, parseDateKeyParts } from '../../shared/dates.js';
import { normalizeKey, title } from '../../shared/normalizers.js';
import { normalizeCategory, budgetSpendWithRules, classifyCategoryFromLoadedRules, loadBudgetRules, loadCategoryRules } from '../../shared/categories.js';

export async function cycleExpenseRows(env, chatId, cycle) {
  const rows = await env.DB.prepare(`
    SELECT description AS desc, category AS cat, amount, currency, source
    FROM transactions
    WHERE chat_id = ?
      AND type = 'gasto'
      AND tx_date BETWEEN ? AND ?
  `).bind(chatId, cycle.startKey, cycle.endKey).all();

  return rows.results || [];
}

// Agrupa filas de gasto por categoria (ya clasificada con reglas) y las ordena por monto.
export function categoriesFromExpenseRows(rows, rules, usdRate = 3.85) {
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

// Detecta las mayores fugas de gasto variable, excluyendo deudas y fijos ya pagados.
export function topLeaksFromExpenseRows(rows, rules, usdRate = 3.85) {
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

// Lee los gastos del periodo y sus reglas. Reutilizado por las variantes "WithSpending"/topLeaks.
async function loadExpenseRowsAndRules(env, chatId, period) {
  const rowsPromise = env.DB.prepare(`
    SELECT category AS cat, description AS desc, amount, currency, source
    FROM transactions
    WHERE chat_id = ?
      AND type = 'gasto'
      AND tx_date BETWEEN ? AND ?
  `).bind(chatId, period.startKey, period.endKey).all();

  const [rows, rules] = await Promise.all([rowsPromise, loadCategoryRules(env, chatId)]);
  return { rows: rows.results || [], rules };
}

export function budgetsFromExpenseRows(rows, expenseRows, categoryRules, budgetRules, usdRate = 3.85) {
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

export async function lastMonths(env, chatId, now, usdRate = 3.85) {
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

export async function categoriesWithSpending(env, chatId, cycle, usdRate = 3.85) {
  const { rows, rules } = await loadExpenseRowsAndRules(env, chatId, cycle);
  return categoriesFromExpenseRows(rows, rules, usdRate);
}

export async function topLeaks(env, chatId, period, usdRate = 3.85) {
  const { rows, rules } = await loadExpenseRowsAndRules(env, chatId, period);
  return topLeaksFromExpenseRows(rows, rules, usdRate);
}

export function leakLabel(description, category) {
  if (normalizeCategory(category) === 'supermercado') return 'Supermercado';

  const raw = normalizeKey(description || '');
  const cleaned = raw
    .replace(/^(compra|consumo|pago|gasto|recibo|boleta|factura)\s+(en|de|por)?\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  const label = title(cleaned || category || 'gasto');
  return label.length > 54 ? `${label.slice(0, 51).trim()}...` : label;
}

export async function budgetsWithSpending(env, chatId, cycle, usdRate = 3.85) {
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

