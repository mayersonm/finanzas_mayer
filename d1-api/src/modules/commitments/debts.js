import { httpError } from '../../shared/http.js';
import { round, parseAmount } from '../../shared/money.js';
import { localDateKey, localIso } from '../../shared/dates.js';
import { normalizeCurrency, normalizeDateOnly, normalizeKey, title } from '../../shared/normalizers.js';
import { normalizeTransaction, txShape, upsertTransaction } from '../transactions/service.js';

export async function upsertDebtFromPayload(env, payload) {
  const chatId = String(payload.chat_id || payload.chatId || env.DEFAULT_CHAT_ID || '').trim();
  if (!chatId) throw httpError(400, 'chat_id requerido');

  const debt = normalizeDebt(payload, chatId);
  if (!debt) throw httpError(400, 'Deuda invalida');
  const saved = await saveDebt(env, debt);

  return {
    ok: true,
    debt: debtShape(saved),
  };
}

export async function upsertDebt(env, chatId, raw) {
  const debt = normalizeDebt(raw, chatId);
  if (!debt) return false;
  await saveDebt(env, debt);
  return true;
}

export function normalizeDebt(raw, chatId) {
  const name = normalizeKey(raw.nombre || raw.name || '');
  const totalAmount = parseAmount(raw.total || raw.total_amount || raw.totalAmount || raw.monto || raw.amount || 0);
  const paidAmount = parseAmount(raw.pagado || raw.paid_amount || raw.paidAmount || 0);
  const rawCurrency = raw.currency ?? raw.moneda;
  const hasCurrency = rawCurrency !== undefined && rawCurrency !== null && String(rawCurrency).trim() !== '';
  const currency = hasCurrency ? normalizeCurrency(rawCurrency) : 'PEN';
  const dueDate = normalizeDateOnly(raw.vencimiento || raw.due_date || raw.dueDate || raw.fecha || '');
  const statusRaw = normalizeKey(raw.estado || raw.status || '');
  const status = statusRaw === 'pagada' || statusRaw === 'pagado' || paidAmount >= totalAmount
    ? 'pagada'
    : 'activa';
  const notes = String(raw.notas || raw.notes || '').trim().slice(0, 240);

  if (!name || totalAmount <= 0) return null;

  return {
    id: String(raw.id || `debt:${chatId}:${name}`).slice(0, 180),
    chat_id: chatId,
    name,
    total_amount: round(totalAmount),
    paid_amount: round(Math.min(Math.max(paidAmount, 0), totalAmount)),
    currency,
    has_currency: hasCurrency,
    due_date: dueDate,
    status,
    notes,
  };
}

export async function saveDebt(env, debt) {
  await env.DB.prepare(`
    INSERT INTO debts (
      id, chat_id, name, total_amount, paid_amount, currency, due_date, status, notes, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(chat_id, name) DO UPDATE SET
      total_amount = excluded.total_amount,
      paid_amount = excluded.paid_amount,
      currency = CASE WHEN ? = 1 THEN excluded.currency ELSE debts.currency END,
      due_date = excluded.due_date,
      status = excluded.status,
      notes = excluded.notes,
      updated_at = CURRENT_TIMESTAMP
  `).bind(
    debt.id,
    debt.chat_id,
    debt.name,
    debt.total_amount,
    debt.paid_amount,
    debt.currency,
    debt.due_date || null,
    debt.status,
    debt.notes,
    debt.has_currency ? 1 : 0,
  ).run();

  return env.DB.prepare('SELECT * FROM debts WHERE id = ? AND chat_id = ?')
    .bind(debt.id, debt.chat_id)
    .first();
}

