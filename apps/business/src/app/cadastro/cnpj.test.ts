import { describe, expect, it } from 'vitest';
import { isValidCnpj } from './cnpj';

describe('isValidCnpj', () => {
  it('aceita exatamente 14 dígitos', () => {
    expect(isValidCnpj('11222333000181')).toBe(true);
  });

  it('rejeita mais ou menos de 14 dígitos', () => {
    expect(isValidCnpj('123')).toBe(false);
    expect(isValidCnpj('112223330001811')).toBe(false);
    expect(isValidCnpj('')).toBe(false);
  });
});
