import { describe, expect, it } from 'vitest';
import { currencyToPen, formatCurrency, parseAmount, round } from '../src/shared/money.js';

describe('round', () => {
  it('redondea a 2 decimales', () => {
    expect(round(1.234)).toBe(1.23);
    expect(round(1.236)).toBe(1.24);
    expect(round(2.345)).toBe(2.35);
    expect(round(10.999)).toBe(11);
  });

  it('trata valores no numericos como 0', () => {
    expect(round('abc')).toBe(0);
    expect(round(undefined)).toBe(0);
  });
});

describe('parseAmount', () => {
  it('acepta numeros directos', () => {
    expect(parseAmount(12.5)).toBe(12.5);
  });

  it('limpia simbolos y usa coma como decimal simple', () => {
    expect(parseAmount('S/ 10,50')).toBeCloseTo(10.5);
    expect(parseAmount('US$ 10')).toBe(10);
    expect(parseAmount('25.99')).toBeCloseTo(25.99);
  });

  it('no soporta separador de miles: queda NaN -> 0 (limitacion conocida)', () => {
    expect(parseAmount('1.234,50')).toBe(0);
  });

  it('devuelve 0 ante texto sin numeros', () => {
    expect(parseAmount('gratis')).toBe(0);
  });
});

describe('currencyToPen', () => {
  it('convierte USD a PEN con la tasa dada', () => {
    expect(currencyToPen(10, 'USD', 3.8)).toBe(38);
  });

  it('deja PEN sin cambios', () => {
    expect(currencyToPen(100, 'PEN', 3.8)).toBe(100);
  });

  it('usa tasa por defecto 3.85 si no se pasa', () => {
    expect(currencyToPen(1, 'USD')).toBe(3.85);
  });
});

describe('formatCurrency', () => {
  it('usa el simbolo correcto por moneda', () => {
    expect(formatCurrency(1234.5, 'PEN')).toBe('S/ 1234.50');
    expect(formatCurrency(10, 'USD')).toBe('US$ 10.00');
  });
});
