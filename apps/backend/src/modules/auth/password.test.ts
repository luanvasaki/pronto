import { describe, expect, it } from 'vitest';
import { hashPassword, isValidPassword, verifyPassword } from './password';

describe('isValidPassword', () => {
  it('rejeita senha curta demais', () => {
    expect(isValidPassword('1234567')).toBe(false);
  });

  it('aceita senha com 8 caracteres', () => {
    expect(isValidPassword('12345678')).toBe(true);
  });

  it('aceita senha com 72 caracteres', () => {
    expect(isValidPassword('a'.repeat(72))).toBe(true);
  });

  it('rejeita senha com mais de 72 caracteres', () => {
    expect(isValidPassword('a'.repeat(73))).toBe(false);
  });
});

describe('hashPassword / verifyPassword', () => {
  it('gera hashes diferentes pra mesma senha (salt aleatório)', async () => {
    const a = await hashPassword('correct-horse-battery');
    const b = await hashPassword('correct-horse-battery');

    expect(a).not.toBe(b);
  });

  it('verifica corretamente senha certa e errada', async () => {
    const hash = await hashPassword('correct-horse-battery');

    await expect(verifyPassword('correct-horse-battery', hash)).resolves.toBe(true);
    await expect(verifyPassword('wrong-password', hash)).resolves.toBe(false);
  });
});