export async function updateDebtFromDashboard(env, id, payload, params) {
  const chatId = String(params.get('chat_id') || payload.chat_id || payload.chatId || env.DEFAULT_CHAT_ID || '').trim();
  const cleanId = String(id || '').trim();
  if (!chatId) throw httpError(400, 'chat_id requerido');
  if (!cleanId) throw httpError(400, 'id requerido');

  const existing = await env.DB.prepare('SELECT * FROM debts WHERE id = ? AND chat_id = ?')
    .bind(cleanId, chatId)
    .first();
  if (!existing) throw httpError(404, 'Deuda no encontrada');

  const name = normalizeKey(payload.nombre ?? payload.name ?? existing.name);
  const totalAmount = parseAmount(payload.total ?? payload.total_amount ?? payload.totalAmount ?? existing.total_amount);
  const paidAmount = parseAmount(payload.pagado ?? payload.paid_amount ?? payload.paidAmount ?? existing.paid_amount);
  const currency = normalizeCurrency(payload.currency ?? existing.currency);
  const dueDate = normalizeDateOnly(payload.vencimiento ?? payload.due_date ?? payload.dueDate ?? existing.due_date ?? '');
  const notes = String(payload.notas ?? payload.notes ?? existing.notes ?? '').trim().slice(0, 240);
  const statusRaw = normalizeKey(payload.estado ?? payload.status ?? existing.status ?? '');
  const paid = round(Math.min(Math.max(paidAmount, 0), totalAmount));
  const status = statusRaw === 'pagada' || statusRaw === 'pagado' || paid >= totalAmount ? 'pagada' : 'activa';

  if (!name) throw httpError(400, 'nombre requerido');
  if (totalAmount <= 0) throw httpError(400, 'total invalido');

  const conflict = await env.DB.prepare('SELECT id FROM debts WHERE chat_id = ? AND lower(name) = lower(?) AND id <> ?')
    .bind(chatId, name, cleanId)
    .first();
  if (conflict) throw httpError(409, 'Ya existe otra deuda con ese nombre');

  try {
    await env.DB.prepare(`
      UPDATE debts
      SET name = ?,
          total_amount = ?,
          paid_amount = ?,
          currency = ?,
          due_date = ?,
          status = ?,
          notes = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND chat_id = ?
    `).bind(name, round(totalAmount), paid, currency, dueDate || null, status, notes, cleanId, chatId).run();
  } catch (error) {
    throw httpError(409, error?.message || 'No se pudo actualizar la deuda');
  }

  const saved = await env.DB.prepare('SELECT * FROM debts WHERE id = ? AND chat_id = ?')
    .bind(cleanId, chatId)
    .first();
  if (!saved) throw httpError(404, 'Deuda no encontrada despues de actualizar');
  return { ok: true, debt: debtShape(saved) };
}

export async function deleteDebt(env, id, params) {
  const chatId = String(params.get('chat_id') || env.DEFAULT_CHAT_ID || '').trim();
  const cleanId = String(id || '').trim();
  if (!chatId) throw httpError(400, 'chat_id requerido');
  if (!cleanId) throw httpError(400, 'id requerido');

  const existing = await env.DB.prepare('SELECT id FROM debts WHERE id = ? AND chat_id = ?')
    .bind(cleanId, chatId)
    .first();
  if (!existing) throw httpError(404, 'Deuda no encontrada');

  await env.DB.prepare('DELETE FROM debt_payments WHERE debt_id = ? AND chat_id = ?')
    .bind(cleanId, chatId)
    .run();
  await env.DB.prepare('DELETE FROM debts WHERE id = ? AND chat_id = ?')
    .bind(cleanId, chatId)
    .run();

  return { ok: true, deleted: true, id: cleanId };
}

