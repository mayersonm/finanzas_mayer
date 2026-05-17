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

const VALID_CATEGORIES = [
  'comida',
  'supermercado',
  'transporte',
  'servicios',
  'entretenimiento',
  'salud',
  'ropa',
  'educacion',
  'salario',
  'freelance',
  'inversion',
  'venta',
  'otro',
];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const receiptFileMatch = url.pathname.match(/^\/api\/receipts\/([^/]+)\/file$/);
    const transactionMatch = url.pathname.match(/^\/api\/transactions\/([^/]+)$/);

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

      if (url.pathname === '/api/register' && request.method === 'POST') {
        const payload = await request.json();
        return json(await registerUser(env, payload), 201);
      }

      if (url.pathname === '/api/auth/google/start' && request.method === 'GET') {
        return googleStart(request, env);
      }

      if (url.pathname === '/api/auth/google/callback' && request.method === 'GET') {
        return googleCallback(request, env);
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

      if (url.pathname === '/api/settings' && request.method === 'GET') {
        await requireDashboardAccess(request, env);
        return json(await dashboardSettings(env, url.searchParams));
      }

      if (url.pathname === '/api/settings' && request.method === 'POST') {
        await requireDashboardAccess(request, env);
        const payload = await request.json();
        return json(await updateDashboardSettings(env, payload, url.searchParams));
      }

      if (url.pathname === '/api/profile' && request.method === 'GET') {
        await requireDashboardAccess(request, env);
        return json(await profile(env, url.searchParams));
      }

      if (url.pathname === '/api/categories' && request.method === 'GET') {
        await requireDashboardAccess(request, env);
        return json(await categoryDefinitions(env, url.searchParams));
      }

      if (url.pathname === '/api/categories' && request.method === 'POST') {
        await requireDashboardAccess(request, env);
        const payload = await request.json();
        return json(await upsertCategoryDefinition(env, payload, url.searchParams), 201);
      }

      if (url.pathname === '/api/categories/delete' && request.method === 'POST') {
        await requireDashboardAccess(request, env);
        const payload = await request.json();
        return json(await disableCategoryDefinition(env, payload, url.searchParams));
      }

      if (url.pathname === '/api/system-health' && request.method === 'GET') {
        await requireDashboardAccess(request, env);
        return json(await systemHealth(env));
      }

      if (url.pathname === '/api/dashboard' && request.method === 'GET') {
        await requireDashboardAccess(request, env);
        return json(await dashboard(env, url.searchParams));
      }

      if (url.pathname === '/api/rules' && request.method === 'GET') {
        await requireDashboardOrAdminAccess(request, env);
        return json(await rulesList(env, url.searchParams));
      }

      if (url.pathname === '/api/rules/classify' && request.method === 'POST') {
        requireAdminKey(request, env);
        const payload = await request.json();
        return json(await classifyRulePayload(env, payload));
      }

      if (url.pathname === '/api/rules/budget/keys' && request.method === 'POST') {
        requireAdminKey(request, env);
        const payload = await request.json();
        return json(await budgetKeysPayload(env, payload));
      }

      if (url.pathname === '/api/rules/category' && request.method === 'POST') {
        await requireDashboardOrAdminAccess(request, env);
        const payload = await request.json();
        return json(await upsertCategoryRule(env, payload), 201);
      }

      if (url.pathname === '/api/rules/category/delete' && request.method === 'POST') {
        await requireDashboardOrAdminAccess(request, env);
        const payload = await request.json();
        return json(await deleteCategoryRule(env, payload));
      }

      if (url.pathname === '/api/rules/budget' && request.method === 'POST') {
        await requireDashboardOrAdminAccess(request, env);
        const payload = await request.json();
        return json(await upsertBudgetCategoryRule(env, payload), 201);
      }

      if (url.pathname === '/api/rules/budget/delete' && request.method === 'POST') {
        await requireDashboardOrAdminAccess(request, env);
        const payload = await request.json();
        return json(await deleteBudgetCategoryRule(env, payload));
      }

      if (url.pathname === '/api/sync' && request.method === 'POST') {
        await requireDashboardAccess(request, env);
        return json(await syncFromGas(env, url.searchParams));
      }

      if (url.pathname === '/api/transactions' && request.method === 'GET') {
        await requireDashboardAccess(request, env);
        return json(await transactions(env, url.searchParams));
      }

      if (url.pathname === '/api/users' && request.method === 'GET') {
        await requireDashboardAccess(request, env);
        return json(await usersList(env));
      }

      if (url.pathname === '/api/users/link' && request.method === 'POST') {
        requireAdminKey(request, env);
        const payload = await request.json();
        return json(await linkTelegramUser(env, payload), 201);
      }

      if (url.pathname === '/api/transactions' && request.method === 'POST') {
        requireAdminKey(request, env);
        const payload = await request.json();
        return json(await insertTransaction(env, payload), 201);
      }

      if (transactionMatch && request.method === 'DELETE') {
        await requireDashboardAccess(request, env);
        return json(await deleteTransaction(env, {
          id: decodeURIComponent(transactionMatch[1]),
          chatId: getChatId(env, url.searchParams),
          deleteFromGas: true,
        }));
      }

      if (transactionMatch && request.method === 'PATCH') {
        await requireDashboardAccess(request, env);
        const payload = await request.json();
        return json(await updateTransactionFromDashboard(env, decodeURIComponent(transactionMatch[1]), payload, url.searchParams));
      }

      if (url.pathname === '/api/transactions/delete' && request.method === 'POST') {
        requireAdminKey(request, env);
        const payload = await request.json();
        return json(await deleteTransaction(env, {
          id: String(payload.id || payload.transaction_id || payload.transactionId || '').trim(),
          chatId: String(payload.chat_id || payload.chatId || env.DEFAULT_CHAT_ID || '').trim(),
          deleteFromGas: false,
        }));
      }

      if (url.pathname === '/api/transactions/category' && request.method === 'POST') {
        requireAdminKey(request, env);
        const payload = await request.json();
        return json(await updateTransactionCategory(env, payload));
      }

      if (url.pathname === '/api/transactions/payment' && request.method === 'POST') {
        requireAdminKey(request, env);
        const payload = await request.json();
        return json(await updateTransactionPayment(env, payload));
      }

      if (url.pathname === '/api/debts' && request.method === 'POST') {
        requireAdminKey(request, env);
        const payload = await request.json();
        return json(await upsertDebtFromPayload(env, payload), 201);
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
  const debts = await env.DB.prepare("SELECT COUNT(*) AS total FROM debts WHERE status = 'activa'").first();

  return {
    ok: true,
    database: 'finanzas_mayeson',
    transactions: row?.total || 0,
    fixedExpenses: fixed?.total || 0,
    receipts: receipts?.total || 0,
    debts: debts?.total || 0,
    checkedAt: new Date().toISOString(),
  };
}

async function login(env, payload) {
  const password = String(payload?.password || '');
  const email = normalizeEmail(payload?.email || '');

  if (!password) {
    throw httpError(400, 'Password requerido');
  }

  if (email) {
    const user = await env.DB.prepare('SELECT * FROM users WHERE lower(email) = ? AND active = 1')
      .bind(email)
      .first();
    const expected = user?.password_hash || '';
    if (!user || !expected || !(await constantTimeEqual(await sha256Hex(password), expected))) {
      throw httpError(401, 'Credenciales invalidas');
    }

    return sessionForUser(env, user);
  }

  if (!(await isValidLoginPassword(env, password))) {
    throw httpError(401, 'Credenciales invalidas');
  }

  const adminUser = await ensureUserForChat(env, env.DEFAULT_CHAT_ID);
  return sessionForUser(env, {
    id: adminUser.id,
    email: adminUser.email || '',
    name: adminUser.name || adminUser.label || 'Admin',
    role: 'admin',
  });
}

async function registerUser(env, payload) {
  const email = normalizeEmail(payload?.email || '');
  const name = String(payload?.name || payload?.nombre || '').trim().slice(0, 120);
  const password = String(payload?.password || '');

  if (!email) throw httpError(400, 'email requerido');
  if (password.length < 12) throw httpError(400, 'La clave debe tener al menos 12 caracteres');

  const existing = await env.DB.prepare('SELECT id FROM users WHERE lower(email) = ?')
    .bind(email)
    .first();
  if (existing) throw httpError(409, 'Ya existe un usuario con ese correo');

  const id = `user:${(await sha256Hex(email)).slice(0, 24)}`;
  const passwordHash = await sha256Hex(password);
  await env.DB.prepare(`
    INSERT INTO users (id, email, name, role, password_hash, active, updated_at)
    VALUES (?, ?, ?, 'user', ?, 1, CURRENT_TIMESTAMP)
  `).bind(id, email, name || email, passwordHash).run();

  await env.DB.prepare(`
    INSERT OR IGNORE INTO user_settings (user_id, updated_at)
    VALUES (?, CURRENT_TIMESTAMP)
  `).bind(id).run();

  return sessionForUser(env, { id, email, name: name || email, role: 'user' });
}

async function sessionForUser(env, user) {
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + 60 * 60 * 12;
  const token = await signSessionToken(env, {
    sub: 'dashboard',
    userId: user.id || '',
    email: user.email || '',
    role: user.role || 'user',
    iat: now,
    exp: expiresAt,
  });

  return {
    ok: true,
    token,
    expiresAt,
    user: {
      id: user.id || '',
      email: user.email || '',
      name: user.name || '',
      role: user.role || 'user',
    },
  };
}

async function googleStart(request, env) {
  if (!env.GOOGLE_CLIENT_ID) throw httpError(500, 'GOOGLE_CLIENT_ID no configurado');
  const url = new URL(request.url);
  const returnTo = url.searchParams.get('return_to') || url.origin;
  const state = base64UrlEncode(JSON.stringify({ returnTo }));
  const redirectUri = googleRedirectUri(request, env);
  const auth = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  auth.searchParams.set('client_id', env.GOOGLE_CLIENT_ID);
  auth.searchParams.set('redirect_uri', redirectUri);
  auth.searchParams.set('response_type', 'code');
  auth.searchParams.set('scope', 'openid email profile');
  auth.searchParams.set('state', state);
  auth.searchParams.set('prompt', 'select_account');
  return Response.redirect(auth.toString(), 302);
}

async function googleCallback(request, env) {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    throw httpError(500, 'Google OAuth no configurado');
  }

  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state') || '';
  if (!code) throw httpError(400, 'Falta code');

  let returnTo = url.origin;
  try {
    const parsed = JSON.parse(base64UrlDecode(state));
    if (parsed.returnTo) returnTo = parsed.returnTo;
  } catch (_error) {
    returnTo = url.origin;
  }

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: googleRedirectUri(request, env),
      grant_type: 'authorization_code',
    }),
  });
  const tokenData = await tokenResponse.json();
  if (!tokenResponse.ok || !tokenData.id_token) throw httpError(401, 'Google no pudo autenticar');

  const claims = parseJwtPayload(tokenData.id_token);
  const email = normalizeEmail(claims.email || '');
  if (!email) throw httpError(400, 'Google no devolvio email');

  const id = `google:${claims.sub}`;
  await env.DB.prepare(`
    INSERT INTO users (id, email, name, google_sub, role, active, updated_at)
    VALUES (?, ?, ?, ?, 'user', 1, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      email = excluded.email,
      name = excluded.name,
      google_sub = excluded.google_sub,
      active = 1,
      updated_at = CURRENT_TIMESTAMP
  `).bind(id, email, String(claims.name || email).slice(0, 120), claims.sub).run();

  await env.DB.prepare(`
    INSERT OR IGNORE INTO user_settings (user_id, updated_at)
    VALUES (?, CURRENT_TIMESTAMP)
  `).bind(id).run();

  const session = await sessionForUser(env, {
    id,
    email,
    name: claims.name || email,
    role: 'user',
  });
  const target = new URL(returnTo);
  target.searchParams.set('session_token', session.token);
  return Response.redirect(target.toString(), 302);
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

