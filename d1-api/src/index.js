const DEFAULT_TZ = 'America/Lima';

const COLORS = {
  comida: '#22c55e',
  supermercado: '#84cc16',
  transporte: '#3b82f6',
  servicios: '#f59e0b',
  entretenimiento: '#ec4899',
  salud: '#8b5cf6',
  ropa: '#14b8a6',
  educacion: '#f97316',
  salario: '#06b6d4',
  freelance: '#a855f7',
  otro: '#6b7280',
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const receiptFileMatch = url.pathname.match(/^\/api\/receipts\/([^/]+)\/file$/);

    if (request.method === 'OPTIONS') {
      return corsResponse(null, 204);
    }

    try {
      if (url.pathname === '/' || url.pathname === '/health') {
        return json(await health(env));
      }

      if (url.pathname === '/api/login' && request.method === 'POST') {
        const payload = await request.json();
        return json(await login(env, payload));
      }

      if (url.pathname === '/api/session' && request.method === 'GET') {
        await requireDashboardAccess(request, env);
        return json({ ok: true, authenticated: true });
      }

      if (url.pathname === '/api/logout' && request.method === 'POST') {
        return json({ ok: true });
      }

      if (url.pathname === '/api/password' && request.method === 'POST') {
        await requireDashboardAccess(request, env);
        const payload = await request.json();
        return json(await changePassword(env, payload));
      }

      if (url.pathname === '/api/dashboard' && request.method === 'GET') {
        await requireDashboardAccess(request, env);
        return json(await dashboard(env, url.searchParams));
      }

      if (url.pathname === '/api/sync' && request.method === 'POST') {
        await requireDashboardAccess(request, env);
        return json(await syncFromGas(env, url.searchParams));
      }

      if (url.pathname === '/api/transactions' && request.method === 'GET') {
        await requireDashboardAccess(request, env);
        return json(await transactions(env, url.searchParams));
      }

      if (url.pathname === '/api/transactions' && request.method === 'POST') {
        requireAdminKey(request, env);
        const payload = await request.json();
        return json(await insertTransaction(env, payload), 201);
      }

      if (url.pathname === '/api/transactions/category' && request.method === 'POST') {
        requireAdminKey(request, env);
        const payload = await request.json();
        return json(await updateTransactionCategory(env, payload));
      }

      if (url.pathname === '/api/receipts' && request.method === 'POST') {
        requireAdminKey(request, env);
        const payload = await request.json();
        return json(await uploadReceipt(env, payload), 201);
      }

      if (receiptFileMatch && request.method === 'GET') {
        await requireDashboardAccess(request, env);
        return receiptFile(env, decodeURIComponent(receiptFileMatch[1]));
      }

      if (url.pathname === '/api/sync/gas' && request.method === 'POST') {
        requireAdminKey(request, env);
        return json(await syncFromGas(env, url.searchParams));
      }

      return json({ ok: false, error: 'Not found' }, 404);
    } catch (error) {
      const status = error.status || 500;
      return json({ ok: false, error: error.message || String(error) }, status);
    }
  },

  async scheduled(_event, env, ctx) {
    const params = new URLSearchParams({ limit: '500' });
    ctx.waitUntil(syncFromGas(env, params));
  },
};

async function health(env) {
  const row = await env.DB.prepare('SELECT COUNT(*) AS total FROM transactions').first();
  const fixed = await env.DB.prepare('SELECT COUNT(*) AS total FROM fixed_expenses WHERE active = 1').first();
  const receipts = await env.DB.prepare('SELECT COUNT(*) AS total FROM receipts').first();

  return {
    ok: true,
    database: 'finanzas_mayeson',
    transactions: row?.total || 0,
    fixedExpenses: fixed?.total || 0,
    receipts: receipts?.total || 0,
    checkedAt: new Date().toISOString(),
  };
}

async function login(env, payload) {
  const password = String(payload?.password || '');

  if (!password) {
    throw httpError(400, 'Password requerido');
  }

  if (!(await isValidLoginPassword(env, password))) {
    throw httpError(401, 'Credenciales invalidas');
  }

  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + 60 * 60 * 12;
  const token = await signSessionToken(env, {
    sub: 'dashboard',
    iat: now,
    exp: expiresAt,
  });

  return {
    ok: true,
    token,
    expiresAt,
  };
}

