import { describe, expect, it } from 'vitest';
import { calculateAge, isMinor } from './age';

// new Date(ano, mês, dia) constrói em horário local — new Date('YYYY-MM-DD')
// parseia como UTC meia-noite, que pode virar o dia anterior no fuso local
// da máquina que roda o teste (o mesmo off-by-one que calculateAge existe
// pra evitar do lado do birthDate).
const NOW = new Date(2026, 6, 14);

describe('calculateAge', () => {
  it('calcula a idade quando já fez aniversário este ano', () => {
    expect(calculateAge('2000-01-15', NOW)).toBe(26);
  });

  it('calcula a idade quando ainda não fez aniversário este ano', () => {
    expect(calculateAge('2000-12-15', NOW)).toBe(25);
  });

  it('conta o aniversário no dia exato', () => {
    expect(calculateAge('2010-07-14', NOW)).toBe(16);
  });

  it('não conta o aniversário um dia antes', () => {
    expect(calculateAge('2010-07-15', NOW)).toBe(15);
  });
});

describe('isMinor', () => {
  it('é true pra quem tem menos de 18 anos', () => {
    expect(isMinor('2008-07-15', NOW)).toBe(true);
  });

  it('é false pra quem já fez 18 anos', () => {
    expect(isMinor('2008-07-14', NOW)).toBe(false);
  });

  it('é false pra quem é bem mais velho', () => {
    expect(isMinor('1990-01-01', NOW)).toBe(false);
  });

  it('é false quando birthDate é null (nunca deveria acontecer, mas não lança)', () => {
    expect(isMinor(null, NOW)).toBe(false);
  });

  it('é false quando birthDate é undefined', () => {
    expect(isMinor(undefined, NOW)).toBe(false);
  });
});
