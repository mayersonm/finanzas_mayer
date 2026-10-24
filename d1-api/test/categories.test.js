import { describe, expect, it } from 'vitest';
import { classifyCategoryFromLoadedRules, semanticCategoryFromText } from '../src/shared/categories.js';

const reglasGlobales = [
  { chat_id: '*', keyword: 'kfc', category: 'entretenimiento', priority: 140 },
  { chat_id: '*', keyword: 'internet', category: 'servicios', priority: 100 },
];

describe('clasificacion de gastos leidos de Gmail', () => {
  it('KFC con numero de tienda va a entretenimiento por regla', () => {
    expect(classifyCategoryFromLoadedRules(reglasGlobales, 'otro', 'Kfc155 - puruchuco')).toBe('entretenimiento');
  });

  it('KFC con numero de tienda va a entretenimiento sin reglas cargadas', () => {
    expect(semanticCategoryFromText('otro', 'Kfc155 - puruchuco')).toBe('entretenimiento');
    expect(classifyCategoryFromLoadedRules([], 'otro', 'BEMBOS12 JOCKEY')).toBe('entretenimiento');
  });

  it('no confunde palabras que solo empiezan igual', () => {
    expect(semanticCategoryFromText('otro', 'kfcx tienda')).toBe('');
  });

  it('una categoria explicita no se reemplaza', () => {
    expect(classifyCategoryFromLoadedRules(reglasGlobales, 'servicios', 'Kfc155')).toBe('servicios');
  });
});
