import { describe, expect, it } from 'vitest';
import { extractDigits, isValidBrazilianPhone, toE164 } from './phone';

describe('extractDigits', () => {
  it('remove tudo que não é número', () => {
    expect(extractDigits('(11) 99999-0000')).toBe('11999990000');
  });
});

describe('isValidBrazilianPhone', () => {
  it('aceita 10 ou 11 dígitos', () => {
    expect(isValidBrazilianPhone('1199990000')).toBe(true);
    expect(isValidBrazilianPhone('11999990000')).toBe(true);
  });

  it('rejeita menos de 10 ou mais de 11 dígitos', () => {
    expect(isValidBrazilianPhone('123')).toBe(false);
    expect(isValidBrazilianPhone('119999900001')).toBe(false);
  });
});

describe('toE164', () => {
  it('adiciona o código do Brasil', () => {
    expect(toE164('11999990000')).toBe('+5511999990000');
  });
});
