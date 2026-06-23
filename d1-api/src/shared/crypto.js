export async function hmacSha256(value, secret) {
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

export async function hmacSha256Hex(value, secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    utf8Bytes(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, utf8Bytes(value));
  return bytesToHex(new Uint8Array(signature));
}

export async function hmacSha1Bytes(bytes, secretBytes) {
  const key = await crypto.subtle.importKey(
    'raw',
    secretBytes,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, bytes));
}

export async function sha256Hex(value) {
  const digest = await crypto.subtle.digest('SHA-256', utf8Bytes(value));
  return bytesToHex(new Uint8Array(digest));
}

const PBKDF2_ITERATIONS = 50000;

// Deriva la clave con PBKDF2-SHA256 y devuelve `pbkdf2$iter$salt$hash` (salt y hash en base64url).
export async function hashPassword(password, iterations = PBKDF2_ITERATIONS) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2Bytes(password, salt, iterations);
  return `pbkdf2$${iterations}$${base64UrlEncodeBytes(salt)}$${base64UrlEncodeBytes(hash)}`;
}

// Verifica una clave contra un hash PBKDF2 o, si es un hash SHA-256 hex antiguo, contra ese.
// Devuelve { valid, legacy } para permitir el re-hash transparente de hashes viejos.
export async function verifyPassword(password, stored) {
  const value = String(stored || '');

  if (value.startsWith('pbkdf2$')) {
    const [, iterStr, saltB64, hashB64] = value.split('$');
    const iterations = Number(iterStr) || PBKDF2_ITERATIONS;
    const expected = base64UrlDecodeBytes(hashB64);
    const actual = await pbkdf2Bytes(password, base64UrlDecodeBytes(saltB64), iterations);
    return { valid: constantTimeEqualBytes(actual, expected), legacy: false };
  }

  const providedHash = await sha256Hex(password);
  return { valid: constantTimeEqual(providedHash, value.toLowerCase()), legacy: true };
}

async function pbkdf2Bytes(password, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', utf8Bytes(password), { name: 'PBKDF2' }, false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, key, 256);
  return new Uint8Array(bits);
}

export function utf8Bytes(value) {
  return new TextEncoder().encode(String(value));
}

export function base64UrlEncode(value) {
  return base64UrlEncodeBytes(utf8Bytes(value));
}

export function base64UrlEncodeBytes(bytes) {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

export function base64UrlDecode(value) {
  const normalized = String(value || '')
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function base64UrlDecodeBytes(value) {
  const normalized = String(value || '')
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export function constantTimeEqualBytes(a, b) {
  if (!(a instanceof Uint8Array) || !(b instanceof Uint8Array) || !a.length || !b.length) return false;

  let diff = a.length ^ b.length;
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i++) {
    diff |= (a[i % a.length] || 0) ^ (b[i % b.length] || 0);
  }
  return diff === 0;
}

export function constantTimeEqual(a, b) {
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

export function bytesToHex(bytes) {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
