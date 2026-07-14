import { describe, expect, it } from 'vitest';
import { formatCep, formatCnpj, formatCpf, formatPhone } from './masks';

describe('formatCpf', () => {
  it('aplica a máscara progressivamente conforme os dígitos aparecem', () => {
    expect(formatCpf('1')).toBe('1');
    expect(formatCpf('123')).toBe('123');
    expect(formatCpf('1234')).toBe('123.4');
    expect(formatCpf('123456')).toBe('123.456');
    expect(formatCpf('1234567')).toBe('123.456.7');
    expect(formatCpf('123456789')).toBe('123.456.789');
    expect(formatCpf('1234567890')).toBe('123.456.789-0');
    expect(formatCpf('12345678901')).toBe('123.456.789-01');
  });

  it('ignora dígitos além do 11º', () => {
    expect(formatCpf('123456789012345')).toBe('123.456.789-01');
  });
});

describe('formatCnpj', () => {
  it('aplica a máscara progressivamente conforme os dígitos aparecem', () => {
    expect(formatCnpj('1')).toBe('1');
    expect(formatCnpj('12')).toBe('12');
    expect(formatCnpj('123')).toBe('12.3');
    expect(formatCnpj('12345')).toBe('12.345');
    expect(formatCnpj('123456')).toBe('12.345.6');
    expect(formatCnpj('12345678')).toBe('12.345.678');
    expect(formatCnpj('123456789')).toBe('12.345.678/9');
    expect(formatCnpj('123456780001')).toBe('12.345.678/0001');
    expect(formatCnpj('1234567800019')).toBe('12.345.678/0001-9');
    expect(formatCnpj('12345678000195')).toBe('12.345.678/0001-95');
  });

  it('ignora dígitos além do 14º', () => {
    expect(formatCnpj('123456780001959999')).toBe('12.345.678/0001-95');
  });
});

describe('formatPhone', () => {
  it('aplica a máscara progressivamente até fechar um fixo (10 dígitos)', () => {
    expect(formatPhone('1')).toBe('1');
    expect(formatPhone('11')).toBe('11');
    expect(formatPhone('113')).toBe('(11) 3');
    expect(formatPhone('1139123')).toBe('(11) 39123');
    expect(formatPhone('1139123456')).toBe('(11) 3912-3456');
  });

  it('formata celular (11 dígitos, 9 na frente)', () => {
    expect(formatPhone('11391234567')).toBe('(11) 39123-4567');
  });

  it('ignora dígitos além do 11º', () => {
    expect(formatPhone('113912345679999')).toBe('(11) 39123-4567');
  });
});

describe('formatCep', () => {
  it('aplica a máscara progressivamente conforme os dígitos aparecem', () => {
    expect(formatCep('1')).toBe('1');
    expect(formatCep('12345')).toBe('12345');
    expect(formatCep('123456')).toBe('12345-6');
    expect(formatCep('12345678')).toBe('12345-678');
  });

  it('ignora dígitos além do 8º', () => {
    expect(formatCep('123456789999')).toBe('12345-678');
  });
});