async function dashboardSettings(env, params = new URLSearchParams()) {
  const gasConfig = await gasConfigRequest(env, 'config');
  const chatId = getChatId(env, params);
  const user = await ensureUserForChat(env, chatId);
  const userSettings = await getUserSettings(env, user.id);

  return {
    ok: true,
    user,
    config: normalizeSettingsConfig({
      ...(gasConfig.config || {}),
      ...userSettingsToConfig(userSettings),
    }),
    secrets: {
      ...(gasConfig.secrets || {}),
      workerGasApiUrl: Boolean(env.GAS_API_URL),
      workerGasApiKey: Boolean(env.GAS_API_KEY),
      workerAdminKey: Boolean(env.ADMIN_KEY),
      workerDefaultChatId: Boolean(env.DEFAULT_CHAT_ID),
      workerSessionSecret: Boolean(env.SESSION_SECRET),
      r2Bucket: Boolean(env.RECEIPTS_BUCKET),
    },
    updatedAt: gasConfig.updatedAt || new Date().toISOString(),
  };
}

async function updateDashboardSettings(env, payload, params = new URLSearchParams()) {
  const chatId = String(params.get('chat_id') || payload.chat_id || payload.chatId || env.DEFAULT_CHAT_ID || '').trim();
  const user = await ensureUserForChat(env, chatId);
  const config = normalizeSettingsConfig(payload || {});
  await upsertUserSettings(env, user.id, config);

  const gasParams = new URLSearchParams({
    creditCutoffDay: String(config.creditCutoffDay),
    creditDueDay: String(config.creditDueDay),
    creditCardName: config.creditCardName,
    receiptImageMaxBytes: String(config.receiptImageMaxBytes),
    claudeModel: config.claudeModel,
    financeEmailTo: config.financeEmailTo,
    dailyEmailTo: config.dailyEmailTo,
    monthlyEmailTo: config.monthlyEmailTo,
    yearlyEmailTo: config.yearlyEmailTo,
  });

  const gasConfig = await gasConfigRequest(env, 'update_config', gasParams);

  return {
    ok: true,
    user,
    saved: gasConfig.saved || [],
    config,
  };
}

