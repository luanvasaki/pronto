import { describe, expect, it } from 'vitest';
import { isValidCnpj as backendIsValidCnpj, isValidCpf as backendIsValidCpf } from './cpf-cnpj';
import { isValidCnpj as sharedIsValidCnpj, isValidCpf as sharedIsValidCpf } from '../../../../packages/shared/src/cpf-cnpj';

/**
 * `apps/backend/src/shared/cpf-cnpj.ts` é uma cópia deliberada de
 * `packages/shared/src/cpf-cnpj.ts` (ver comentário lá — backend não
 * depende de @shift/shared em runtime). Esse teste não tem outro papel
 * a não ser garantir que as duas cópias continuam concordando —
 * se um ajuste de edge case entrar numa e não na outra, aqui é onde
 * isso quebra, em vez de virar uma divergência silenciosa de UX entre
 * frontend e backend.
 */
describe('paridade entre as duas cópias de isValidCpf/isValidCnpj', () => {
  const CPF_CASES = [
    ['52998224725', true], // CPF válido de verdade, usado em outros testes do backend
    ['11144477735', true], // outro CPF válido
    ['11111111111', false], // dígitos repetidos, formato certo mas nunca emitido
    ['12345678901', false], // dígito verificador errado
    ['1234567890', false], // curto demais
    ['123456789012', false], // longo demais
    ['abcdefghijk', false], // não numérico
    ['', false],
  ] as const;

  const CNPJ_CASES = [
    ['11222333001900', true], // CNPJ válido, usado em outros testes do backend
    ['11444777000161', true], // outro CNPJ válido
    ['11111111111111', false], // dígitos repetidos
    ['11222333000100', false], // dígito verificador errado
    ['1122233300019', false], // curto demais
    ['112223330019000', false], // longo demais
    ['', false],
  ] as const;

  it.each(CPF_CASES)('CPF %s — as duas implementações concordam (esperado: %s)', (cpf, expected) => {
    expect(backendIsValidCpf(cpf)).toBe(expected);
    expect(sharedIsValidCpf(cpf)).toBe(expected);
    expect(backendIsValidCpf(cpf)).toBe(sharedIsValidCpf(cpf));
  });

  it.each(CNPJ_CASES)('CNPJ %s — as duas implementações concordam (esperado: %s)', (cnpj, expected) => {
    expect(backendIsValidCnpj(cnpj)).toBe(expected);
    expect(sharedIsValidCnpj(cnpj)).toBe(expected);
    expect(backendIsValidCnpj(cnpj)).toBe(sharedIsValidCnpj(cnpj));
  });
});