export async function addDebtPayment(env, id, payload, params) {
  const chatId = String(params.get('chat_id') || payload.chat_id || payload.chatId || env.DEFAULT_CHAT_ID || '').trim();
  const cleanId = String(id || '').trim();
  if (!chatId) throw httpError(400, 'chat_id requerido');
  if (!cleanId) throw httpError(400, 'id requerido');

  const existing = await env.DB.prepare('SELECT * FROM debts WHERE id = ? AND chat_id = ?')
    .bind(cleanId, chatId)
    .first();
  if (!existing) throw httpError(404, 'Deuda no encontrada');

  const amount = parseAmount(payload.amount ?? payload.monto ?? 0);
  const currency = normalizeCurrency(payload.currency || existing.currency || 'PEN');
  const paymentDate = normalizeDateOnly(payload.paymentDate || payload.payment_date || payload.fecha || localDateKey(new Date())) || localDateKey(new Date());
  const notes = String(payload.notes || payload.notas || '').trim().slice(0, 200);

  if (amount <= 0) throw httpError(400, 'monto invalido');
  if (currency !== normalizeCurrency(existing.currency || 'PEN')) {
    throw httpError(400, `La deuda esta en ${existing.currency || 'PEN'}. Registra el pago en la misma moneda.`);
  }

  const currentPaid = Number(existing.paid_amount || 0);
  const totalAmount = Number(existing.total_amount || 0);
  const appliedAmount = round(Math.min(amount, Math.max(totalAmount - currentPaid, 0)));
  if (appliedAmount <= 0) throw httpError(400, 'La deuda ya esta pagada');

  const paymentId = String(payload.id || `debtpay:${cleanId}:${Date.now()}`).slice(0, 180);
  await env.DB.prepare(`
    INSERT INTO debt_payments (id, debt_id, chat_id, amount, currency, payment_date, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).bind(paymentId, cleanId, chatId, appliedAmount, currency, paymentDate, notes).run();

  const nextPaid = round(Math.min(totalAmount, currentPaid + appliedAmount));
  const nextStatus = nextPaid >= totalAmount ? 'pagada' : 'activa';
  await env.DB.prepare(`
    UPDATE debts
    SET paid_amount = ?,
        status = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND chat_id = ?
  `).bind(nextPaid, nextStatus, cleanId, chatId).run();

  let transaction = null;
  if (payload.record_transaction !== false && payload.recordTransaction !== false) {
    transaction = await insertDebtPaymentTransaction(env, {
      chatId,
      paymentId,
      debtName: existing.name,
      amount: appliedAmount,
      currency,
      paymentDate,
    });
  }

  const debt = await env.DB.prepare('SELECT * FROM debts WHERE id = ? AND chat_id = ?')
    .bind(cleanId, chatId)
    .first();
  const payment = await env.DB.prepare('SELECT * FROM debt_payments WHERE id = ?')
    .bind(paymentId)
    .first();

  return { ok: true, debt: debtShape(debt), payment: debtPaymentShape(payment), transaction: transaction ? txShape(transaction) : null };
}

export async function insertDebtPaymentTransaction(env, { chatId, paymentId, debtName, amount, currency, paymentDate }) {
  const now = new Date();
  const tx = await normalizeTransaction(env, {
    id: `tx:${paymentId}`,
    chat_id: chatId,
    fecha: paymentDate || localDateKey(now),
    hora: localIso(now).slice(11, 16),
    tipo: 'gasto',
    desc: `Pago deuda ${title(debtName)}`,
    cat: 'deudas',
    monto: amount,
    currency,
    payment_method: 'debito',
    source: 'debt_payment',
  }, chatId);

  await upsertTransaction(env, tx);
  return tx;
}

export async function debtsList(env, chatId) {
  const rows = await env.DB.prepare(`
    SELECT id, name, total_amount, paid_amount, currency, due_date, status, notes
    FROM debts
    WHERE chat_id = ?
    ORDER BY
      CASE WHEN status = 'activa' THEN 0 ELSE 1 END,
      CASE WHEN due_date IS NULL OR due_date = '' THEN 1 ELSE 0 END,
      due_date ASC,
      total_amount - paid_amount DESC
  `).bind(chatId).all();

  const debts = rows.results || [];
  if (!debts.length) return [];

  const paymentsRows = await env.DB.prepare(`
    SELECT id, debt_id, chat_id, amount, currency, payment_date, notes, created_at
    FROM debt_payments
    WHERE chat_id = ?
    ORDER BY payment_date DESC, created_at DESC
  `).bind(chatId).all();

  const paymentsByDebt = {};
  for (const payment of paymentsRows.results || []) {
    const key = payment.debt_id;
    if (!paymentsByDebt[key]) paymentsByDebt[key] = [];
    paymentsByDebt[key].push(payment);
  }

  return debts.map((row) => debtShape({
    ...row,
    payments: paymentsByDebt[row.id] || [],
  }));
}

export function debtShape(row) {
  const total = round(row.total_amount);
  const paid = round(row.paid_amount);
  const pending = round(Math.max(total - paid, 0));

  return {
    id: row.id,
    nombre: title(row.name),
    total: total,
    pagado: paid,
    pendiente: pending,
    currency: normalizeCurrency(row.currency || 'PEN'),
    vencimiento: row.due_date || '',
    estado: row.status || (pending > 0 ? 'activa' : 'pagada'),
    notas: row.notes || '',
    payments: (row.payments || []).map(debtPaymentShape),
  };
}

export function debtPaymentShape(row) {
  return {
    id: row.id,
    debtId: row.debt_id || row.debtId || '',
    amount: round(row.amount),
    currency: normalizeCurrency(row.currency || 'PEN'),
    paymentDate: row.payment_date || row.paymentDate || '',
    notes: row.notes || '',
    createdAt: row.created_at || row.createdAt || '',
  };
}