async function profile(env, params) {
  const chatId = getChatId(env, params);
  const user = await ensureUserForChat(env, chatId);
  const settings = await getUserSettings(env, user.id);
  const links = await env.DB.prepare(`
    SELECT chat_id, label, active, updated_at
    FROM user_chat_links
    WHERE user_id = ?
    ORDER BY active DESC, updated_at DESC
  `).bind(user.id).all();

  return {
    ok: true,
    user,
    settings: userSettingsToConfig(settings),
    chatLinks: (links.results || []).map((row) => ({
      chatId: row.chat_id,
      label: row.label || `Chat ${row.chat_id}`,
      active: Boolean(row.active),
      updatedAt: row.updated_at || '',
    })),
  };
}

async function categoryDefinitions(env, params) {
  const chatId = getChatId(env, params);
  const user = await ensureUserForChat(env, chatId);
  const rows = await env.DB.prepare(`
    SELECT id, user_id, category, type, color, active, sort_order, updated_at
    FROM category_definitions
    WHERE user_id IN ('*', ?)
    ORDER BY type ASC,
      CASE WHEN user_id = ? THEN 0 ELSE 1 END,
      sort_order ASC,
      category ASC
  `).bind(user.id, user.id).all();

  return {
    ok: true,
    user,
    categories: (rows.results || []).map((row) => ({
      id: row.id,
      scope: row.user_id === '*' ? 'global' : 'user',
      category: row.category,
      type: row.type,
      color: row.color,
      active: Boolean(row.active),
      sortOrder: Number(row.sort_order || 100),
      updatedAt: row.updated_at || '',
    })),
  };
}

async function upsertCategoryDefinition(env, payload, params) {
  const chatId = String(params.get('chat_id') || payload.chat_id || payload.chatId || env.DEFAULT_CHAT_ID || '').trim();
  const user = await ensureUserForChat(env, chatId);
  const type = String(payload.type || payload.tipo || 'gasto').toLowerCase() === 'ingreso' ? 'ingreso' : 'gasto';
  const category = normalizeBaseCategory(payload.category || payload.cat || payload.nombre || '') || normalizeKey(payload.category || payload.cat || payload.nombre || '');
  const color = /^#[0-9a-f]{6}$/i.test(String(payload.color || '')) ? String(payload.color) : (COLORS[category] || COLORS.otro);
  const sortOrder = clamp(Number(payload.sortOrder || payload.sort_order || 100), 1, 999);

  if (!category) throw httpError(400, 'categoria requerida');

  const id = `catdef:${user.id}:${type}:${safeObjectSegment(category)}`.slice(0, 180);
  await env.DB.prepare(`
    INSERT INTO category_definitions (id, user_id, category, type, color, active, sort_order, updated_at)
    VALUES (?, ?, ?, ?, ?, 1, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id, category, type) DO UPDATE SET
      color = excluded.color,
      active = 1,
      sort_order = excluded.sort_order,
      updated_at = CURRENT_TIMESTAMP
  `).bind(id, user.id, category, type, color, sortOrder).run();

  return {
    ok: true,
    category: { id, scope: 'user', category, type, color, active: true, sortOrder },
  };
}

async function disableCategoryDefinition(env, payload, params) {
  const chatId = String(params.get('chat_id') || payload.chat_id || payload.chatId || env.DEFAULT_CHAT_ID || '').trim();
  const user = await ensureUserForChat(env, chatId);
  const type = String(payload.type || payload.tipo || 'gasto').toLowerCase() === 'ingreso' ? 'ingreso' : 'gasto';
  const category = normalizeBaseCategory(payload.category || payload.cat || '') || normalizeKey(payload.category || payload.cat || '');

  if (!category) throw httpError(400, 'categoria requerida');

  const result = await env.DB.prepare(`
    UPDATE category_definitions
    SET active = 0, updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ? AND category = ? AND type = ?
  `).bind(user.id, category, type).run();

  return {
    ok: true,
    deleted: true,
    category,
    type,
    changed: result.meta?.changes || 0,
  };
}

