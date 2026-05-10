const DEFAULT_TZ = 'America/Lima';

const COLORS = {
  comida: '#22c55e',
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

    if (request.method === 'OPTIONS') {
      return corsResponse(null, 204);
    }

    try {
      if (url.pathname === '/' || url.pathname === '/health') {
        return json(await health(env));
      }

      if (url.pathname === '/api/dashboard' && request.method === 'GET') {
        requireDashboardKey(request, env);
        return json(await dashboard(env, url.searchParams));
      }

      if (url.pathname === '/api/transactions' && request.method === 'GET') {
        requireDashboardKey(request, env);
        return json(await transactions(env, url.searchParams));
      }

      if (url.pathname === '/api/transactions' && request.method === 'POST') {
        requireAdminKey(request, env);
        const payload = await request.json();
        return json(await insertTransaction(env, payload), 201);
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

  return {
    ok: true,
    database: 'finanzas_mayeson',
    transactions: row?.total || 0,
    fixedExpenses: fixed?.total || 0,
    checkedAt: new Date().toISOString(),
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
    SELECT id, tx_date AS fecha, tx_time AS hora, type AS tipo,
           description AS desc, category AS cat, amount AS monto
    FROM transactions
    WHERE chat_id = ?
    ORDER BY tx_date DESC, tx_time DESC, created_at DESC
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
    SELECT id, tx_date AS fecha, tx_time AS hora, type AS tipo,
           description AS desc, category AS cat, amount AS monto
    FROM transactions
    WHERE chat_id = ?
    ORDER BY tx_date DESC, tx_time DESC, created_at DESC
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
    await upsertGoal(env, chatId, raw);
    goalCount++;
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

async function upsertTransaction(env, tx) {
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
      source = excluded.source,
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
  const target = Number(raw.objetivo || raw.target_amount || 0);
  const saved = Number(raw.ahorrado || raw.saved_amount || 0);
  if (!name || target <= 0) return;

  await env.DB.prepare(`
    INSERT INTO goals (id, chat_id, name, target_amount, saved_amount, updated_at)
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(chat_id, name) DO UPDATE SET
      target_amount = excluded.target_amount,
      saved_amount = excluded.saved_amount,
      updated_at = CURRENT_TIMESTAMP
  `).bind(`goal:${chatId}:${name}`, chatId, name, target, saved).run();
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

  if (!fecha || monto <= 0) {
    throw httpError(400, 'Transaccion invalida');
  }

  return {
    id: String(raw.id || `tx:${chatId}:${fecha}:${hora}:${tipo}:${cat}:${monto}:${desc}`).slice(0, 180),
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
  };
}

function requireDashboardKey(request, env) {
  const url = new URL(request.url);
  const provided = url.searchParams.get('key') || bearer(request);
  const expected = env.DASHBOARD_API_KEY;

  if (!expected || provided !== expected) {
    throw httpError(401, 'Unauthorized');
  }
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

function round(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
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
    mercado: 'comida',
    supermercado: 'comida',
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
    { cat: 'comida', words: ['kfc', 'popeyes', 'bembos', 'mcdonalds', 'supermercado', 'mercado', 'pollo', 'pizza', 'almuerzo', 'cena', 'desayuno', 'yogurt', 'leche'] },
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
