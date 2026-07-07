import { describe, expect, it } from 'vitest';
import { isValidEmail } from './email';

describe('isValidEmail', () => {
  it('aceita email válido', () => {
    expect(isValidEmail('pessoa@example.com')).toBe(true);
  });

  it('rejeita sem @', () => {
    expect(isValidEmail('pessoa.example.com')).toBe(false);
  });

  it('rejeita sem domínio', () => {
    expect(isValidEmail('pessoa@example')).toBe(false);
  });

  it('rejeita com espaço', () => {
    expect(isValidEmail('pessoa @example.com')).toBe(false);
  });
});