async function changePassword(env, payload) {
  const currentPassword = String(payload?.currentPassword || '');
  const newPassword = String(payload?.newPassword || '');

  if (!currentPassword || !newPassword) {
    throw httpError(400, 'Password actual y nuevo password requeridos');
  }

  if (newPassword.length < 12) {
    throw httpError(400, 'La nueva clave debe tener al menos 12 caracteres');
  }

  if (!(await isValidLoginPassword(env, currentPassword))) {
    throw httpError(401, 'Clave actual invalida');
  }

  const passwordHash = await sha256Hex(newPassword);
  await setAppSetting(env, 'dashboard_password_hash', passwordHash);

  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + 60 * 60 * 12;
  const token = await signSessionToken(env, {
    sub: 'dashboard',
    iat: now,
    exp: expiresAt,
  });

  return {
    ok: true,
    token,
    expiresAt,
  };
}

async function dashboard(env, params) {
  const chatId = getChatId(env, params);
  const now = new Date();
  const monthKey = formatMonth(now);
  const monthName = monthLongName(now);

  const totals = await env.DB.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN type = 'ingreso' THEN amount ELSE 0 END), 0) AS ingresos,
      COALESCE(SUM(CASE WHEN type = 'gasto' THEN amount ELSE 0 END), 0) AS gastos,
      COUNT(*) AS movimientos
    FROM transactions
    WHERE chat_id = ?
  `).bind(chatId).first();

  const monthTotals = await env.DB.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN type = 'ingreso' THEN amount ELSE 0 END), 0) AS ingresosMes,
      COALESCE(SUM(CASE WHEN type = 'gasto' THEN amount ELSE 0 END), 0) AS gastosMes
    FROM transactions
    WHERE chat_id = ? AND substr(tx_date, 1, 7) = ?
  `).bind(chatId, monthKey).first();

  const latest = await env.DB.prepare(`
    SELECT
      t.id,
      t.tx_date AS fecha,
      t.tx_time AS hora,
      t.type AS tipo,
      t.description AS desc,
      t.category AS cat,
      t.amount AS monto,
      r.id AS receipt_id,
      r.file_name AS receipt_file_name,
      r.content_type AS receipt_content_type,
      r.size AS receipt_size,
      r.created_at AS receipt_uploaded_at
    FROM transactions t
    LEFT JOIN receipts r ON r.transaction_id = t.id
    WHERE t.chat_id = ?
    ORDER BY t.tx_date DESC, t.tx_time DESC, t.created_at DESC
    LIMIT 20
  `).bind(chatId).all();

  const categories = await env.DB.prepare(`
    SELECT category AS cat, SUM(amount) AS monto
    FROM transactions
    WHERE chat_id = ? AND type = 'gasto' AND substr(tx_date, 1, 7) = ?
    GROUP BY category
    ORDER BY monto DESC
  `).bind(chatId, monthKey).all();

  const months = await lastMonths(env, chatId, now);
  const budgets = await budgetsWithSpending(env, chatId, monthKey);
  const fixedExpenses = await fixedExpensesList(env, chatId, monthKey);
  const goals = await goalsList(env, chatId);
  const emailConfig = await emailConfigFromGas(env);

  const ingresos = Number(totals?.ingresos || 0);
  const gastos = Number(totals?.gastos || 0);
  const ingresosMes = Number(monthTotals?.ingresosMes || 0);
  const gastosMes = Number(monthTotals?.gastosMes || 0);

  return {
    ok: true,
    balance: round(ingresos - gastos),
    ingresos: round(ingresos),
    gastos: round(gastos),
    ingresosMes: round(ingresosMes),
    gastosMes: round(gastosMes),
    balanceMes: round(ingresosMes - gastosMes),
    movimientos: Number(totals?.movimientos || 0),
    mes: monthName,
    mesKey: monthKey,
    transacciones: (latest.results || []).map(txShape),
    categorias: (categories.results || []).map((row) => ({
      cat: title(row.cat),
      monto: round(row.monto),
      color: COLORS[row.cat] || COLORS.otro,
    })),
    meses: months,
    presupuestos: budgets,
    fijos: fixedExpenses,
    gastosReales: realExpenses(fixedExpenses, budgets),
    metas: goals,
    emailConfig,
    source: 'd1',
    updatedAt: localIso(now),
  };
}

