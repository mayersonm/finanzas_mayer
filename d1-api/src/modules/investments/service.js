import { httpError } from '../../shared/http.js';
import { parseAmount, round } from '../../shared/money.js';
import { normalizeCurrency, normalizeKey, title } from '../../shared/normalizers.js';
import { getChatId } from '../../shared/request.js';

export async function investmentsList(env, params) {
  const chatId = getChatId(env, params);
  const rows = await env.DB.prepare(`
    SELECT id, name, kind, amount, current_value, currency, notes, active, created_at, updated_at
    FROM investments
    WHERE chat_id = ? AND active = 1
    ORDER BY current_value DESC, amount DESC, name ASC
  `).bind(chatId).all();

  return {
    ok: true,
    investments: (rows.results || []).map(investmentShape),
  };
}

export async function upsertInvestmentFromDashboard(env, payload, params) {
  const chatId = String(params.get('chat_id') || payload.chat_id || payload.chatId || env.DEFAULT_CHAT_ID || '').trim();
  if (!chatId) throw httpError(400, 'chat_id requerido');

  const investment = normalizeInvestment(payload, chatId);
  if (!investment) throw httpError(400, 'Inversion invalida');

  await env.DB.prepare(`
    INSERT INTO investments (
      id, chat_id, name, kind, amount, current_value, currency, notes, active, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
    ON CONFLICT(chat_id, name) DO UPDATE SET
      kind = excluded.kind,
      amount = excluded.amount,
      current_value = excluded.current_value,
      currency = excluded.currency,
      notes = excluded.notes,
      active = 1,
      updated_at = CURRENT_TIMESTAMP
  `).bind(
    investment.id,
    investment.chat_id,
    investment.name,
    investment.kind,
    investment.amount,
    investment.current_value,
    investment.currency,
    investment.notes,
  ).run();

  const saved = await env.DB.prepare('SELECT * FROM investments WHERE chat_id = ? AND name = ?')
    .bind(chatId, investment.name)
    .first();
  return { ok: true, investment: investmentShape(saved) };
}

export async function updateInvestmentFromDashboard(env, id, payload, params) {
  const chatId = String(params.get('chat_id') || payload.chat_id || payload.chatId || env.DEFAULT_CHAT_ID || '').trim();
  const cleanId = String(id || '').trim();
  if (!chatId) throw httpError(400, 'chat_id requerido');
  if (!cleanId) throw httpError(400, 'id requerido');

  const existing = await env.DB.prepare('SELECT * FROM investments WHERE id = ? AND chat_id = ? AND active = 1')
    .bind(cleanId, chatId)
    .first();
  if (!existing) throw httpError(404, 'Inversion no encontrada');

  const name = normalizeKey(payload.name ?? payload.nombre ?? existing.name);
  const kind = normalizeKey(payload.kind ?? payload.tipo ?? existing.kind ?? 'otro') || 'otro';
  const amount = parseAmount(payload.amount ?? payload.monto ?? existing.amount);
  const currentValue = parseAmount(payload.currentValue ?? payload.current_value ?? payload.valorActual ?? existing.current_value);
  const currency = normalizeCurrency(payload.currency ?? existing.currency);
  const notes = String(payload.notes ?? payload.notas ?? existing.notes ?? '').trim().slice(0, 240);
  if (!name) throw httpError(400, 'nombre requerido');
  if (amount < 0 || currentValue < 0) throw httpError(400, 'monto invalido');

  const conflict = await env.DB.prepare('SELECT id FROM investments WHERE chat_id = ? AND lower(name) = lower(?) AND id <> ? AND active = 1')
    .bind(chatId, name, cleanId)
    .first();
  if (conflict) throw httpError(409, 'Ya existe otra inversion con ese nombre');

  await env.DB.prepare(`
    UPDATE investments
    SET name = ?,
        kind = ?,
        amount = ?,
        current_value = ?,
        currency = ?,
        notes = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND chat_id = ?
  `).bind(name, kind, round(amount), round(currentValue), currency, notes, cleanId, chatId).run();

  const saved = await env.DB.prepare('SELECT * FROM investments WHERE id = ? AND chat_id = ?')
    .bind(cleanId, chatId)
    .first();
  return { ok: true, investment: investmentShape(saved) };
}

export async function deleteInvestment(env, id, params) {
  const chatId = String(params.get('chat_id') || env.DEFAULT_CHAT_ID || '').trim();
  const cleanId = String(id || '').trim();
  if (!chatId) throw httpError(400, 'chat_id requerido');
  if (!cleanId) throw httpError(400, 'id requerido');

  await env.DB.prepare(`
    UPDATE investments
    SET active = 0, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND chat_id = ?
  `).bind(cleanId, chatId).run();

  return { ok: true, deleted: true, id: cleanId };
}

function normalizeInvestment(raw, chatId) {
  const name = normalizeKey(raw.name || raw.nombre || '');
  const kind = normalizeKey(raw.kind || raw.tipo || 'otro') || 'otro';
  const amount = parseAmount(raw.amount || raw.monto || 0);
  const currentValue = parseAmount(raw.currentValue ?? raw.current_value ?? raw.valorActual ?? amount);
  const currency = normalizeCurrency(raw.currency || raw.moneda || 'PEN');
  const notes = String(raw.notes || raw.notas || '').trim().slice(0, 240);
  if (!name) return null;
  if (amount < 0 || currentValue < 0) return null;

  return {
    id: String(raw.id || `investment:${chatId}:${name}`).slice(0, 180),
    chat_id: chatId,
    name,
    kind,
    amount: round(amount),
    current_value: round(currentValue),
    currency,
    notes,
  };
}

export function investmentShape(row) {
  const amount = round(row.amount || 0);
  const currentValue = round(row.current_value || row.currentValue || 0);
  return {
    id: row.id,
    name: title(row.name),
    kind: title(row.kind || 'otro'),
    amount,
    currentValue,
    currency: normalizeCurrency(row.currency || 'PEN'),
    gain: round(currentValue - amount),
    gainPct: amount > 0 ? Math.round(((currentValue - amount) / amount) * 10000) / 100 : 0,
    notes: row.notes || '',
    updatedAt: row.updated_at || row.updatedAt || '',
  };
}