async function systemHealth(env) {
  const checks = [];
  const started = Date.now();
  const dbInfo = await health(env);

  checks.push({
    id: 'worker',
    label: 'Cloudflare Worker',
    status: 'ok',
    message: 'Worker activo y respondiendo.',
  });

  checks.push({
    id: 'd1',
    label: 'D1',
    status: 'ok',
    message: `${dbInfo.transactions} movimientos, ${dbInfo.receipts} recibos, ${dbInfo.debts} deudas.`,
  });

  checks.push({
    id: 'r2',
    label: 'R2 recibos',
    status: env.RECEIPTS_BUCKET ? 'ok' : 'error',
    message: env.RECEIPTS_BUCKET ? 'Binding RECEIPTS_BUCKET disponible.' : 'Falta binding RECEIPTS_BUCKET.',
  });

  [
    ['gasApiUrl', 'GAS_API_URL', env.GAS_API_URL],
    ['gasApiKey', 'GAS_API_KEY', env.GAS_API_KEY],
    ['adminKey', 'ADMIN_KEY', env.ADMIN_KEY],
    ['defaultChatId', 'DEFAULT_CHAT_ID', env.DEFAULT_CHAT_ID],
    ['sessionSecret', 'SESSION_SECRET', env.SESSION_SECRET],
  ].forEach(([id, label, value]) => {
    checks.push({
      id,
      label,
      status: value ? 'ok' : 'error',
      message: value ? 'Configurado.' : 'Falta configurar este secreto en Worker.',
    });
  });

  let gasHealth = null;
  if (env.GAS_API_URL && env.GAS_API_KEY) {
    try {
      gasHealth = await gasConfigRequest(env, 'health');
      checks.push({
        id: 'appsScript',
        label: 'Apps Script',
        status: 'ok',
        message: gasHealth.spreadsheetName ? `Conectado a ${gasHealth.spreadsheetName}.` : 'Apps Script responde.',
      });

      Object.entries(gasHealth.sheets || {}).forEach(([name, exists]) => {
        checks.push({
          id: `sheet:${name}`,
          label: `Sheet ${name}`,
          status: exists ? 'ok' : 'warning',
          message: exists ? 'Pestana encontrada.' : 'No existe todavia o no fue inicializada.',
        });
      });

      Object.entries(gasHealth.services || {}).forEach(([name, exists]) => {
        checks.push({
          id: `gas:${name}`,
          label: serviceLabel(name),
          status: exists ? 'ok' : 'warning',
          message: exists ? 'Configurado en Apps Script.' : 'Falta en Script Properties.',
        });
      });
    } catch (error) {
      checks.push({
        id: 'appsScript',
        label: 'Apps Script',
        status: 'error',
        message: error.message || 'No se pudo consultar Apps Script.',
      });
    }
  } else {
    checks.push({
      id: 'appsScript',
      label: 'Apps Script',
      status: 'error',
      message: 'Faltan GAS_API_URL o GAS_API_KEY en Worker.',
    });
  }

  const errors = checks.filter((item) => item.status === 'error').length;
  const warnings = checks.filter((item) => item.status === 'warning').length;

  return {
    ok: errors === 0,
    status: errors ? 'error' : warnings ? 'warning' : 'ok',
    summary: {
      total: checks.length,
      ok: checks.filter((item) => item.status === 'ok').length,
      warnings,
      errors,
      latencyMs: Date.now() - started,
    },
    checks,
    gasHealth,
    checkedAt: new Date().toISOString(),
  };
}

async function gasConfigRequest(env, action, extraParams = new URLSearchParams()) {
  if (!env.GAS_API_URL || !env.GAS_API_KEY) {
    throw httpError(400, 'Faltan secrets GAS_API_URL o GAS_API_KEY');
  }

  const url = new URL(env.GAS_API_URL);
  url.searchParams.set('action', action);
  url.searchParams.set('key', env.GAS_API_KEY);
  for (const [key, value] of extraParams.entries()) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url.toString());
  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.ok === false) {
    throw httpError(502, data.error || 'No se pudo leer configuracion desde Apps Script');
  }

  return data;
}

function normalizeSettingsConfig(value) {
  return {
    creditCutoffDay: clamp(Number(value.creditCutoffDay || 25), 1, 31),
    creditDueDay: clamp(Number(value.creditDueDay || 10), 1, 31),
    creditCardName: String(value.creditCardName || '').slice(0, 80),
    defaultCurrency: normalizeCurrency(value.defaultCurrency || value.default_currency || 'PEN'),
    defaultPaymentMethod: normalizePaymentMethod(value.defaultPaymentMethod || value.default_payment_method || 'debito') || 'debito',
    receiptImageMaxBytes: clamp(Number(value.receiptImageMaxBytes || 921600), 200000, 3000000),
    claudeModel: String(value.claudeModel || 'claude-haiku-4-5-20251001').slice(0, 120),
    claudeApiUrl: String(value.claudeApiUrl || '').slice(0, 240),
    financeEmailTo: String(value.financeEmailTo || '').slice(0, 180),
    dailyEmailTo: String(value.dailyEmailTo || '').slice(0, 180),
    monthlyEmailTo: String(value.monthlyEmailTo || '').slice(0, 180),
    yearlyEmailTo: String(value.yearlyEmailTo || '').slice(0, 180),
  };
}

function serviceLabel(name) {
  const labels = {
    telegramToken: 'Telegram token',
    workerUrl: 'Worker URL',
    claudeApiKey: 'IA API key',
    d1ApiUrl: 'D1 API URL',
    d1AdminKey: 'D1 admin key',
  };
  return labels[name] || name;
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
    WHERE t.chat_id = ?
    ORDER BY t.tx_date DESC, t.tx_time DESC, t.created_at DESC
    LIMIT 20
  `).bind(chatId).all();

  const categories = await categoriesWithSpending(env, chatId, monthKey);

  const months = await lastMonths(env, chatId, now);
  const budgets = await budgetsWithSpending(env, chatId, monthKey);
  const budgetRules = await loadBudgetRules(env, chatId);
  const fixedExpenses = await fixedExpensesList(env, chatId, monthKey);
  const debts = await debtsList(env, chatId);
  const goals = await goalsList(env, chatId);
  const emailConfig = await emailConfigFromGas(env);

  const ingresos = Number(totals?.ingresos || 0);
  const gastos = Number(totals?.gastos || 0);
  const ingresosMes = Number(monthTotals?.ingresosMes || 0);
  const gastosMes = Number(monthTotals?.gastosMes || 0);

  const alerts = smartAlerts({
    now,
    monthKey,
    ingresosMes,
    gastosMes,
    budgets,
    fixedExpenses,
    debts,
    latest: (latest.results || []).map(txShape),
  });
  const insights = smartInsights({
    ingresosMes,
    gastosMes,
    balanceMes: ingresosMes - gastosMes,
    categories,
    budgets,
    debts,
    months,
  });

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
    categorias: categories,
    budgetRules: budgetRulesForDashboard(budgetRules),
    meses: months,
    presupuestos: budgets,
    fijos: fixedExpenses,
    deudas: debts,
    gastosReales: realExpenses(fixedExpenses, budgets),
    metas: goals,
    alertas: alerts,
    insights: insights,
    emailConfig,
    source: 'd1',
    updatedAt: localIso(now),
  };
}

async function transactions(env, params) {
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
    transacciones: (rows.results || []).map(txShape),
  };
}

async function usersList(env) {
  await ensureKnownUsers(env);
  const rows = await env.DB.prepare(`
    SELECT
      l.chat_id,
      l.label,
      l.active,
      u.id AS user_id,
      u.email,
      u.name,
      u.role,
      COUNT(t.id) AS transactions,
      MAX(t.updated_at) AS lastActivity
    FROM user_chat_links l
    JOIN users u ON u.id = l.user_id
    LEFT JOIN transactions t ON t.chat_id = l.chat_id
    WHERE u.active = 1
    GROUP BY l.chat_id, l.label, l.active, u.id, u.email, u.name, u.role
    ORDER BY l.active DESC, lastActivity DESC
    LIMIT 50
  `).all();

  return {
    ok: true,
    defaultChatId: env.DEFAULT_CHAT_ID || '',
    users: (rows.results || []).map((row) => ({
      chatId: row.chat_id,
      userId: row.user_id,
      email: row.email || '',
      name: row.name || '',
      role: row.role || 'user',
      active: Boolean(row.active),
      label: row.label || row.name || (row.chat_id === env.DEFAULT_CHAT_ID ? `Principal (${row.chat_id})` : `Chat ${row.chat_id}`),
      transactions: Number(row.transactions || 0),
      lastActivity: row.lastActivity || '',
    })),
  };
}

async function linkTelegramUser(env, payload) {
  const chatId = String(payload.chat_id || payload.chatId || '').trim();
  const name = String(payload.name || payload.nombre || '').trim().slice(0, 120);
  const email = normalizeEmail(payload.email || '');
  if (!chatId) throw httpError(400, 'chat_id requerido');

  const userByEmail = email
    ? await env.DB.prepare('SELECT * FROM users WHERE lower(email) = ? AND active = 1').bind(email).first()
    : null;
  const existing = userByEmail ? {
    id: userByEmail.id,
    email: userByEmail.email || '',
    name: userByEmail.name || '',
    role: userByEmail.role || 'user',
    chatId,
    label: userByEmail.name || email,
  } : await ensureUserForChat(env, chatId);
  const nextName = name || existing.name || existing.label || `Chat ${chatId}`;
  const nextEmail = email || existing.email || '';

  await env.DB.prepare(`
    UPDATE users
    SET name = ?,
        email = CASE WHEN ? <> '' THEN ? ELSE email END,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(nextName, nextEmail, nextEmail, existing.id).run();

  await env.DB.prepare(`
    INSERT INTO user_chat_links (id, user_id, chat_id, label, active, updated_at)
    VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
    ON CONFLICT(chat_id) DO UPDATE SET
      user_id = excluded.user_id,
      label = excluded.label,
      active = 1,
      updated_at = CURRENT_TIMESTAMP
  `).bind(`link:${safeObjectSegment(chatId)}`, existing.id, chatId, nextName).run();

  return {
    ok: true,
    user: {
      ...existing,
      name: nextName,
      email: nextEmail,
      label: nextName,
    },
  };
}