async function transactions(env, params) {
  const chatId = getChatId(env, params);
  const limit = clamp(Number(params.get('limit') || 100), 1, 500);
  const rows = await env.DB.prepare(`
    SELECT
      t.id,
      t.tx_date AS fecha,
      t.tx_time AS hora,
      t.type AS tipo,
      t.description AS desc,
      t.category AS cat,
      t.amount AS monto,
      r.id AS receipt_id,
      r.file_name AS receipt_file_name,
      r.content_type AS receipt_content_type,
      r.size AS receipt_size,
      r.created_at AS receipt_uploaded_at
    FROM transactions t
    LEFT JOIN receipts r ON r.transaction_id = t.id
    WHERE t.chat_id = ?
    ORDER BY t.tx_date DESC, t.tx_time DESC, t.created_at DESC
    LIMIT ?
  `).bind(chatId, limit).all();

  return {
    ok: true,
    total: rows.results?.length || 0,
    limit,
    transacciones: (rows.results || []).map(txShape),
  };
}

async function insertTransaction(env, payload) {
  const chatId = String(payload.chat_id || env.DEFAULT_CHAT_ID || '').trim();
  if (!chatId) throw httpError(400, 'chat_id requerido');

  const tx = normalizeTransaction(payload, chatId);
  await upsertTransaction(env, tx);
  return { ok: true, transaction: tx };
}

