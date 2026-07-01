import { httpError } from '../../shared/http.js';
import { getChatId } from '../../shared/request.js';
import { round, parseAmount } from '../../shared/money.js';
import { getAppSetting, setAppSetting } from '../../shared/settings-store.js';
import { clamp, normalizeCurrency, normalizeDateOnly, normalizeKey, normalizePaymentMethod, title } from '../../shared/normalizers.js';
import { classifyCategory, normalizeBaseCategory, normalizeCategory } from '../../shared/categories.js';
import { stableTransactionId } from '../../shared/files.js';
import { cycleDateTimeBounds, localDateKey, payCycleFromDate, payCycleRelative, salaryCycleWindow } from '../../shared/dates.js';

export async function transactions(env, params) {
  const chatId = getChatId(env, params);
  const limit = clamp(Number(params.get('limit') || 100), 1, 500);
  const search = normalizeKey(params.get('q') || params.get('search') || '');
  const category = normalizeBaseCategory(params.get('category') || '');
  const type = String(params.get('type') || '').toLowerCase();
  const payment = normalizePaymentMethod(params.get('payment') || params.get('payment_method') || '');
  const currency = String(params.get('currency') || '').trim().toUpperCase();
  const month = String(params.get('month') || '').trim();
  const where = ['t.chat_id = ?'];
  const values = [chatId];

  if (search) {
    where.push('(lower(t.description) LIKE ? OR lower(t.category) LIKE ?)');
    values.push(`%${search}%`, `%${search}%`);
  }
  if (category) {
    where.push('t.category = ?');
    values.push(category);
  }
  if (type === 'ingreso' || type === 'gasto') {
    where.push('t.type = ?');
    values.push(type);
  }
  if (payment) {
    where.push('t.payment_method = ?');
    values.push(payment);
  }
  if (currency === 'PEN' || currency === 'USD') {
    where.push('t.currency = ?');
    values.push(currency);
  }
  if (/^\d{4}-\d{2}$/.test(month)) {
    where.push('substr(t.tx_date, 1, 7) = ?');
    values.push(month);
  }

  // Rango de fechas (para ver un ciclo, no solo un mes calendario).
  const fromDate = normalizeDateOnly(params.get('from') || '');
  const toDate = normalizeDateOnly(params.get('to') || '');
  if (fromDate) {
    where.push('t.tx_date >= ?');
    values.push(fromDate);
  }
  if (toDate) {
    where.push('t.tx_date <= ?');
    values.push(toDate);
  }

  // "Desde el cierre": excluye lo registrado antes del ultimo cierre de caja
  // (cerrado es cerrado). Usa el mismo ancla que el saldo de caja.
  const sinceClose = ['1', 'true', 'yes'].includes(String(params.get('since_close') || '').toLowerCase());
  if (sinceClose) {
    const opening = await getCashOpening(env, chatId);
    if (opening?.at) {
      where.push('t.created_at > ?');
      values.push(opening.at);
    }
  }

  // Ciclo anclado al sueldo: offset 0 = ciclo actual (desde el ultimo sueldo),
  // negativos = anteriores. El boundary es la fecha del sueldo, no el dia 22.
  let resolvedCycle = null;
  const cycleOffsetRaw = params.get('cycle_offset');
  if (cycleOffsetRaw !== null && cycleOffsetRaw !== '') {
    const offset = Math.min(0, Math.trunc(Number(cycleOffsetRaw) || 0));
    const todayKey = localDateKey(new Date());
    const salaryDates = await loadSalaryDates(env, chatId, todayKey);
    let win = salaryCycleWindow(salaryDates, todayKey, offset);
    if (!win) {
      // Sin sueldo para ese ciclo: caer a la malla 22->22.
      const grid = payCycleRelative(payCycleFromDate(new Date()), offset);
      win = { startKey: grid.startKey, endKey: offset === 0 ? todayKey : grid.endKey };
    }
    const bounds = cycleDateTimeBounds('t.tx_date', 't.tx_time', win);
    where.push(bounds.sql);
    values.push(...bounds.values);
    resolvedCycle = { offset, start: win.startKey, end: win.endKey };
  }

  const rows = await env.DB.prepare(`
    SELECT
      t.id,
      t.tx_date AS fecha,
      t.tx_time AS hora,
      t.type AS tipo,
      t.description AS desc,
      t.category AS cat,
      t.amount AS monto,
      t.currency,
      t.payment_method,
      t.payment_due_date,
      t.card_name,
      r.id AS receipt_id,
      r.file_name AS receipt_file_name,
      r.content_type AS receipt_content_type,
      r.size AS receipt_size,
      r.created_at AS receipt_uploaded_at
    FROM transactions t
    LEFT JOIN receipts r ON r.transaction_id = t.id
    WHERE ${where.join(' AND ')}
    ORDER BY t.tx_date DESC, t.tx_time DESC, t.created_at DESC
    LIMIT ?
  `).bind(...values, limit).all();

  return {
    ok: true,
    total: rows.results?.length || 0,
    limit,
    cycle: resolvedCycle,
    transacciones: (rows.results || []).map(txShape),
  };
}

