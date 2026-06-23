
import { httpError } from '../shared/http.js';
import { base64UrlDecode, base64UrlEncode, constantTimeEqual, hashPassword, hmacSha1Bytes, hmacSha256, sha256Hex, verifyPassword } from '../shared/crypto.js';
import { getAppSetting, setAppSetting } from '../shared/settings-store.js';
import { gasConfigRequest } from '../modules/system/gas.js';

const RESET_TTL_SECONDS = 15 * 60;
const RESET_MAX_ATTEMPTS = 5;

const TOTP_ISSUER = 'Finanzas Mayeson';
const TOTP_PERIOD_SECONDS = 30;
const TOTP_DIGITS = 6;
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

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

  if (await isTwoFactorEnabled(env)) {
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = now + 60 * 5;
    const challengeToken = await signToken(env, {
      sub: 'dashboard_2fa',
      email: expectedEmail,
      iat: now,
      exp: expiresAt,
    });

    return {
      ok: true,
      requires2fa: true,
      challengeToken,
      expiresAt,
    };
  }

  return createDashboardSession(env, expectedEmail);
}

export async function verifyTwoFactorLogin(env, payload) {
  const challengeToken = String(payload?.challengeToken || payload?.challenge_token || '').trim();
  const code = String(payload?.code || payload?.otp || '').trim();
  if (!challengeToken || !code) throw httpError(400, 'Codigo 2FA requerido');

  const challenge = await verifyTokenPayload(env, challengeToken, 'dashboard_2fa');
  if (!challenge) throw httpError(401, 'Sesion 2FA expirada');

  const secret = await getTwoFactorSecret(env);
  if (!secret || !(await verifyTotp(secret, code))) {
    throw httpError(401, 'Codigo 2FA invalido');
  }

  return createDashboardSession(env, String(challenge.email || await dashboardLoginEmail(env)));
}

export async function twoFactorStatus(env) {
  const enabled = await isTwoFactorEnabled(env);
  const pending = Boolean(await getAppSetting(env, 'dashboard_2fa_pending_secret'));
  return {
    ok: true,
    enabled,
    pending,
    configured: enabled,
  };
}

export async function setupTwoFactor(env) {
  const email = await dashboardLoginEmail(env);
  const secret = generateBase32Secret();
  await setAppSetting(env, 'dashboard_2fa_pending_secret', secret);

  const label = encodeURIComponent(`${TOTP_ISSUER}:${email}`);
  const issuer = encodeURIComponent(TOTP_ISSUER);
  const otpauthUrl = `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_PERIOD_SECONDS}`;

  return {
    ok: true,
    secret,
    otpauthUrl,
    issuer: TOTP_ISSUER,
    account: email,
  };
}

export async function enableTwoFactor(env, payload) {
  const code = String(payload?.code || payload?.otp || '').trim();
  const secret = await getAppSetting(env, 'dashboard_2fa_pending_secret');
  if (!secret) throw httpError(400, 'Primero genera el 2FA');
  if (!(await verifyTotp(secret, code))) throw httpError(401, 'Codigo 2FA invalido');

  await setAppSetting(env, 'dashboard_2fa_secret', secret);
  await setAppSetting(env, 'dashboard_2fa_enabled', 'true');
  await setAppSetting(env, 'dashboard_2fa_pending_secret', '');

  return { ok: true, enabled: true };
}

export async function disableTwoFactor(env, payload) {
  const password = String(payload?.password || payload?.currentPassword || '').trim();
  const code = String(payload?.code || payload?.otp || '').trim();
  if (!password) throw httpError(400, 'Clave requerida');
  if (!(await isValidLoginPassword(env, password))) throw httpError(401, 'Clave invalida');

  const secret = await getTwoFactorSecret(env);
  if (secret && !(await verifyTotp(secret, code))) throw httpError(401, 'Codigo 2FA invalido');

  await setAppSetting(env, 'dashboard_2fa_enabled', 'false');
  await setAppSetting(env, 'dashboard_2fa_secret', '');
  await setAppSetting(env, 'dashboard_2fa_pending_secret', '');

  return { ok: true, enabled: false };
}