async function ensureKnownUsers(env) {
  const rows = await env.DB.prepare(`
    SELECT chat_id, COUNT(*) AS total
    FROM transactions
    GROUP BY chat_id
    LIMIT 100
  `).all();

  for (const row of rows.results || []) {
    await ensureUserForChat(env, row.chat_id);
  }
}

async function ensureUserForChat(env, chatId) {
  const cleanChatId = String(chatId || env.DEFAULT_CHAT_ID || '').trim();
  if (!cleanChatId) throw httpError(400, 'chat_id requerido');

  const existing = await env.DB.prepare(`
    SELECT u.id, u.email, u.name, u.role, l.chat_id, l.label
    FROM user_chat_links l
    JOIN users u ON u.id = l.user_id
    WHERE l.chat_id = ?
    LIMIT 1
  `).bind(cleanChatId).first();

  if (existing) {
    return {
      id: existing.id,
      email: existing.email || '',
      name: existing.name || '',
      role: existing.role || 'user',
      chatId: existing.chat_id,
      label: existing.label || '',
    };
  }

  const userId = `user:${safeObjectSegment(cleanChatId)}`.slice(0, 120);
  const role = cleanChatId === String(env.DEFAULT_CHAT_ID || '').trim() ? 'admin' : 'user';
  const label = role === 'admin' ? 'Principal' : `Chat ${cleanChatId}`;

  await env.DB.prepare(`
    INSERT OR IGNORE INTO users (id, name, role, active, updated_at)
    VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)
  `).bind(userId, label, role).run();

  await env.DB.prepare(`
    INSERT OR IGNORE INTO user_chat_links (id, user_id, chat_id, label, active, updated_at)
    VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
  `).bind(`link:${safeObjectSegment(cleanChatId)}`, userId, cleanChatId, label).run();

  await env.DB.prepare(`
    INSERT OR IGNORE INTO user_settings (user_id, updated_at)
    VALUES (?, CURRENT_TIMESTAMP)
  `).bind(userId).run();

  return {
    id: userId,
    email: '',
    name: label,
    role,
    chatId: cleanChatId,
    label,
  };
}

async function getUserSettings(env, userId) {
  await env.DB.prepare(`
    INSERT OR IGNORE INTO user_settings (user_id, updated_at)
    VALUES (?, CURRENT_TIMESTAMP)
  `).bind(userId).run();

  return env.DB.prepare('SELECT * FROM user_settings WHERE user_id = ?')
    .bind(userId)
    .first();
}

async function upsertUserSettings(env, userId, config) {
  await env.DB.prepare(`
    INSERT INTO user_settings (
      user_id, credit_cutoff_day, credit_due_day, credit_card_name,
      default_currency, default_payment_method, receipt_image_max_bytes,
      email_daily, email_monthly, email_yearly, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id) DO UPDATE SET
      credit_cutoff_day = excluded.credit_cutoff_day,
      credit_due_day = excluded.credit_due_day,
      credit_card_name = excluded.credit_card_name,
      default_currency = excluded.default_currency,
      default_payment_method = excluded.default_payment_method,
      receipt_image_max_bytes = excluded.receipt_image_max_bytes,
      email_daily = excluded.email_daily,
      email_monthly = excluded.email_monthly,
      email_yearly = excluded.email_yearly,
      updated_at = CURRENT_TIMESTAMP
  `).bind(
    userId,
    config.creditCutoffDay,
    config.creditDueDay,
    config.creditCardName,
    config.defaultCurrency || 'PEN',
    config.defaultPaymentMethod || 'debito',
    config.receiptImageMaxBytes,
    config.dailyEmailTo,
    config.monthlyEmailTo,
    config.yearlyEmailTo,
  ).run();
}

function userSettingsToConfig(settings) {
  if (!settings) return {};
  return {
    creditCutoffDay: Number(settings.credit_cutoff_day || 25),
    creditDueDay: Number(settings.credit_due_day || 10),
    creditCardName: settings.credit_card_name || '',
    defaultCurrency: settings.default_currency || 'PEN',
    defaultPaymentMethod: settings.default_payment_method || 'debito',
    receiptImageMaxBytes: Number(settings.receipt_image_max_bytes || 921600),
    dailyEmailTo: settings.email_daily || '',
    monthlyEmailTo: settings.email_monthly || '',
    yearlyEmailTo: settings.email_yearly || '',
  };
}