// Fechas+hora de sueldo (ingreso categoria 'salario') mas recientes,
// descendente. Definen los limites de los ciclos anclados al sueldo. Si hay
// mas de un sueldo el mismo dia, se usa el mas temprano (esa es la hora en
// que "empieza" el ciclo nuevo ese dia).
export async function loadSalaryDates(env, chatId, todayKey, limit = 24) {
  const rows = await env.DB.prepare(`
    SELECT tx_date, MIN(COALESCE(NULLIF(tx_time, ''), '00:00')) AS tx_time
    FROM transactions
    WHERE chat_id = ? AND type = 'ingreso' AND category = 'salario' AND tx_date <= ?
    GROUP BY tx_date
    ORDER BY tx_date DESC
    LIMIT ?
  `).bind(chatId, todayKey, limit).all();
  return (rows.results || [])
    .filter((row) => row.tx_date)
    .map((row) => ({ date: row.tx_date, time: row.tx_time || '00:00' }));
}

export async function insertTransaction(env, payload) {
  const chatId = String(payload.chat_id || env.DEFAULT_CHAT_ID || '').trim();
  if (!chatId) throw httpError(400, 'chat_id requerido');

  const tx = await normalizeTransaction(env, payload, chatId);
  await upsertTransaction(env, tx);
  return { ok: true, transaction: tx };
}

const CASH_OPENING_PREFIX = 'cash_opening_';

// Cierra el ciclo fijando el saldo de apertura del siguiente. No crea
// movimientos: ancla la caja a un saldo real + un instante. Desde ahi la
// caja se calcula como saldo_apertura + neto de lo registrado despues.
export async function closeCashCycle(env, payload, params) {
  const chatId = getChatId(env, params);
  const real = Number(payload?.openingBalance ?? payload?.realBalance);
  if (!Number.isFinite(real)) throw httpError(400, 'openingBalance (saldo de cierre) requerido');

  const at = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const opening = { balance: round(real), at };
  await setAppSetting(env, `${CASH_OPENING_PREFIX}${chatId}`, JSON.stringify(opening));
  return { ok: true, ...opening };
}

// Lee el ancla de saldo de apertura del ciclo (o null si nunca se cerro caja).
export async function getCashOpening(env, chatId) {
  const raw = await getAppSetting(env, `${CASH_OPENING_PREFIX}${chatId}`);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.at) return null;
    return { balance: Number(parsed.balance || 0), at: String(parsed.at) };
  } catch (_error) {
    return null;
  }
}

// Deshace el cierre (vuelve al calculo acumulado de toda la historia).
export async function clearCashOpening(env, chatId) {
  await setAppSetting(env, `${CASH_OPENING_PREFIX}${chatId}`, '');
  return { ok: true };
}

