import { describe, expect, it } from 'vitest';
import { isValidPassword } from './password';

describe('isValidPassword', () => {
  it('rejeita senha curta demais', () => {
    expect(isValidPassword('1234567')).toBe(false);
  });

  it('aceita senha com 8 caracteres ou mais', () => {
    expect(isValidPassword('12345678')).toBe(true);
  });
});