async function updateTransactionCategory(env, payload) {
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
        id, chat_id, tx_date, tx_time, type, description, category, amount, source, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        category = excluded.category,
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

async function findTransactionForCategoryUpdate(env, payload, chatId, oldId) {
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

async function uploadReceipt(env, payload) {
  const chatId = String(payload.chat_id || payload.chatId || env.DEFAULT_CHAT_ID || '').trim();
  const transactionId = String(payload.transaction_id || payload.transactionId || '').trim();
  const imageBase64 = String(payload.image_base64 || payload.imageBase64 || '').trim();
  const contentType = normalizeImageContentType(payload.content_type || payload.contentType || payload.mimeType);
  const fileName = safeFileName(payload.file_name || payload.fileName || `recibo.${imageExtension(contentType)}`);

  if (!chatId) throw httpError(400, 'chat_id requerido');
  if (!transactionId) throw httpError(400, 'transaction_id requerido');
  if (!imageBase64) throw httpError(400, 'image_base64 requerido');

  const cleanedBase64 = cleanBase64(imageBase64);
  const bytes = base64ToBytes(cleanedBase64);
  if (!bytes.byteLength) throw httpError(400, 'Imagen vacia');
  if (bytes.byteLength > 10 * 1024 * 1024) throw httpError(413, 'Imagen demasiado grande');

  const txDate = String(payload.fecha || payload.tx_date || '').slice(0, 10);
  const txTime = String(payload.hora || payload.tx_time || '').slice(0, 5);
  const type = String(payload.tipo || payload.type || 'gasto').toLowerCase() === 'ingreso' ? 'ingreso' : 'gasto';
  const description = String(payload.desc || payload.description || '').trim();
  const category = normalizeCategory(payload.cat || payload.category || 'otro', description);
  const amount = parseAmount(payload.monto || payload.amount || 0);
  const receiptId = String(payload.id || `receipt_${(await sha256Hex(`${chatId}|${transactionId}|${fileName}`)).slice(0, 32)}`).slice(0, 180);
  const month = txDate.slice(0, 7) || formatMonth(new Date());
  const r2Key = `receipts/${safeObjectSegment(chatId)}/${month}/${safeObjectSegment(receiptId)}.${imageExtension(contentType)}`;
  let storage = 'd1';
  let storedR2Key = null;
  let storedBase64 = cleanedBase64;

  if (env.RECEIPTS_BUCKET) {
    await env.RECEIPTS_BUCKET.put(r2Key, bytes, {
      httpMetadata: {
        contentType,
      },
      customMetadata: {
        chat_id: chatId,
        transaction_id: transactionId,
      },
    });
    storage = 'r2';
    storedR2Key = r2Key;
    storedBase64 = null;
  }

  await env.DB.prepare(`
    INSERT INTO receipts (
      id, transaction_id, chat_id, storage, r2_key, image_base64, file_name, content_type, size,
      telegram_file_id, telegram_file_path, tx_date, tx_time, type,
      description, category, amount, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(transaction_id) DO UPDATE SET
      storage = excluded.storage,
      r2_key = excluded.r2_key,
      image_base64 = excluded.image_base64,
      file_name = excluded.file_name,
      content_type = excluded.content_type,
      size = excluded.size,
      telegram_file_id = excluded.telegram_file_id,
      telegram_file_path = excluded.telegram_file_path,
      tx_date = excluded.tx_date,
      tx_time = excluded.tx_time,
      type = excluded.type,
      description = excluded.description,
      category = excluded.category,
      amount = excluded.amount,
      updated_at = CURRENT_TIMESTAMP
  `).bind(
    receiptId,
    transactionId,
    chatId,
    storage,
    storedR2Key,
    storedBase64,
    fileName,
    contentType,
    bytes.byteLength,
    String(payload.telegram_file_id || payload.telegramFileId || ''),
    String(payload.telegram_file_path || payload.telegramFilePath || ''),
    txDate,
    txTime,
    type,
    description,
    category,
    amount || null,
  ).run();

  return {
    ok: true,
    receipt: {
      id: receiptId,
      transactionId,
      fileName,
      contentType,
      size: bytes.byteLength,
    },
  };
}

async function receiptFile(env, receiptId) {
  const row = await env.DB.prepare(`
    SELECT storage, r2_key, image_base64, file_name, content_type
    FROM receipts
    WHERE id = ?
  `).bind(receiptId).first();

  if (!row) throw httpError(404, 'Recibo no encontrado');

  if (row.storage === 'r2') {
    if (!env.RECEIPTS_BUCKET) throw httpError(500, 'RECEIPTS_BUCKET no configurado');

    const object = await env.RECEIPTS_BUCKET.get(row.r2_key);
    if (!object) throw httpError(404, 'Archivo no encontrado');

    return corsResponse(object.body, 200, {
      'content-type': row.content_type || 'application/octet-stream',
      'cache-control': 'private, max-age=60',
      'content-disposition': `inline; filename="${safeHeaderFileName(row.file_name || 'recibo')}"`,
    });
  }

  if (!row.image_base64) throw httpError(404, 'Imagen no disponible');

  return corsResponse(base64ToBytes(row.image_base64), 200, {
    'content-type': row.content_type || 'application/octet-stream',
    'cache-control': 'private, max-age=60',
    'content-disposition': `inline; filename="${safeHeaderFileName(row.file_name || 'recibo')}"`,
  });
}

async function syncFromGas(env, params) {
  if (!env.GAS_API_URL || !env.GAS_API_KEY) {
    throw httpError(400, 'Faltan secrets GAS_API_URL o GAS_API_KEY');
  }

  const limit = clamp(Number(params.get('limit') || 500), 1, 500);
  const txUrl = new URL(env.GAS_API_URL);
  txUrl.searchParams.set('action', 'txs');
  txUrl.searchParams.set('key', env.GAS_API_KEY);
  txUrl.searchParams.set('limit', String(limit));

  const dashUrl = new URL(env.GAS_API_URL);
  dashUrl.searchParams.set('action', 'dashboard');
  dashUrl.searchParams.set('key', env.GAS_API_KEY);

  const [txResp, dashResp] = await Promise.all([fetch(txUrl), fetch(dashUrl)]);
  const txData = await txResp.json();
  const dashData = await dashResp.json();

  if (!txData.ok) throw httpError(502, txData.error || 'Error leyendo txs desde GAS');
  if (!dashData.ok) throw httpError(502, dashData.error || 'Error leyendo dashboard desde GAS');

  const chatId = String(env.DEFAULT_CHAT_ID || '').trim();
  if (!chatId) throw httpError(400, 'Falta secret DEFAULT_CHAT_ID');

  let txCount = 0;
  for (const raw of txData.transacciones || []) {
    await upsertTransaction(env, normalizeTransaction(raw, chatId));
    txCount++;
  }

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

  const runId = crypto.randomUUID();
  await env.DB.prepare(`
    INSERT INTO sync_runs (id, source, status, details)
    VALUES (?, 'gas', 'ok', ?)
  `).bind(runId, JSON.stringify({ txCount, budgetCount, goalCount, fixedCount })).run();

  return {
    ok: true,
    source: 'gas',
    transactions: txCount,
    budgets: budgetCount,
    goals: goalCount,
    fixedExpenses: fixedCount,
    syncedAt: new Date().toISOString(),
  };
}

async function emailConfigFromGas(env) {
  if (!env.GAS_API_URL || !env.GAS_API_KEY) return undefined;

  try {
    const url = new URL(env.GAS_API_URL);
    url.searchParams.set('action', 'dashboard');
    url.searchParams.set('key', env.GAS_API_KEY);

    const response = await fetch(url);
    const data = await response.json();
    return data?.emailConfig;
  } catch (_error) {
    return undefined;
  }
}

async function getAppSetting(env, key) {
  try {
    const row = await env.DB.prepare('SELECT value FROM app_settings WHERE key = ?')
      .bind(key)
      .first();
    return row?.value ? String(row.value) : '';
  } catch (_error) {
    return '';
  }
}

async function setAppSetting(env, key, value) {
  await env.DB.prepare(`
    INSERT INTO app_settings (key, value, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = CURRENT_TIMESTAMP
  `).bind(key, value).run();
}

async function upsertTransaction(env, tx) {
  await mergeDuplicateTransaction(env, tx);

  await env.DB.prepare(`
    INSERT INTO transactions (
      id, chat_id, tx_date, tx_time, type, description, category, amount, source, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      tx_date = excluded.tx_date,
      tx_time = excluded.tx_time,
      type = excluded.type,
      description = excluded.description,
      category = excluded.category,
      amount = excluded.amount,
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
    tx.source,
  ).run();
}

async function mergeDuplicateTransaction(env, tx) {
  const duplicate = await env.DB.prepare(`
    SELECT id, source
    FROM transactions
    WHERE id <> ?
      AND chat_id = ?
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
  `).bind(
    tx.id,
    tx.chat_id,
    tx.fecha,
    tx.hora,
    tx.tipo,
    tx.desc,
    tx.cat,
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

async function upsertBudget(env, chatId, raw) {
  const category = normalizeKey(raw.cat || raw.category || 'otro');
  const limit = Number(raw.limite || raw.limit_amount || raw.limit || 0);
  if (!category || limit <= 0) return;

  await env.DB.prepare(`
    INSERT INTO budgets (id, chat_id, category, limit_amount, updated_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(chat_id, category) DO UPDATE SET
      limit_amount = excluded.limit_amount,
      updated_at = CURRENT_TIMESTAMP
  `).bind(`budget:${chatId}:${category}`, chatId, category, limit).run();
}

async function upsertGoal(env, chatId, raw) {
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

async function upsertFixedExpense(env, chatId, raw) {
  const name = normalizeKey(raw.nombre || raw.name || '');
  const amount = Number(raw.monto || raw.amount || 0);
  const category = normalizeCategory(raw.cat || raw.category || 'servicios', name);
  if (!name || amount <= 0) return;

  await env.DB.prepare(`
    INSERT INTO fixed_expenses (id, chat_id, name, amount, category, active, updated_at)
    VALUES (?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
    ON CONFLICT(chat_id, name) DO UPDATE SET
      amount = excluded.amount,
      category = excluded.category,
      active = 1,
      updated_at = CURRENT_TIMESTAMP
  `).bind(`fixed:${chatId}:${name}`, chatId, name, amount, category).run();
}

async function lastMonths(env, chatId, now) {
  const result = [];
  const shortNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

  for (let i = 5; i >= 0; i--) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const key = formatMonth(date);
    const row = await env.DB.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN type = 'ingreso' THEN amount ELSE 0 END), 0) AS ingresos,
        COALESCE(SUM(CASE WHEN type = 'gasto' THEN amount ELSE 0 END), 0) AS gastos
      FROM transactions
      WHERE chat_id = ? AND substr(tx_date, 1, 7) = ?
    `).bind(chatId, key).first();

    result.push({
      mes: shortNames[date.getUTCMonth()],
      key,
      ingresos: round(row?.ingresos || 0),
      gastos: round(row?.gastos || 0),
    });
  }

  return result;
}

async function budgetsWithSpending(env, chatId, monthKey) {
  const rows = await env.DB.prepare(`
    SELECT
      b.category AS cat,
      b.limit_amount AS limite,
      COALESCE(SUM(t.amount), 0) AS gasto
    FROM budgets b
    LEFT JOIN transactions t
      ON t.chat_id = b.chat_id
      AND t.category = b.category
      AND t.type = 'gasto'
      AND substr(t.tx_date, 1, 7) = ?
    WHERE b.chat_id = ?
    GROUP BY b.category, b.limit_amount
    ORDER BY gasto DESC, b.category ASC
  `).bind(monthKey, chatId).all();

  return (rows.results || []).map((row) => ({
    cat: title(row.cat),
    limite: round(row.limite),
    gasto: round(row.gasto),
  }));
}

async function fixedExpensesList(env, chatId, monthKey) {
  const rows = await env.DB.prepare(`
    SELECT
      f.name AS nombre,
      f.amount AS monto,
      f.category AS cat,
      EXISTS (
        SELECT 1
        FROM transactions t
        WHERE t.chat_id = f.chat_id
          AND t.type = 'gasto'
          AND substr(t.tx_date, 1, 7) = ?
          AND lower(t.description) = lower(f.name)
      ) AS pagadoMes
    FROM fixed_expenses f
    WHERE f.chat_id = ? AND f.active = 1
    ORDER BY f.amount DESC, f.name ASC
  `).bind(monthKey, chatId).all();

  return (rows.results || []).map((row) => ({
    nombre: title(row.nombre),
    monto: round(row.monto),
    cat: title(row.cat),
    color: COLORS[row.cat] || COLORS.otro,
    pagadoMes: Boolean(row.pagadoMes),
    saltadoMes: false,
    estado: row.pagadoMes ? 'pagado' : 'pendiente',
  }));
}

function realExpenses(fixedExpenses, budgets) {
  const totalFijos = fixedExpenses.reduce((total, item) => total + Number(item.monto || 0), 0);
  const totalPresupuesto = budgets.reduce((total, item) => {
    const spent = Number(item.gasto || 0);
    const limit = Number(item.limite || 0);
    return total + (spent > 0 ? spent : limit);
  }, 0);

  return {
    totalFijos: round(totalFijos),
    totalPresupuesto: round(totalPresupuesto),
    total: round(totalFijos + totalPresupuesto),
    regla: 'budget_spent_or_limit',
  };
}

async function goalsList(env, chatId) {
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

function normalizeTransaction(raw, chatId) {
  const fecha = String(raw.fecha || raw.tx_date || '').slice(0, 10);
  const hora = String(raw.hora || raw.tx_time || '00:00').slice(0, 5);
  const tipo = String(raw.tipo || raw.type || '').toLowerCase() === 'ingreso' ? 'ingreso' : 'gasto';
  const desc = String(raw.desc || raw.description || 'Sin descripcion').trim();
  const cat = normalizeCategory(raw.cat || raw.category || 'otro', desc);
  const monto = Math.abs(Number(raw.monto || raw.amount || 0));
  const rawId = String(raw.id || '').trim();

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
      desc,
    }),
    chat_id: chatId,
    fecha,
    hora,
    tipo,
    desc,
    cat,
    monto: round(monto),
    source: String(raw.source || 'gas').slice(0, 40),
  };
}

function txShape(row) {
  return {
    id: row.id,
    fecha: row.fecha,
    hora: row.hora,
    tipo: row.tipo,
    desc: row.desc,
    cat: row.cat,
    monto: round(row.monto),
    receipt: row.receipt_id ? {
      id: row.receipt_id,
      fileName: row.receipt_file_name || 'recibo',
      contentType: row.receipt_content_type || 'image/jpeg',
      size: Number(row.receipt_size || 0),
      uploadedAt: row.receipt_uploaded_at || '',
    } : undefined,
  };
}

async function requireDashboardAccess(request, env) {
  if (hasDashboardKey(request, env)) return;

  const token = bearer(request);
  if (token && await verifySessionToken(env, token)) return;

  throw httpError(401, 'Unauthorized');
}

function hasDashboardKey(request, env) {
  const url = new URL(request.url);
  const provided = url.searchParams.get('key') || bearer(request);
  const expected = env.DASHBOARD_API_KEY;

  return Boolean(expected && provided === expected);
}

function requireAdminKey(request, env) {
  const provided = request.headers.get('x-admin-key') || bearer(request);
  const expected = env.ADMIN_KEY;

  if (!expected || provided !== expected) {
    throw httpError(401, 'Unauthorized');
  }
}

function bearer(request) {
  const header = request.headers.get('authorization') || '';
  return header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
}

async function isValidLoginPassword(env, password) {
  const storedHash = await getAppSetting(env, 'dashboard_password_hash');
  if (storedHash) {
    const providedHash = await sha256Hex(password);
    return constantTimeEqual(providedHash, storedHash);
  }

  if (env.LOGIN_PASSWORD_HASH) {
    const providedHash = await sha256Hex(password);
    return constantTimeEqual(providedHash, String(env.LOGIN_PASSWORD_HASH).toLowerCase());
  }

  if (env.LOGIN_PASSWORD) {
    return constantTimeEqual(password, String(env.LOGIN_PASSWORD));
  }

  throw httpError(500, 'LOGIN_PASSWORD o LOGIN_PASSWORD_HASH no configurado');
}

async function signSessionToken(env, payload) {
  const body = base64UrlEncode(JSON.stringify(payload));
  const signature = await hmacSha256(body, sessionSecret(env));
  return `${body}.${signature}`;
}

async function verifySessionToken(env, token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 2) return false;

  const [body, signature] = parts;
  const expected = await hmacSha256(body, sessionSecret(env));
  if (!constantTimeEqual(signature, expected)) return false;

  try {
    const payload = JSON.parse(base64UrlDecode(body));
    const now = Math.floor(Date.now() / 1000);
    return payload?.sub === 'dashboard' && Number(payload.exp || 0) > now;
  } catch (_error) {
    return false;
  }
}

