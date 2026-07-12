import { describe, expect, it } from 'vitest';
import { containsPhoneNumber } from './contains-phone-number';

describe('containsPhoneNumber', () => {
  it('detecta celular com DDD e traço', () => {
    expect(containsPhoneNumber('me chama no 11 91234-5678')).toBe(true);
  });

  it('detecta com parênteses e sem espaço', () => {
    expect(containsPhoneNumber('(11)912345678')).toBe(true);
  });

  it('detecta número corrido sem separador', () => {
    expect(containsPhoneNumber('whats: 11912345678')).toBe(true);
  });

  it('detecta com código do país', () => {
    expect(containsPhoneNumber('+55 11 91234-5678')).toBe(true);
  });

  it('não marca uma data comum', () => {
    expect(containsPhoneNumber('a vaga é dia 11/07/2026')).toBe(false);
  });

  it('não marca valor em reais', () => {
    expect(containsPhoneNumber('o pagamento é R$ 130,00 por pessoa')).toBe(false);
  });

  it('não marca texto sem números', () => {
    expect(containsPhoneNumber('precisa levar uniforme próprio?')).toBe(false);
  });

  it('não marca horário', () => {
    expect(containsPhoneNumber('o turno começa às 18:30 e termina 23:00')).toBe(false);
  });
});
