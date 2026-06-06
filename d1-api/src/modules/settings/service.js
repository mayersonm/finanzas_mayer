
import { COLORS } from '../../shared/constants.js';
import { httpError } from '../../shared/http.js';
import { getChatId } from '../../shared/request.js';
import { round, parseAmount } from '../../shared/money.js';
import { clamp, normalizeCurrency, normalizeInvestmentHorizon, normalizeInvestorProfile, normalizeKey, normalizePaymentMethod } from '../../shared/normalizers.js';
import { normalizeBaseCategory } from '../../shared/categories.js';
import { safeObjectSegment } from '../../shared/files.js';
import { dashboardLoginEmail } from '../../auth/service.js';

export async function dashboardSettings(env, params = new URLSearchParams()) {
  const chatId = getChatId(env, params);
  const user = await ensureUserForChat(env, chatId);
  const userSettings = await getUserSettings(env, user.id);

  return {
    ok: true,
    user,
    config: normalizeSettingsConfig(userSettingsToConfig(userSettings)),
    secrets: {
      dashboardApiKey: Boolean(env.DASHBOARD_API_KEY),
      d1AdminKey: Boolean(env.ADMIN_KEY),
      workerGasApiUrl: Boolean(env.GAS_API_URL),
      workerGasApiKey: Boolean(env.GAS_API_KEY),
      workerAdminKey: Boolean(env.ADMIN_KEY),
      workerDefaultChatId: Boolean(env.DEFAULT_CHAT_ID),
      workerSessionSecret: Boolean(env.SESSION_SECRET),
      r2Bucket: Boolean(env.RECEIPTS_BUCKET),
    },
    updatedAt: new Date().toISOString(),
  };
}

export async function updateDashboardSettings(env, payload, params = new URLSearchParams()) {
  const chatId = String(params.get('chat_id') || payload.chat_id || payload.chatId || env.DEFAULT_CHAT_ID || '').trim();
  const user = await ensureUserForChat(env, chatId);
  const config = normalizeSettingsConfig(payload || {});
  await upsertUserSettings(env, user.id, config);

  return {
    ok: true,
    user,
    saved: ['d1:user_settings'],
    config,
  };
}

export async function profile(env, params) {
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

export async function categoryDefinitions(env, params) {
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

export async function upsertCategoryDefinition(env, payload, params) {
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

export async function disableCategoryDefinition(env, payload, params) {
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

export function normalizeSettingsConfig(value) {
  const profile = normalizeInvestorProfile(value.investorProfile || value.investor_profile);
  const horizon = normalizeInvestmentHorizon(value.investmentHorizon || value.investment_horizon);

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
    savingsTargetAmount: round(Math.max(0, parseAmount(value.savingsTargetAmount ?? value.savings_target_amount ?? 0))),
    emergencyBufferAmount: round(Math.max(0, parseAmount(value.emergencyBufferAmount ?? value.emergency_buffer_amount ?? 0))),
    investorProfile: profile,
    investmentHorizon: horizon,
  };
}

export async function usersList(env) {
  await ensureUserForChat(env, env.DEFAULT_CHAT_ID);
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

export async function linkTelegramUser(env, payload) {
  const chatId = String(payload.chat_id || payload.chatId || '').trim();
  const name = String(payload.name || payload.nombre || '').trim().slice(0, 120);
  const email = String(payload.email || '').trim().toLowerCase().slice(0, 180);
  if (!chatId) throw httpError(400, 'chat_id requerido');

  const existing = await ensureUserForChat(env, chatId);
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
    UPDATE user_chat_links
    SET label = ?, active = 1, updated_at = CURRENT_TIMESTAMP
    WHERE chat_id = ?
  `).bind(nextName, chatId).run();

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

export async function ensureKnownUsers(env) {
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

export async function dashboardEmailForUser(env, userId) {
  const email = await dashboardLoginEmail(env);
  if (!email) return '';

  const owner = await env.DB.prepare('SELECT id FROM users WHERE email = ? LIMIT 1')
    .bind(email)
    .first();
  return !owner || owner.id === userId ? email : '';
}

export async function ensureUserForChat(env, chatId) {
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
    let email = existing.email || '';
    let name = existing.name || '';
    if (existing.role === 'admin') {
      const ownerEmail = await dashboardEmailForUser(env, existing.id);
      if (ownerEmail && (email !== ownerEmail || !name)) {
        email = ownerEmail;
        name = name || 'Mayerson';
        await env.DB.prepare(`
          UPDATE users
          SET email = ?, name = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(email, name, existing.id).run();
      }
    }

    return {
      id: existing.id,
      email,
      name,
      role: existing.role || 'user',
      chatId: existing.chat_id,
      label: existing.label || name || '',
    };
  }

  const userId = `user:${safeObjectSegment(cleanChatId)}`.slice(0, 120);
  const role = cleanChatId === String(env.DEFAULT_CHAT_ID || '').trim() ? 'admin' : 'user';
  const ownerEmail = role === 'admin' ? await dashboardEmailForUser(env, userId) : '';
  const label = role === 'admin' ? 'Mayerson' : `Chat ${cleanChatId}`;

  await env.DB.prepare(`
    INSERT OR IGNORE INTO users (id, email, name, role, active, updated_at)
    VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
  `).bind(userId, ownerEmail, label, role).run();

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
    email: ownerEmail,
    name: label,
    role,
    chatId: cleanChatId,
    label,
  };
}

export async function getUserSettings(env, userId) {
  await env.DB.prepare(`
    INSERT OR IGNORE INTO user_settings (user_id, updated_at)
    VALUES (?, CURRENT_TIMESTAMP)
  `).bind(userId).run();

  return env.DB.prepare('SELECT * FROM user_settings WHERE user_id = ?')
    .bind(userId)
    .first();
}

export async function upsertUserSettings(env, userId, config) {
  await env.DB.prepare(`
    INSERT INTO user_settings (
      user_id, credit_cutoff_day, credit_due_day, credit_card_name,
      default_currency, default_payment_method, receipt_image_max_bytes,
      email_daily, email_monthly, email_yearly,
      savings_target_amount, emergency_buffer_amount, investor_profile, investment_horizon,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
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
      savings_target_amount = excluded.savings_target_amount,
      emergency_buffer_amount = excluded.emergency_buffer_amount,
      investor_profile = excluded.investor_profile,
      investment_horizon = excluded.investment_horizon,
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
    config.savingsTargetAmount,
    config.emergencyBufferAmount,
    config.investorProfile,
    config.investmentHorizon,
  ).run();
}

export function userSettingsToConfig(settings) {
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
    savingsTargetAmount: Number(settings.savings_target_amount || 0),
    emergencyBufferAmount: Number(settings.emergency_buffer_amount || 0),
    investorProfile: settings.investor_profile || 'conservador',
    investmentHorizon: settings.investment_horizon || 'corto',
  };
}
