import { round, parseAmount } from '../../shared/money.js';
import { normalizeKey, title } from '../../shared/normalizers.js';

export async function upsertGoal(env, chatId, raw) {
  const name = normalizeKey(raw.nombre || raw.name || '');
  const target = parseAmount(raw.objetivo || raw.target_amount || 0);
  const saved = parseAmount(raw.ahorrado || raw.saved_amount || 0);
  if (!name || target <= 0) return false;

  await env.DB.prepare(`
    INSERT INTO goals (id, chat_id, name, target_amount, saved_amount, updated_at)
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(chat_id, name) DO UPDATE SET
      target_amount = excluded.target_amount,
      saved_amount = excluded.saved_amount,
      updated_at = CURRENT_TIMESTAMP
  `).bind(`goal:${chatId}:${name}`, chatId, name, target, saved).run();

  return true;
}

export async function goalsList(env, chatId) {
  const rows = await env.DB.prepare(`
    SELECT name AS nombre, target_amount AS objetivo, saved_amount AS ahorrado
    FROM goals
    WHERE chat_id = ?
    ORDER BY created_at ASC
  `).bind(chatId).all();

  return (rows.results || []).map((row) => ({
    nombre: title(row.nombre),
    objetivo: round(row.objetivo),
    ahorrado: round(row.ahorrado),
  }));
}