// Calculo unico de la caja para dashboard y patrimonio. Si hay cierre, parte
// del saldo de apertura + neto de lo registrado despues - fijos pagados a mano
// despues del cierre; si no, usa el acumulado (ingresos - gastos - fijos
// pagados a mano) de los totales dados.
export async function computeCashBalance(env, chatId, usdRate, fallback = {}) {
  const opening = await getCashOpening(env, chatId);
  if (opening) {
    const since = await env.DB.prepare(`
      SELECT
        COALESCE(SUM(CASE
          WHEN type = 'ingreso' THEN (CASE WHEN currency = 'USD' THEN amount * ? ELSE amount END)
          WHEN type = 'gasto' THEN -(CASE WHEN currency = 'USD' THEN amount * ? ELSE amount END)
          ELSE 0 END), 0) AS neto,
        COUNT(*) AS movimientos
      FROM transactions
      WHERE chat_id = ? AND created_at > ?
    `).bind(usdRate, usdRate, chatId, opening.at).first();
    // Los gastos fijos marcados como pagados a mano no crean movimiento, asi
    // que se restan aparte: solo los marcados despues del cierre y sin un gasto
    // equivalente registrado despues (para no contarlos dos veces con el neto).
    const fixedSince = await env.DB.prepare(`
      SELECT COALESCE(SUM(CASE WHEN f.currency = 'USD' THEN f.amount * ? ELSE f.amount END), 0) AS pagado
      FROM fixed_expense_month_status s
      JOIN fixed_expenses f ON f.id = s.fixed_id AND f.chat_id = s.chat_id
      WHERE s.chat_id = ?
        AND s.status = 'pagado'
        AND s.updated_at > ?
        AND NOT EXISTS (
          SELECT 1 FROM transactions t
          WHERE t.chat_id = f.chat_id
            AND t.type = 'gasto'
            AND lower(t.description) = lower(f.name)
            AND t.created_at > ?
        )
    `).bind(usdRate, chatId, opening.at, opening.at).first();
    const neto = round(Number(since?.neto || 0));
    const fixedPaidSince = round(Number(fixedSince?.pagado || 0));
    return {
      balance: round(opening.balance + neto - fixedPaidSince),
      opening: { balance: round(opening.balance), at: opening.at, since: neto, movimientos: Number(since?.movimientos || 0) },
    };
  }
  const ingresos = Number(fallback.ingresos || 0);
  const gastos = Number(fallback.gastos || 0);
  const fixedPaid = Number(fallback.fixedPaid || 0);
  return { balance: round(ingresos - gastos - fixedPaid), opening: null };
}

export async function deleteTransaction(env, { id, chatId, deleteFromGas = false }) {
  const cleanId = String(id || '').trim();
  const cleanChatId = String(chatId || '').trim();

  if (!cleanId) throw httpError(400, 'id requerido');
  if (!cleanChatId) throw httpError(400, 'chat_id requerido');

  const tx = await env.DB.prepare('SELECT * FROM transactions WHERE id = ? AND chat_id = ?')
    .bind(cleanId, cleanChatId)
    .first();

  if (!tx) throw httpError(404, 'Transaccion no encontrada');

  let gasResult = null;
  if (deleteFromGas) {
    gasResult = await deleteTransactionFromGas(env, tx);
  }

  const receipts = await env.DB.prepare('SELECT id, storage, r2_key FROM receipts WHERE transaction_id = ?')
    .bind(cleanId)
    .all();

  if (env.RECEIPTS_BUCKET) {
    for (const receipt of receipts.results || []) {
      if (receipt.storage === 'r2' && receipt.r2_key) {
        await env.RECEIPTS_BUCKET.delete(receipt.r2_key).catch(() => undefined);
      }
    }
  }

  await env.DB.prepare('DELETE FROM receipts WHERE transaction_id = ?')
    .bind(cleanId)
    .run();

  await env.DB.prepare('DELETE FROM transactions WHERE id = ? AND chat_id = ?')
    .bind(cleanId, cleanChatId)
    .run();

  return {
    ok: true,
    deleted: true,
    id: cleanId,
    gas: gasResult,
  };
}

