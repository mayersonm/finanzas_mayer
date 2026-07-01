import { COLORS } from '../../shared/constants.js';
import { httpError } from '../../shared/http.js';
import { round, parseAmount, currencyToPen } from '../../shared/money.js';
import { classifyCategory } from '../../shared/categories.js';
import { cycleDateTimeBounds, localDateKey, payCycleFromDate } from '../../shared/dates.js';
import { normalizeCurrency, normalizeDateOnly, normalizeKey, title } from '../../shared/normalizers.js';

export async function upsertFixedExpense(env, chatId, raw) {
  const fixed = await normalizeFixedExpense(env, chatId, raw);
  if (!fixed) return false;
  await saveFixedExpense(env, fixed);
  return true;
}

export async function upsertFixedExpenseFromPayload(env, payload, params) {
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

export async function normalizeFixedExpense(env, chatId, raw) {
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

export async function saveFixedExpense(env, fixed) {
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

export async function updateFixedExpenseFromDashboard(env, id, payload, params) {
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

export async function deleteFixedExpense(env, id, params) {
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

export async function setFixedExpenseMonthStatus(env, id, payload, params) {
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

export function fixedExpenseShape(row) {
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

export async function fixedExpensesList(env, chatId, monthKey, usdRate = 3.85, cycle = null) {
  const window = {
    startKey: cycle?.startKey || `${monthKey}-01`,
    startTime: cycle?.startTime || null,
    endKey: cycle?.endKey || `${monthKey}-31`,
    endTime: cycle?.endTime || null,
  };
  const bounds = cycleDateTimeBounds('t.tx_date', 't.tx_time', window);
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
          AND ${bounds.sql}
          AND lower(t.description) = lower(f.name)
      ) AS pagadoMes
    FROM fixed_expenses f
    LEFT JOIN fixed_expense_month_status s
      ON s.fixed_id = f.id
      AND s.chat_id = f.chat_id
      AND s.month_key = ?
    WHERE f.chat_id = ? AND f.active = 1
    ORDER BY f.name ASC
  `).bind(...bounds.values, monthKey, chatId).all();

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
