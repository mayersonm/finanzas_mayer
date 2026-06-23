import { describe, expect, it } from 'vitest';
import {
  base64UrlDecode,
  base64UrlEncode,
  constantTimeEqual,
  hashPassword,
  sha256Hex,
  verifyPassword,
} from '../src/shared/crypto.js';

describe('hashPassword / verifyPassword (PBKDF2)', () => {
  it('genera un hash con el formato pbkdf2$iter$salt$hash', async () => {
    const hash = await hashPassword('clave-super-secreta');
    expect(hash.startsWith('pbkdf2$')).toBe(true);
    expect(hash.split('$')).toHaveLength(4);
  });

  it('usa salt aleatorio: dos hashes de la misma clave difieren', async () => {
    const a = await hashPassword('misma-clave');
    const b = await hashPassword('misma-clave');
    expect(a).not.toBe(b);
  });

  it('verifica correctamente la clave correcta y rechaza la incorrecta', async () => {
    const hash = await hashPassword('clave-correcta-123');
    expect((await verifyPassword('clave-correcta-123', hash)).valid).toBe(true);
    expect((await verifyPassword('clave-incorrecta', hash)).valid).toBe(false);
  });

  it('marca legacy: false para hashes PBKDF2', async () => {
    const hash = await hashPassword('x'.repeat(12));
    expect((await verifyPassword('x'.repeat(12), hash)).legacy).toBe(false);
  });

  it('valida hashes SHA-256 antiguos y los marca legacy para re-hash', async () => {
    const legacyHash = await sha256Hex('clave-vieja');
    const result = await verifyPassword('clave-vieja', legacyHash);
    expect(result.valid).toBe(true);
    expect(result.legacy).toBe(true);
  });

  it('rechaza clave incorrecta contra hash SHA-256 antiguo', async () => {
    const legacyHash = await sha256Hex('clave-vieja');
    expect((await verifyPassword('otra', legacyHash)).valid).toBe(false);
  });
});

describe('constantTimeEqual', () => {
  it('es true para cadenas iguales y false si difieren', () => {
    expect(constantTimeEqual('abc', 'abc')).toBe(true);
    expect(constantTimeEqual('abc', 'abd')).toBe(false);
    expect(constantTimeEqual('abc', 'abcd')).toBe(false);
  });

  it('es false ante vacios', () => {
    expect(constantTimeEqual('', 'abc')).toBe(false);
  });
});

describe('base64url', () => {
  it('hace round-trip de texto con caracteres especiales', () => {
    const value = 'Mayeson: año & 100% €';
    expect(base64UrlDecode(base64UrlEncode(value))).toBe(value);
  });

  it('no contiene caracteres + / = en la salida', () => {
    const encoded = base64UrlEncode('?'.repeat(20));
    expect(/[+/=]/.test(encoded)).toBe(false);
  });
});