export async function updateTransactionFromDashboard(env, id, payload, params) {
  const chatId = String(params.get('chat_id') || payload.chat_id || payload.chatId || env.DEFAULT_CHAT_ID || '').trim();
  const cleanId = String(id || '').trim();
  if (!chatId) throw httpError(400, 'chat_id requerido');
  if (!cleanId) throw httpError(400, 'id requerido');

  const existing = await env.DB.prepare('SELECT * FROM transactions WHERE id = ? AND chat_id = ?')
    .bind(cleanId, chatId)
    .first();
  if (!existing) throw httpError(404, 'Transaccion no encontrada');

  const description = String(payload.desc ?? payload.description ?? existing.description).trim().slice(0, 240);
  const category = normalizeCategory(payload.cat ?? payload.category ?? existing.category, description);
  const amount = parseAmount(payload.monto ?? payload.amount ?? existing.amount);
  const currency = normalizeCurrency(payload.currency ?? existing.currency);
  const txDate = normalizeDateOnly(payload.fecha ?? payload.tx_date ?? existing.tx_date) || existing.tx_date;
  const txTime = String(payload.hora ?? payload.tx_time ?? existing.tx_time ?? '00:00').slice(0, 5);
  const type = String(payload.tipo ?? payload.type ?? existing.type).toLowerCase() === 'ingreso' ? 'ingreso' : 'gasto';
  const paymentMethod = normalizePaymentMethod(payload.paymentMethod ?? payload.payment_method ?? existing.payment_method) || 'debito';
  const paymentDueDate = paymentMethod === 'credito'
    ? normalizeDateOnly(payload.paymentDueDate ?? payload.payment_due_date ?? existing.payment_due_date)
    : '';
  const cardName = paymentMethod === 'credito'
    ? String(payload.cardName ?? payload.card_name ?? existing.card_name ?? '').trim().slice(0, 80)
    : '';

  if (!description) throw httpError(400, 'descripcion requerida');
  if (amount <= 0) throw httpError(400, 'monto invalido');

  await env.DB.prepare(`
    UPDATE transactions
    SET tx_date = ?,
        tx_time = ?,
        type = ?,
        description = ?,
        category = ?,
        amount = ?,
        currency = ?,
        payment_method = ?,
        payment_due_date = ?,
        card_name = ?,
        source = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND chat_id = ?
  `).bind(
    txDate,
    txTime,
    type,
    description,
    category,
    round(amount),
    currency,
    paymentMethod,
    paymentDueDate || null,
    cardName,
    existing.source && existing.source !== 'gas' ? existing.source : 'dashboard_edit',
    cleanId,
    chatId,
  ).run();

  await env.DB.prepare(`
    UPDATE receipts
    SET tx_date = ?,
        tx_time = ?,
        type = ?,
        description = ?,
        category = ?,
        amount = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE transaction_id = ?
  `).bind(txDate, txTime, type, description, category, round(amount), cleanId).run();

  return {
    ok: true,
    transaction: {
      id: cleanId,
      fecha: txDate,
      hora: txTime,
      tipo: type,
      desc: description,
      cat: category,
      monto: round(amount),
      currency,
      paymentMethod,
      paymentDueDate,
      cardName,
    },
  };
}

