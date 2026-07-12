import { describe, expect, it } from 'vitest';
import { isUniqueViolation } from './is-unique-violation';

describe('isUniqueViolation', () => {
  it('detecta código 23505 direto no erro', () => {
    const error = Object.assign(new Error('duplicate'), { code: '23505' });
    expect(isUniqueViolation(error)).toBe(true);
  });

  it('detecta código 23505 dentro de error.cause', () => {
    const error = new Error('duplicate', { cause: { code: '23505' } });
    expect(isUniqueViolation(error)).toBe(true);
  });

  it('retorna false pra outro código', () => {
    const error = Object.assign(new Error('outra coisa'), { code: '23503' });
    expect(isUniqueViolation(error)).toBe(false);
  });

  it('retorna false quando não é um Error', () => {
    expect(isUniqueViolation('string qualquer')).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation(undefined)).toBe(false);
  });
});
