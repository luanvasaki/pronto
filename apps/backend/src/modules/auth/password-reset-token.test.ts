import { describe, expect, it } from 'vitest';
import { generatePasswordResetToken, hashPasswordResetToken } from './password-reset-token';

describe('password-reset-token', () => {
  it('gera tokens diferentes a cada chamada', () => {
    const a = generatePasswordResetToken();
    const b = generatePasswordResetToken();

    expect(a).not.toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('gera o mesmo hash pro mesmo token, hashes diferentes pra tokens diferentes', () => {
    const token = generatePasswordResetToken();

    expect(hashPasswordResetToken(token)).toBe(hashPasswordResetToken(token));
    expect(hashPasswordResetToken(token)).not.toBe(hashPasswordResetToken(generatePasswordResetToken()));
  });

  it('nunca retorna o próprio token como hash', () => {
    const token = generatePasswordResetToken();

    expect(hashPasswordResetToken(token)).not.toBe(token);
  });
});