export async function updateTransactionCategory(env, payload) {
  const chatId = String(payload.chat_id || payload.chatId || env.DEFAULT_CHAT_ID || '').trim();
  const oldId = String(payload.old_id || payload.id || '').trim();
  const newId = String(payload.new_id || '').trim();
  const newCategory = normalizeCategory(payload.cat || payload.category || 'otro', payload.desc || payload.description || '');

  if (!chatId) throw httpError(400, 'chat_id requerido');
  if (!newCategory) throw httpError(400, 'categoria requerida');

  const existing = await findTransactionForCategoryUpdate(env, payload, chatId, oldId);
  if (!existing) throw httpError(404, 'Transaccion no encontrada');

  const targetId = (newId || stableTransactionId({
    rawId: '',
    chatId,
    fecha: existing.tx_date,
    hora: existing.tx_time,
    tipo: existing.type,
    cat: newCategory,
    monto: existing.amount,
    desc: existing.description,
  })).slice(0, 180);
  const nextSource = existing.source && existing.source !== 'gas' ? existing.source : 'telegram_edit';

  if (targetId !== existing.id) {
    await env.DB.prepare(`
      INSERT INTO transactions (
        id, chat_id, tx_date, tx_time, type, description, category, amount,
        currency, payment_method, payment_due_date, card_name, source, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        category = excluded.category,
        currency = excluded.currency,
        payment_method = excluded.payment_method,
        payment_due_date = excluded.payment_due_date,
        card_name = excluded.card_name,
        source = excluded.source,
        updated_at = CURRENT_TIMESTAMP
    `).bind(
      targetId,
      existing.chat_id,
      existing.tx_date,
      existing.tx_time,
      existing.type,
      existing.description,
      newCategory,
      existing.amount,
      normalizeCurrency(existing.currency),
      existing.payment_method || 'debito',
      existing.payment_due_date || null,
      existing.card_name || '',
      nextSource,
      existing.created_at,
    ).run();

    await env.DB.prepare(`
      UPDATE receipts
      SET transaction_id = ?, category = ?, updated_at = CURRENT_TIMESTAMP
      WHERE transaction_id = ?
    `).bind(targetId, newCategory, existing.id).run();

    await env.DB.prepare('DELETE FROM transactions WHERE id = ?')
      .bind(existing.id)
      .run();
  } else {
    await env.DB.prepare(`
      UPDATE transactions
      SET category = ?, source = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(newCategory, nextSource, existing.id).run();

    await env.DB.prepare(`
      UPDATE receipts
      SET category = ?, updated_at = CURRENT_TIMESTAMP
      WHERE transaction_id = ?
    `).bind(newCategory, existing.id).run();
  }

  return {
    ok: true,
    transaction: {
      id: targetId,
      oldId: existing.id,
      cat: newCategory,
    },
  };
}

export async function findTransactionForCategoryUpdate(env, payload, chatId, oldId) {
  if (oldId) {
    const byId = await env.DB.prepare('SELECT * FROM transactions WHERE id = ? AND chat_id = ?')
      .bind(oldId, chatId)
      .first();
    if (byId) return byId;
  }

  const fecha = String(payload.fecha || payload.tx_date || '').slice(0, 10);
  const hora = String(payload.hora || payload.tx_time || '00:00').slice(0, 5);
  const tipo = String(payload.tipo || payload.type || '').toLowerCase() === 'ingreso' ? 'ingreso' : 'gasto';
  const desc = String(payload.desc || payload.description || '').trim();
  const amount = parseAmount(payload.monto || payload.amount || 0);
  const oldCategory = normalizeCategory(payload.old_cat || payload.oldCategory || payload.previous_category || '', desc);

  if (!fecha || !desc || amount <= 0) return null;

  return env.DB.prepare(`
    SELECT *
    FROM transactions
    WHERE chat_id = ?
      AND tx_date = ?
      AND tx_time = ?
      AND type = ?
      AND lower(trim(description)) = lower(trim(?))
      AND ABS(amount - ?) < 0.005
      AND (? = '' OR category = ?)
    ORDER BY
      CASE WHEN source <> 'gas' THEN 0 ELSE 1 END,
      created_at ASC
    LIMIT 1
  `).bind(chatId, fecha, hora, tipo, desc, amount, oldCategory, oldCategory).first();
}

export async function updateTransactionPayment(env, payload) {
  const chatId = String(payload.chat_id || payload.chatId || env.DEFAULT_CHAT_ID || '').trim();
  const method = normalizePaymentMethod(payload.payment_method || payload.paymentMethod || payload.metodo_pago || payload.metodoPago);
  const dueDate = method === 'credito'
    ? normalizeDateOnly(payload.payment_due_date || payload.paymentDueDate || payload.fecha_pago || payload.fechaPago)
    : '';
  const cardName = method === 'credito'
    ? String(payload.card_name || payload.cardName || payload.tarjeta || '').trim().slice(0, 80)
    : '';

  if (!chatId) throw httpError(400, 'chat_id requerido');
  if (!method) throw httpError(400, 'payment_method requerido');

  const existing = await findTransactionForPaymentUpdate(env, payload, chatId);
  if (!existing) throw httpError(404, 'Transaccion no encontrada');

  await env.DB.prepare(`
    UPDATE transactions
    SET payment_method = ?,
        payment_due_date = ?,
        card_name = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(method, dueDate || null, cardName, existing.id).run();

  return {
    ok: true,
    transaction: {
      id: existing.id,
      paymentMethod: method,
      paymentDueDate: dueDate,
      cardName,
    },
  };
}

export async function findTransactionForPaymentUpdate(env, payload, chatId) {
  const id = String(payload.id || payload.transaction_id || payload.transactionId || '').trim();
  if (id) {
    const byId = await env.DB.prepare('SELECT * FROM transactions WHERE id = ? AND chat_id = ?')
      .bind(id, chatId)
      .first();
    if (byId) return byId;
  }

  const fecha = String(payload.fecha || payload.tx_date || '').slice(0, 10);
  const hora = String(payload.hora || payload.tx_time || '00:00').slice(0, 5);
  const tipo = String(payload.tipo || payload.type || '').toLowerCase() === 'ingreso' ? 'ingreso' : 'gasto';
  const desc = String(payload.desc || payload.description || '').trim();
  const amount = parseAmount(payload.monto || payload.amount || 0);
  const category = normalizeCategory(payload.cat || payload.category || 'otro', desc);

  if (!fecha || !desc || amount <= 0) return null;

  return env.DB.prepare(`
    SELECT *
    FROM transactions
    WHERE chat_id = ?
      AND tx_date = ?
      AND tx_time = ?
      AND type = ?
      AND lower(trim(description)) = lower(trim(?))
      AND category = ?
      AND ABS(amount - ?) < 0.005
    ORDER BY
      CASE WHEN source <> 'gas' THEN 0 ELSE 1 END,
      created_at ASC
    LIMIT 1
  `).bind(chatId, fecha, hora, tipo, desc, category, amount).first();
}

export async function deleteTransactionFromGas(env, tx) {
  if (!env.GAS_API_URL || !env.GAS_API_KEY) {
    return { ok: false, skipped: true, reason: 'GAS_API_URL o GAS_API_KEY no configurado' };
  }

  const url = new URL(env.GAS_API_URL);
  url.searchParams.set('action', 'delete_tx');
  url.searchParams.set('key', env.GAS_API_KEY);
  url.searchParams.set('chat_id', tx.chat_id);
  url.searchParams.set('id', tx.id);
  url.searchParams.set('fecha', tx.tx_date || '');
  url.searchParams.set('hora', tx.tx_time || '');
  url.searchParams.set('tipo', tx.type || 'gasto');
  url.searchParams.set('desc', tx.description || '');
  url.searchParams.set('cat', tx.category || 'otro');
  url.searchParams.set('monto', String(tx.amount || 0));

  const response = await fetch(url.toString());
  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.ok === false) {
    throw httpError(502, data.error || 'No se pudo eliminar en Sheets');
  }

  return data;
}

export async function upsertTransaction(env, tx) {
  await mergeDuplicateTransaction(env, tx);

  await env.DB.prepare(`
    INSERT INTO transactions (
      id, chat_id, tx_date, tx_time, type, description, category, amount,
      currency, payment_method, payment_due_date, card_name, source, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      tx_date = excluded.tx_date,
      tx_time = excluded.tx_time,
      type = excluded.type,
      description = excluded.description,
      category = excluded.category,
      amount = excluded.amount,
      currency = excluded.currency,
      payment_method = excluded.payment_method,
      payment_due_date = excluded.payment_due_date,
      card_name = excluded.card_name,
      source = CASE
        WHEN excluded.source = 'gas' AND transactions.source <> 'gas' THEN transactions.source
        ELSE excluded.source
      END,
      updated_at = CURRENT_TIMESTAMP
  `).bind(
    tx.id,
    tx.chat_id,
    tx.fecha,
    tx.hora,
    tx.tipo,
    tx.desc,
    tx.cat,
    tx.monto,
    tx.currency,
    tx.payment_method,
    tx.payment_due_date || null,
    tx.card_name,
    tx.source,
  ).run();
}

export async function mergeDuplicateTransaction(env, tx) {
  const duplicate = await env.DB.prepare(`
    SELECT id, source
    FROM transactions
    WHERE id <> ?
      AND chat_id = ?
      AND tx_date = ?
      AND tx_time = ?
      AND type = ?
      AND lower(trim(description)) = lower(trim(?))
      AND ABS(amount - ?) < 0.005
    ORDER BY
      CASE WHEN source <> 'gas' THEN 0 ELSE 1 END,
      created_at ASC
    LIMIT 1
  `).bind(
    tx.id,
    tx.chat_id,
    tx.fecha,
    tx.hora,
    tx.tipo,
    tx.desc,
    tx.monto,
  ).first();

  if (!duplicate) return;

  await env.DB.prepare(`
    UPDATE receipts
    SET transaction_id = ?, updated_at = CURRENT_TIMESTAMP
    WHERE transaction_id = ?
  `).bind(tx.id, duplicate.id).run();

  if (tx.source === 'gas' && duplicate.source && duplicate.source !== 'gas') {
    tx.source = duplicate.source;
  }

  await env.DB.prepare('DELETE FROM transactions WHERE id = ?')
    .bind(duplicate.id)
    .run();
}

export async function normalizeTransaction(env, raw, chatId) {
  const fecha = String(raw.fecha || raw.tx_date || '').slice(0, 10);
  const hora = String(raw.hora || raw.tx_time || '00:00').slice(0, 5);
  const tipo = String(raw.tipo || raw.type || '').toLowerCase() === 'ingreso' ? 'ingreso' : 'gasto';
  const desc = String(raw.desc || raw.description || 'Sin descripcion').trim();
  const cat = (await classifyCategory(env, chatId, raw.cat || raw.category || 'otro', desc)).category;
  const monto = Math.abs(parseAmount(raw.monto ?? raw.amount ?? 0));
  const currency = normalizeCurrency(raw.currency || raw.moneda);
  const rawId = String(raw.id || '').trim();
  const paymentMethod = normalizePaymentMethod(raw.payment_method || raw.paymentMethod || raw.metodo_pago || raw.metodoPago) || 'debito';
  const paymentDueDate = paymentMethod === 'credito'
    ? normalizeDateOnly(raw.payment_due_date || raw.paymentDueDate || raw.fecha_pago || raw.fechaPago)
    : '';
  const cardName = paymentMethod === 'credito'
    ? String(raw.card_name || raw.cardName || raw.tarjeta || '').trim().slice(0, 80)
    : '';

  if (!fecha || monto <= 0) {
    throw httpError(400, 'Transaccion invalida');
  }

  return {
    id: stableTransactionId({
      rawId,
      chatId,
      fecha,
      hora,
      tipo,
      cat,
      monto,
      currency,
      desc,
    }),
    chat_id: chatId,
    fecha,
    hora,
    tipo,
    desc,
    cat,
    monto: round(monto),
    currency,
    payment_method: paymentMethod,
    payment_due_date: paymentDueDate,
    card_name: cardName,
    source: String(raw.source || 'gas').slice(0, 40),
  };
}

export function txShape(row) {
  return {
    id: row.id,
    fecha: row.fecha,
    hora: row.hora,
    tipo: row.tipo,
    desc: row.desc,
    cat: normalizeCategory(row.cat, row.desc),
    monto: round(row.monto),
    currency: normalizeCurrency(row.currency),
    paymentMethod: row.payment_method || 'debito',
    paymentDueDate: row.payment_due_date || '',
    cardName: row.card_name || '',
    receipt: row.receipt_id ? {
      id: row.receipt_id,
      fileName: row.receipt_file_name || 'recibo',
      contentType: row.receipt_content_type || 'image/jpeg',
      size: Number(row.receipt_size || 0),
      uploadedAt: row.receipt_uploaded_at || '',
    } : undefined,
  };
}
