
import { httpError } from '../shared/http.js';
import { base64UrlDecode, base64UrlEncode, constantTimeEqual, hmacSha256, sha256Hex } from '../shared/crypto.js';
import { getAppSetting, setAppSetting } from '../shared/settings-store.js';

export async function login(env, payload) {
  const email = String(payload?.email || '').trim().toLowerCase();
  const password = String(payload?.password || '');
  const expectedEmail = await dashboardLoginEmail(env);

  if (email && email !== expectedEmail) {
    throw httpError(401, 'Credenciales invalidas');
  }
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
    email: expectedEmail,
    iat: now,
    exp: expiresAt,
  });

  return {
    ok: true,
    token,
    expiresAt,
    user: {
      email: expectedEmail,
      name: 'Mayerson',
    },
  };
}

export async function changePassword(env, payload) {
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

export async function dashboardLoginEmail(env) {
  const stored = String(await getAppSetting(env, 'dashboard_login_email') || '').trim().toLowerCase();
  const configured = String(env.LOGIN_EMAIL || env.DASHBOARD_LOGIN_EMAIL || '').trim().toLowerCase();
  return stored || configured || 'mayersonm@gmail.com';
}

export async function requireDashboardAccess(request, env) {
  if (hasDashboardKey(request, env)) return;

  const token = bearer(request);
  if (token && await verifySessionToken(env, token)) return;

  throw httpError(401, 'Unauthorized');
}

export async function requireDashboardOrAdminAccess(request, env) {
  if (hasAdminKey(request, env)) return;
  return requireDashboardAccess(request, env);
}

export function hasDashboardKey(request, env) {
  const url = new URL(request.url);
  const provided = url.searchParams.get('key') || bearer(request);
  const expected = env.DASHBOARD_API_KEY;

  return Boolean(expected && provided === expected);
}

export function requireAdminKey(request, env) {
  if (hasAdminKey(request, env)) return;
  throw httpError(401, 'Unauthorized');
}

export function hasAdminKey(request, env) {
  const provided = request.headers.get('x-admin-key') || bearer(request);
  const expected = env.ADMIN_KEY;

  return Boolean(expected && provided === expected);
}

export function bearer(request) {
  const header = request.headers.get('authorization') || '';
  return header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
}

export async function isValidLoginPassword(env, password) {
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

export async function signSessionToken(env, payload) {
  const body = base64UrlEncode(JSON.stringify(payload));
  const signature = await hmacSha256(body, sessionSecret(env));
  return `${body}.${signature}`;
}

export async function verifySessionToken(env, token) {
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

export function sessionSecret(env) {
  const secret = env.SESSION_SECRET;
  if (!secret) throw httpError(500, 'SESSION_SECRET no configurado');
  return String(secret);
}