function sessionSecret(env) {
  const secret = env.SESSION_SECRET;
  if (!secret) throw httpError(500, 'SESSION_SECRET no configurado');
  return String(secret);
}

function getChatId(env, params) {
  const chatId = String(params.get('chat_id') || env.DEFAULT_CHAT_ID || '').trim();
  if (!chatId) throw httpError(400, 'Falta chat_id o DEFAULT_CHAT_ID');
  return chatId;
}

function json(data, status = 200) {
  return corsResponse(JSON.stringify(data), status, {
    'content-type': 'application/json; charset=utf-8',
  });
}

function corsResponse(body, status = 200, headers = {}) {
  return new Response(body, {
    status,
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-headers': 'content-type,authorization,x-admin-key',
      ...headers,
    },
  });
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

async function hmacSha256(value, secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    utf8Bytes(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, utf8Bytes(value));
  return base64UrlEncodeBytes(new Uint8Array(signature));
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest('SHA-256', utf8Bytes(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function utf8Bytes(value) {
  return new TextEncoder().encode(String(value));
}

function base64UrlEncode(value) {
  return base64UrlEncodeBytes(utf8Bytes(value));
}

function base64UrlEncodeBytes(bytes) {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlDecode(value) {
  const normalized = String(value || '')
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function constantTimeEqual(a, b) {
  const left = String(a || '');
  const right = String(b || '');
  if (!left || !right) return false;

  let diff = left.length ^ right.length;
  const max = Math.max(left.length, right.length);

  for (let i = 0; i < max; i++) {
    diff |= left.charCodeAt(i % left.length) ^ right.charCodeAt(i % right.length);
  }

  return diff === 0;
}

function round(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function parseAmount(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;

  const cleaned = String(value || '')
    .replace(/[^0-9,.-]/g, '')
    .replace(',', '.');
  const parsed = Number(cleaned);

  return Number.isFinite(parsed) ? parsed : 0;
}

function stableTransactionId({ rawId, chatId, fecha, hora, tipo, cat, monto, desc }) {
  const provided = String(rawId || '').trim();
  if (provided && !/^\d+$/.test(provided) && !/^tx_[a-f0-9]{32}$/i.test(provided)) {
    return provided.slice(0, 180);
  }

  return [
    'tx',
    chatId,
    fecha,
    hora,
    tipo,
    cat,
    round(monto),
    desc,
  ].join(':').slice(0, 180);
}

function cleanBase64(value) {
  return String(value || '')
    .replace(/^data:[^;]+;base64,/i, '')
    .replace(/\s/g, '');
}

function base64ToBytes(value) {
  const cleaned = cleanBase64(value);

  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

function normalizeImageContentType(value) {
  const contentType = String(value || '').toLowerCase();
  if (contentType === 'image/png') return 'image/png';
  if (contentType === 'image/webp') return 'image/webp';
  return 'image/jpeg';
}

function imageExtension(contentType) {
  if (contentType === 'image/png') return 'png';
  if (contentType === 'image/webp') return 'webp';
  return 'jpg';
}

function safeObjectSegment(value) {
  return String(value || 'item')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || 'item';
}

function safeFileName(value) {
  const name = String(value || 'recibo')
    .split(/[\\/]/)
    .pop()
    .replace(/[\r\n"]/g, '')
    .trim();

  return name.slice(0, 120) || 'recibo';
}

function safeHeaderFileName(value) {
  return safeFileName(value).replace(/[^\x20-\x7E]/g, '');
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.trunc(value)));
}

function normalizeKey(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeCategory(value, description = '') {
  const rawCategory = normalizeKey(value);
  const text = `${rawCategory} ${normalizeKey(description)}`.trim();
  const direct = {
    alimentacion: 'comida',
    alimento: 'comida',
    alimentos: 'comida',
    comida: 'comida',
    almuerzo: 'comida',
    cena: 'comida',
    desayuno: 'comida',
    merienda: 'comida',
    snack: 'comida',
    cafe: 'comida',
    restaurant: 'comida',
    restaurante: 'comida',
    mercado: 'supermercado',
    supermercado: 'supermercado',
    super: 'supermercado',
    wong: 'supermercado',
    metro: 'supermercado',
    tottus: 'supermercado',
    makro: 'supermercado',
    vivanda: 'supermercado',
    kfc: 'comida',
    popeyes: 'comida',
    bembos: 'comida',
    mcdonalds: 'comida',
    pizza: 'comida',
    pollo: 'comida',
    transporte: 'transporte',
    taxi: 'transporte',
    bus: 'transporte',
    uber: 'transporte',
    didi: 'transporte',
    indrive: 'transporte',
    gasolina: 'transporte',
    combustible: 'transporte',
    carro: 'transporte',
    peaje: 'transporte',
    estacionamiento: 'transporte',
    servicios: 'servicios',
    servicio: 'servicios',
    luz: 'servicios',
    agua: 'servicios',
    internet: 'servicios',
    alquiler: 'servicios',
    renta: 'servicios',
    telefono: 'servicios',
    celular: 'servicios',
    gas: 'servicios',
    entretenimiento: 'entretenimiento',
    cine: 'entretenimiento',
    netflix: 'entretenimiento',
    spotify: 'entretenimiento',
    juegos: 'entretenimiento',
    juego: 'entretenimiento',
    steam: 'entretenimiento',
    disney: 'entretenimiento',
    salud: 'salud',
    medico: 'salud',
    farmacia: 'salud',
    doctor: 'salud',
    clinica: 'salud',
    medicina: 'salud',
    ropa: 'ropa',
    vestir: 'ropa',
    zapatillas: 'ropa',
    zapatos: 'ropa',
    educacion: 'educacion',
    curso: 'educacion',
    cursos: 'educacion',
    libro: 'educacion',
    libros: 'educacion',
    universidad: 'educacion',
    salario: 'salario',
    sueldo: 'salario',
    trabajo: 'salario',
    planilla: 'salario',
    freelance: 'freelance',
    proyecto: 'freelance',
    cliente: 'freelance',
    inversion: 'inversion',
    venta: 'venta',
    otro: 'otro',
    otros: 'otro',
  };

  if (direct[rawCategory]) return direct[rawCategory];

  const rules = [
    { cat: 'supermercado', words: ['supermercado', 'mercado', 'wong', 'metro', 'tottus', 'makro', 'vivanda', 'plaza vea'] },
    { cat: 'comida', words: ['kfc', 'popeyes', 'bembos', 'mcdonalds', 'pollo', 'pizza', 'almuerzo', 'cena', 'desayuno', 'yogurt', 'leche'] },
    { cat: 'transporte', words: ['taxi', 'uber', 'didi', 'indrive', 'gasolina', 'combustible', 'peaje', 'estacionamiento', 'carro'] },
    { cat: 'servicios', words: ['internet', 'alquiler', 'renta', 'luz', 'agua', 'telefono', 'celular', 'recibo de gas'] },
    { cat: 'entretenimiento', words: ['netflix', 'spotify', 'juegos', 'steam', 'cine', 'disney'] },
    { cat: 'salud', words: ['farmacia', 'medicina', 'doctor', 'clinica', 'medico'] },
    { cat: 'ropa', words: ['zapatilla', 'zapato', 'camisa', 'polo', 'pantalon'] },
    { cat: 'educacion', words: ['curso', 'libro', 'universidad', 'clase'] },
  ];

  for (const rule of rules) {
    if (rule.words.some((word) => text.includes(word))) return rule.cat;
  }

  return rawCategory || 'otro';
}

function title(value) {
  return normalizeKey(value)
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatMonth(date) {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}`;
}

function monthLongName(date) {
  return [
    'Enero',
    'Febrero',
    'Marzo',
    'Abril',
    'Mayo',
    'Junio',
    'Julio',
    'Agosto',
    'Septiembre',
    'Octubre',
    'Noviembre',
    'Diciembre',
  ][date.getMonth()];
}

function localIso(date) {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: DEFAULT_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date).replace(' ', 'T');
}
