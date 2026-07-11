import { describe, expect, it } from 'vitest';
import { isValidCnpj, isValidCpf } from './cpf-cnpj';

describe('isValidCpf', () => {
  it('aceita um CPF com dígito verificador correto', () => {
    expect(isValidCpf('52998224725')).toBe(true);
  });

  it('rejeita todos os dígitos repetidos, mesmo com o tamanho certo', () => {
    expect(isValidCpf('11111111111')).toBe(false);
  });

  it('rejeita dígito verificador incorreto', () => {
    expect(isValidCpf('52998224700')).toBe(false);
  });

  it('rejeita tamanho errado', () => {
    expect(isValidCpf('123')).toBe(false);
  });
});

describe('isValidCnpj', () => {
  it('aceita um CNPJ com dígito verificador correto', () => {
    expect(isValidCnpj('11222333000181')).toBe(true);
  });

  it('rejeita todos os dígitos repetidos, mesmo com o tamanho certo', () => {
    expect(isValidCnpj('11111111111111')).toBe(false);
  });

  it('rejeita dígito verificador incorreto', () => {
    expect(isValidCnpj('11222333000182')).toBe(false);
  });

  it('rejeita tamanho errado', () => {
    expect(isValidCnpj('123')).toBe(false);
  });
});