async function rulesList(env, params) {
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

async function classifyRulePayload(env, payload) {
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

async function budgetKeysPayload(env, payload) {
  const chatId = payloadChatId(env, payload);
  const category = normalizeBaseCategory(payload.cat || payload.category || payload.budget_category || payload.budgetCategory || 'otro');
  const rules = await loadBudgetRules(env, chatId);

  return {
    ok: true,
    category,
    keys: budgetCategoryKeysFromRules(rules, category),
  };
}

async function upsertCategoryRule(env, payload) {
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

async function deleteCategoryRule(env, payload) {
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

async function upsertBudgetCategoryRule(env, payload) {
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

async function deleteBudgetCategoryRule(env, payload) {
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

async function insertTransaction(env, payload) {
  const chatId = String(payload.chat_id || env.DEFAULT_CHAT_ID || '').trim();
  if (!chatId) throw httpError(400, 'chat_id requerido');

  const tx = await normalizeTransaction(env, payload, chatId);
  await upsertTransaction(env, tx);
  return { ok: true, transaction: tx };
}

async function deleteTransaction(env, { id, chatId, deleteFromGas = false }) {
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

async function updateTransactionFromDashboard(env, id, payload, params) {
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

async function updateTransactionPayment(env, payload) {
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

async function findTransactionForPaymentUpdate(env, payload, chatId) {
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
  const category = (await classifyCategory(env, chatId, payload.cat || payload.category || 'otro', description)).category;
  const amount = parseAmount(payload.monto || payload.amount || 0);
  const receiptId = String(payload.id || `receipt_${(await sha256Hex(`${chatId}|${transactionId}|${fileName}`)).slice(0, 32)}`).slice(0, 180);
  const month = txDate.slice(0, 7) || formatMonth(new Date());
  const r2Key = `receipts/${safeObjectSegment(chatId)}/${month}/${safeObjectSegment(receiptId)}.${imageExtension(contentType)}`;
  let storage = 'd1';
  let storedR2Key = null;
  let storedBase64 = cleanedBase64;
  let storageWarning = '';

  if (env.RECEIPTS_BUCKET) {
    try {
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
    } catch (error) {
      storageWarning = `R2 no disponible, guardado en D1: ${error.message || String(error)}`;
    }
  }

  await env.DB.prepare(`
    INSERT INTO receipts (
      id, transaction_id, chat_id, storage, r2_key, image_base64, file_name, content_type, size,
      telegram_file_id, telegram_file_path, tx_date, tx_time, type,
      description, category, amount, currency, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
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
      currency = excluded.currency,
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
    normalizeCurrency(payload.currency || payload.moneda),
  ).run();

  return {
    ok: true,
    receipt: {
      id: receiptId,
      transactionId,
      fileName,
      contentType,
      size: bytes.byteLength,
      storage,
      warning: storageWarning,
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
    await upsertTransaction(env, await normalizeTransaction(env, raw, chatId));
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

  let debtCount = 0;
  for (const raw of dashData.deudas || dashData.debts || []) {
    if (await upsertDebt(env, chatId, raw)) debtCount++;
  }

  const runId = crypto.randomUUID();
  await env.DB.prepare(`
    INSERT INTO sync_runs (id, source, status, details)
    VALUES (?, 'gas', 'ok', ?)
  `).bind(runId, JSON.stringify({ txCount, budgetCount, goalCount, fixedCount, debtCount })).run();

  return {
    ok: true,
    source: 'gas',
    transactions: txCount,
    budgets: budgetCount,
    goals: goalCount,
    fixedExpenses: fixedCount,
    debts: debtCount,
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

async function deleteTransactionFromGas(env, tx) {
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
  const category = (await classifyCategory(env, chatId, raw.cat || raw.category || 'servicios', name)).category;
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

async function upsertDebtFromPayload(env, payload) {
  const chatId = String(payload.chat_id || payload.chatId || env.DEFAULT_CHAT_ID || '').trim();
  if (!chatId) throw httpError(400, 'chat_id requerido');

  const debt = normalizeDebt(payload, chatId);
  if (!debt) throw httpError(400, 'Deuda invalida');
  await saveDebt(env, debt);

  return {
    ok: true,
    debt: debtShape(debt),
  };
}

async function upsertDebt(env, chatId, raw) {
  const debt = normalizeDebt(raw, chatId);
  if (!debt) return false;
  await saveDebt(env, debt);
  return true;
}

function normalizeDebt(raw, chatId) {
  const name = normalizeKey(raw.nombre || raw.name || '');
  const totalAmount = parseAmount(raw.total || raw.total_amount || raw.totalAmount || raw.monto || raw.amount || 0);
  const paidAmount = parseAmount(raw.pagado || raw.paid_amount || raw.paidAmount || 0);
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
    due_date: dueDate,
    status,
    notes,
  };
}

async function saveDebt(env, debt) {
  await env.DB.prepare(`
    INSERT INTO debts (
      id, chat_id, name, total_amount, paid_amount, due_date, status, notes, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(chat_id, name) DO UPDATE SET
      total_amount = excluded.total_amount,
      paid_amount = excluded.paid_amount,
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
    debt.due_date || null,
    debt.status,
    debt.notes,
  ).run();
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

async function categoriesWithSpending(env, chatId, monthKey) {
  const rows = await env.DB.prepare(`
    SELECT category AS cat, description AS desc, amount
    FROM transactions
    WHERE chat_id = ?
      AND type = 'gasto'
      AND substr(tx_date, 1, 7) = ?
  `).bind(chatId, monthKey).all();

  const rules = await loadCategoryRules(env, chatId);
  const spending = {};
  for (const row of rows.results || []) {
    const cat = classifyCategoryFromLoadedRules(rules, row.cat, row.desc);
    spending[cat] = (spending[cat] || 0) + Number(row.amount || 0);
  }

  return Object.keys(spending)
    .map((cat) => ({
      cat: title(cat),
      monto: round(spending[cat]),
      color: COLORS[cat] || COLORS.otro,
    }))
    .sort((a, b) => b.monto - a.monto || a.cat.localeCompare(b.cat));
}

async function budgetsWithSpending(env, chatId, monthKey) {
  const rows = await env.DB.prepare(`
    SELECT category AS cat, limit_amount AS limite
    FROM budgets
    WHERE chat_id = ?
  `).bind(chatId).all();

  const spendingRows = await env.DB.prepare(`
    SELECT category AS cat, description AS desc, amount
    FROM transactions
    WHERE chat_id = ?
      AND type = 'gasto'
      AND substr(tx_date, 1, 7) = ?
  `).bind(chatId, monthKey).all();

  const categoryRules = await loadCategoryRules(env, chatId);
  const budgetRules = await loadBudgetRules(env, chatId);
  const spending = {};
  for (const row of spendingRows.results || []) {
    const cat = classifyCategoryFromLoadedRules(categoryRules, row.cat, row.desc);
    spending[cat] = (spending[cat] || 0) + Number(row.amount || 0);
  }

  return (rows.results || []).map((row) => ({
    cat: title(row.cat),
    limite: round(row.limite),
    gasto: round(budgetSpendWithRules(spending, row.cat, budgetRules)),
  })).sort((a, b) => b.gasto - a.gasto || a.cat.localeCompare(b.cat));
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

async function debtsList(env, chatId) {
  const rows = await env.DB.prepare(`
    SELECT id, name, total_amount, paid_amount, due_date, status, notes
    FROM debts
    WHERE chat_id = ?
    ORDER BY
      CASE WHEN status = 'activa' THEN 0 ELSE 1 END,
      CASE WHEN due_date IS NULL OR due_date = '' THEN 1 ELSE 0 END,
      due_date ASC,
      total_amount - paid_amount DESC
  `).bind(chatId).all();

  return (rows.results || []).map(debtShape);
}

function debtShape(row) {
  const total = round(row.total_amount);
  const paid = round(row.paid_amount);
  const pending = round(Math.max(total - paid, 0));

  return {
    id: row.id,
    nombre: title(row.name),
    total: total,
    pagado: paid,
    pendiente: pending,
    vencimiento: row.due_date || '',
    estado: row.status || (pending > 0 ? 'activa' : 'pagada'),
    notas: row.notes || '',
  };
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

async function normalizeTransaction(env, raw, chatId) {
  const fecha = String(raw.fecha || raw.tx_date || '').slice(0, 10);
  const hora = String(raw.hora || raw.tx_time || '00:00').slice(0, 5);
  const tipo = String(raw.tipo || raw.type || '').toLowerCase() === 'ingreso' ? 'ingreso' : 'gasto';
  const desc = String(raw.desc || raw.description || 'Sin descripcion').trim();
  const cat = (await classifyCategory(env, chatId, raw.cat || raw.category || 'otro', desc)).category;
  const monto = Math.abs(Number(raw.monto || raw.amount || 0));
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

function txShape(row) {
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

function smartAlerts({ now, ingresosMes, gastosMes, budgets, fixedExpenses, debts, latest }) {
  const alerts = [];
  const today = localDateKey(now);

  budgets.forEach((item) => {
    const spent = Number(item.gasto || 0);
    const limit = Number(item.limite || 0);
    if (limit <= 0) return;

    const pct = Math.round((spent / limit) * 100);
    if (pct >= 100) {
      alerts.push({
        level: 'danger',
        title: `Presupuesto superado: ${item.cat}`,
        message: `Vas en S/ ${round(spent)} de S/ ${round(limit)} (${pct}%).`,
      });
    } else if (pct >= 80) {
      alerts.push({
        level: 'warning',
        title: `Presupuesto cerca del limite: ${item.cat}`,
        message: `Ya usaste ${pct}% del presupuesto.`,
      });
    }
  });

  fixedExpenses
    .filter((item) => item.estado === 'pendiente')
    .slice(0, 3)
    .forEach((item) => {
      alerts.push({
        level: 'info',
        title: `Gasto fijo pendiente: ${item.nombre}`,
        message: `Falta marcar S/ ${round(item.monto)} como pagado o saltado este mes.`,
      });
    });

  debts
    .filter((item) => item.estado === 'activa' && item.vencimiento)
    .forEach((item) => {
      const days = daysBetween(today, item.vencimiento);
      if (days < 0) {
        alerts.push({
          level: 'danger',
          title: `Deuda vencida: ${item.nombre}`,
          message: `Pendiente S/ ${round(item.pendiente)} desde ${item.vencimiento}.`,
        });
      } else if (days <= 7) {
        alerts.push({
          level: 'warning',
          title: `Deuda por vencer: ${item.nombre}`,
          message: `Vence en ${days} dia${days === 1 ? '' : 's'} y queda S/ ${round(item.pendiente)}.`,
        });
      }
    });

  latest
    .filter((tx) => tx.tipo === 'gasto' && tx.paymentMethod === 'credito' && tx.paymentDueDate)
    .forEach((tx) => {
      const days = daysBetween(today, tx.paymentDueDate);
      if (days >= 0 && days <= 5) {
        alerts.push({
          level: 'warning',
          title: 'Pago de credito cercano',
          message: `${tx.desc}: S/ ${round(tx.monto)} vence el ${tx.paymentDueDate}.`,
        });
      }
    });

  if (ingresosMes > 0 && gastosMes > ingresosMes) {
    alerts.push({
      level: 'danger',
      title: 'Gastos sobre ingresos',
      message: `Este mes gastaste S/ ${round(gastosMes)} contra S/ ${round(ingresosMes)} de ingresos.`,
    });
  }

  return alerts.slice(0, 8);
}

function smartInsights({ ingresosMes, gastosMes, balanceMes, categories, budgets, debts, months }) {
  const insights = [];
  const totalDebt = debts
    .filter((item) => item.estado === 'activa')
    .reduce((total, item) => total + Number(item.pendiente || 0), 0);
  const topCategory = [...categories].sort((a, b) => Number(b.monto || 0) - Number(a.monto || 0))[0];
  const prev = months.length >= 2 ? months[months.length - 2] : null;
  const current = months.length ? months[months.length - 1] : null;

  if (topCategory && gastosMes > 0) {
    const pct = Math.round((Number(topCategory.monto || 0) / gastosMes) * 100);
    insights.push({
      title: `Mayor fuga: ${title(topCategory.cat)}`,
      message: `Representa ${pct}% del gasto del mes. Revisa si ese ritmo sigue siendo intencional.`,
    });
  }

  if (prev && current && Number(prev.gastos || 0) > 0) {
    const delta = Math.round(((Number(current.gastos || 0) - Number(prev.gastos || 0)) / Number(prev.gastos || 1)) * 100);
    insights.push({
      title: delta >= 0 ? 'Gasto acelerado' : 'Gasto mas controlado',
      message: `Vas ${Math.abs(delta)}% ${delta >= 0 ? 'por encima' : 'por debajo'} del mes anterior.`,
    });
  }

  const riskyBudget = budgets
    .filter((item) => Number(item.limite || 0) > 0)
    .map((item) => ({ ...item, pct: Math.round((Number(item.gasto || 0) / Number(item.limite || 1)) * 100) }))
    .sort((a, b) => b.pct - a.pct)[0];
  if (riskyBudget && riskyBudget.pct >= 70) {
    insights.push({
      title: `Presupuesto sensible: ${riskyBudget.cat}`,
      message: `Esta categoria ya va en ${riskyBudget.pct}% del limite.`,
    });
  }

  if (totalDebt > 0) {
    insights.push({
      title: 'Deuda pendiente',
      message: `Tienes S/ ${round(totalDebt)} pendiente. Prioriza lo que vence primero.`,
    });
  }

  if (ingresosMes > 0) {
    const savingsRate = Math.round((balanceMes / ingresosMes) * 100);
    insights.push({
      title: savingsRate >= 20 ? 'Buen margen de ahorro' : 'Margen ajustado',
      message: `Tu margen del mes es ${savingsRate}%. ${savingsRate >= 20 ? 'Buen espacio para metas.' : 'Conviene proteger caja.'}`,
    });
  }

  return insights.slice(0, 6);
}

async function requireDashboardAccess(request, env) {
  if (hasDashboardKey(request, env)) return;

  const token = bearer(request);
  if (token && await verifySessionToken(env, token)) return;

  throw httpError(401, 'Unauthorized');
}

async function requireDashboardOrAdminAccess(request, env) {
  if (hasAdminKey(request, env)) return;
  return requireDashboardAccess(request, env);
}

function hasDashboardKey(request, env) {
  const url = new URL(request.url);
  const provided = url.searchParams.get('key') || bearer(request);
  const expected = env.DASHBOARD_API_KEY;

  return Boolean(expected && provided === expected);
}

function requireAdminKey(request, env) {
  if (hasAdminKey(request, env)) return;
  throw httpError(401, 'Unauthorized');
}

function hasAdminKey(request, env) {
  const provided = request.headers.get('x-admin-key') || bearer(request);
  const expected = env.ADMIN_KEY;

  return Boolean(expected && provided === expected);
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

function googleRedirectUri(request, env) {
  if (env.GOOGLE_REDIRECT_URI) return String(env.GOOGLE_REDIRECT_URI);
  const url = new URL(request.url);
  return `${url.origin}/api/auth/google/callback`;
}

function parseJwtPayload(token) {
  const body = String(token || '').split('.')[1] || '';
  if (!body) return {};
  return JSON.parse(base64UrlDecode(body));
}

function normalizeEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
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
      'access-control-allow-methods': 'GET,POST,DELETE,OPTIONS',
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

function stableTransactionId({ rawId, chatId, fecha, hora, tipo, cat, monto, currency, desc }) {
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
    normalizeCurrency(currency),
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

function normalizePaymentMethod(value) {
  const key = normalizeKey(value);
  if (!key || key === 'desconocido' || key === 'unknown') return '';

  if (/\b(credito|credit|tc)\b/.test(key)) return 'credito';
  if (/\b(debito|debit|td|efectivo|cash|yape|plin|transferencia)\b/.test(key)) return 'debito';

  return '';
}

function normalizeDateOnly(value) {
  const text = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  return '';
}

function normalizeCurrency(value) {
  const currency = String(value || 'PEN').trim().toUpperCase();
  if (currency === 'USD') return 'USD';
  if (currency === 'PEN') return 'PEN';
  throw httpError(400, 'Moneda invalida. Solo se acepta PEN o USD.');
}

function localDateKey(date) {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: DEFAULT_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function daysBetween(fromDateKey, toDateKey) {
  const from = Date.parse(`${fromDateKey}T00:00:00Z`);
  const to = Date.parse(`${toDateKey}T00:00:00Z`);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return 9999;
  return Math.round((to - from) / 86400000);
}

async function classifyCategory(env, chatId, value, description = '') {
  const rules = await loadCategoryRules(env, chatId);
  const match = matchCategoryRule(rules, value, description);
  if (match) {
    return {
      category: match.category,
      source: match.chat_id === '*' ? 'rule_global' : 'rule_personal',
      keyword: match.keyword,
    };
  }

  return {
    category: normalizeCategory(value),
    source: 'fallback',
    keyword: '',
  };
}

async function loadCategoryRules(env, chatId) {
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

function matchCategoryRule(rules, value, description = '') {
  const text = normalizeRuleKeyword(`${value || ''} ${description || ''}`);
  if (!text) return null;

  for (const rule of rules || []) {
    const keyword = normalizeRuleKeyword(rule.keyword);
    if (keyword && text.includes(keyword)) return rule;
  }

  return null;
}

function classifyCategoryFromLoadedRules(rules, value, description = '') {
  const match = matchCategoryRule(rules, value, description);
  return match ? match.category : normalizeCategory(value);
}

async function loadBudgetRules(env, chatId) {
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

function budgetCategoryKeysFromRules(rules, category) {
  const key = normalizeBaseCategory(category);
  const included = rules[key] || [];
  return [key].concat(included).filter(Boolean);
}

function budgetSpendWithRules(spending, category, rules) {
  return budgetCategoryKeysFromRules(rules, category)
    .reduce((total, key) => total + Number(spending[key] || 0), 0);
}

function budgetRulesForDashboard(rules) {
  return Object.keys(rules || {}).flatMap((budgetCategory) => {
    return (rules[budgetCategory] || []).map((includedCategory) => ({
      budgetCategory,
      includedCategory,
    }));
  });
}

function normalizeCategory(value) {
  return normalizeBaseCategory(value) || 'otro';
}

function normalizeBaseCategory(value) {
  const key = normalizeKey(value);
  const aliases = {
    alimentacion: 'comida',
    alimento: 'comida',
    alimentos: 'comida',
    comida: 'comida',
    mercado: 'supermercado',
    supermercado: 'supermercado',
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
    inversion: 'inversion',
    venta: 'venta',
    otro: 'otro',
    otros: 'otro',
  };

  return aliases[key] || (VALID_CATEGORIES.includes(key) ? key : '');
}

function normalizeRuleKeyword(value) {
  return normalizeKey(value)
    .replace(/[^a-z0-9ñ\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function payloadChatId(env, payload) {
  const chatId = String(payload.chat_id || payload.chatId || env.DEFAULT_CHAT_ID || '').trim();
  if (!chatId) throw httpError(400, 'chat_id requerido');
  return chatId;
}

function safeRuleId(value) {
  return normalizeRuleKeyword(value)
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9ñ-]/g, '')
    .slice(0, 90) || 'rule';
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