async function createDashboardSession(env, email) {
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + 60 * 60 * 12;
  const token = await signToken(env, {
    sub: 'dashboard',
    email,
    iat: now,
    exp: expiresAt,
  });

  return {
    ok: true,
    token,
    expiresAt,
    user: {
      email,
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

  const passwordHash = await hashPassword(newPassword);
  await setAppSetting(env, 'dashboard_password_hash', passwordHash);

  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + 60 * 60 * 12;
  const token = await signToken(env, {
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

// Genera y envia por correo un codigo de 6 digitos para recuperar la clave.
// Respuesta uniforme para no revelar si el correo corresponde a la cuenta.
export async function requestPasswordReset(env, payload) {
  const email = String(payload?.email || '').trim().toLowerCase();
  const expectedEmail = await dashboardLoginEmail(env);
  const genericOk = { ok: true, message: 'Si el correo es valido, te enviaremos un codigo.' };
  if (!email || email !== expectedEmail) return genericOk;

  const code = generateResetCode();
  const codeHash = await sha256Hex(code);
  const expiresAt = Math.floor(Date.now() / 1000) + RESET_TTL_SECONDS;
  await setAppSetting(env, 'password_reset_code_hash', codeHash);
  await setAppSetting(env, 'password_reset_expires', String(expiresAt));
  await setAppSetting(env, 'password_reset_attempts', '0');

  try {
    const params = new URLSearchParams({ to: expectedEmail, code });
    await gasConfigRequest(env, 'send_password_reset', params);
  } catch (_error) {
    // No revelamos detalles del envio; el usuario puede reintentar.
  }

  return genericOk;
}

// Valida el codigo del correo y actualiza la clave. No inicia sesion:
// el usuario entra luego con su nueva clave (y su 2FA, si lo tiene activo).
export async function confirmPasswordReset(env, payload) {
  const code = String(payload?.code || '').replace(/\s+/g, '');
  const newPassword = String(payload?.newPassword || '');
  if (!code || !newPassword) throw httpError(400, 'Codigo y nueva clave requeridos');
  if (newPassword.length < 12) throw httpError(400, 'La nueva clave debe tener al menos 12 caracteres');

  const storedHash = await getAppSetting(env, 'password_reset_code_hash');
  const expiresAt = Number(await getAppSetting(env, 'password_reset_expires') || 0);
  const attempts = Number(await getAppSetting(env, 'password_reset_attempts') || 0);

  if (!storedHash || !expiresAt) throw httpError(400, 'No hay recuperacion pendiente. Solicita un codigo.');
  if (Math.floor(Date.now() / 1000) > expiresAt) {
    await clearPasswordReset(env);
    throw httpError(400, 'El codigo expiro. Solicita uno nuevo.');
  }
  if (attempts >= RESET_MAX_ATTEMPTS) {
    await clearPasswordReset(env);
    throw httpError(429, 'Demasiados intentos. Solicita un codigo nuevo.');
  }

  const providedHash = await sha256Hex(code);
  if (!constantTimeEqual(providedHash, storedHash)) {
    await setAppSetting(env, 'password_reset_attempts', String(attempts + 1));
    throw httpError(400, 'Codigo invalido');
  }

  await setAppSetting(env, 'dashboard_password_hash', await hashPassword(newPassword));
  await clearPasswordReset(env);
  return { ok: true, message: 'Clave actualizada. Inicia sesion con tu nueva clave.' };
}

function generateResetCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  const num = ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0;
  return String(num % 1000000).padStart(6, '0');
}

async function clearPasswordReset(env) {
  await setAppSetting(env, 'password_reset_code_hash', '');
  await setAppSetting(env, 'password_reset_expires', '');
  await setAppSetting(env, 'password_reset_attempts', '0');
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
    // Verificacion solamente: nada de re-hash en el path de login (un PBKDF2 extra
    // aqui puede exceder el limite de CPU del Worker y abortar el inicio de sesion).
    const { valid } = await verifyPassword(password, storedHash);
    return valid;
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
  return signToken(env, payload);
}

export async function signToken(env, payload) {
  const body = base64UrlEncode(JSON.stringify(payload));
  const signature = await hmacSha256(body, sessionSecret(env));
  return `${body}.${signature}`;
}

export async function verifySessionToken(env, token) {
  return Boolean(await verifyTokenPayload(env, token, 'dashboard'));
}

export async function verifyTokenPayload(env, token, expectedSub) {
  const parts = String(token || '').split('.');
  if (parts.length !== 2) return null;

  const [body, signature] = parts;
  const expected = await hmacSha256(body, sessionSecret(env));
  if (!constantTimeEqual(signature, expected)) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(body));
    const now = Math.floor(Date.now() / 1000);
    if (payload?.sub !== expectedSub || Number(payload.exp || 0) <= now) return null;
    return payload;
  } catch (_error) {
    return null;
  }
}

export function sessionSecret(env) {
  const secret = env.SESSION_SECRET;
  if (!secret) throw httpError(500, 'SESSION_SECRET no configurado');
  return String(secret);
}

async function isTwoFactorEnabled(env) {
  const enabled = String(await getAppSetting(env, 'dashboard_2fa_enabled') || env.DASHBOARD_2FA_ENABLED || '').toLowerCase();
  return enabled === 'true' && Boolean(await getTwoFactorSecret(env));
}

async function getTwoFactorSecret(env) {
  return String(await getAppSetting(env, 'dashboard_2fa_secret') || env.DASHBOARD_2FA_SECRET || '').trim().replace(/\s+/g, '').toUpperCase();
}

function generateBase32Secret(length = 32) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => BASE32_ALPHABET[byte % BASE32_ALPHABET.length]).join('');
}

async function verifyTotp(secret, code, windowSize = 1) {
  const cleanCode = String(code || '').replace(/\s+/g, '');
  if (!/^\d{6}$/.test(cleanCode)) return false;
  const nowCounter = Math.floor(Date.now() / 1000 / TOTP_PERIOD_SECONDS);
  for (let offset = -windowSize; offset <= windowSize; offset += 1) {
    const expected = await totpCode(secret, nowCounter + offset);
    if (constantTimeEqual(cleanCode, expected)) return true;
  }
  return false;
}

async function totpCode(secret, counter) {
  const keyBytes = base32ToBytes(secret);
  const counterBytes = new Uint8Array(8);
  const view = new DataView(counterBytes.buffer);
  view.setUint32(4, counter, false);
  const digest = await hmacSha1Bytes(counterBytes, keyBytes);
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = ((digest[offset] & 0x7f) << 24)
    | ((digest[offset + 1] & 0xff) << 16)
    | ((digest[offset + 2] & 0xff) << 8)
    | (digest[offset + 3] & 0xff);
  return String(binary % (10 ** TOTP_DIGITS)).padStart(TOTP_DIGITS, '0');
}

function base32ToBytes(value) {
  const clean = String(value || '').replace(/=+$/g, '').replace(/\s+/g, '').toUpperCase();
  let bits = '';
  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index < 0) throw httpError(400, 'Secreto 2FA invalido');
    bits += index.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return new Uint8Array(bytes);
}
