import { describe, expect, it } from 'vitest';
import { isValidPassword } from './password';

describe('isValidPassword', () => {
  it('rejeita senha curta demais', () => {
    expect(isValidPassword('1234567')).toBe(false);
  });

  it('aceita senha com 8 caracteres ou mais', () => {
    expect(isValidPassword('12345678')).toBe(true);
  });

  it('rejeita senha com mais de 72 caracteres (bcrypt trunca em silêncio depois disso)', () => {
    expect(isValidPassword('a'.repeat(73))).toBe(false);
  });

  it('aceita senha com exatamente 72 caracteres', () => {
    expect(isValidPassword('a'.repeat(72))).toBe(true);
  });
});
