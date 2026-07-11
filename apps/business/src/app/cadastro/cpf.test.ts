import { describe, expect, it } from 'vitest';
import { isValidCpf } from './cpf';

describe('isValidCpf', () => {
  it('aceita exatamente 11 dígitos', () => {
    expect(isValidCpf('11122233344')).toBe(true);
  });

  it('rejeita mais ou menos de 11 dígitos', () => {
    expect(isValidCpf('123')).toBe(false);
    expect(isValidCpf('111222333445')).toBe(false);
    expect(isValidCpf('')).toBe(false);
  });
});
