import { describe, expect, it } from 'vitest';
import { generateRefreshToken, hashRefreshToken } from './refresh-token';

describe('refresh-token', () => {
  it('gera tokens diferentes a cada chamada', () => {
    const a = generateRefreshToken();
    const b = generateRefreshToken();

    expect(a).not.toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('gera o mesmo hash pro mesmo token, hashes diferentes pra tokens diferentes', () => {
    const token = generateRefreshToken();

    expect(hashRefreshToken(token)).toBe(hashRefreshToken(token));
    expect(hashRefreshToken(token)).not.toBe(hashRefreshToken(generateRefreshToken()));
  });

  it('nunca retorna o próprio token como hash', () => {
    const token = generateRefreshToken();

    expect(hashRefreshToken(token)).not.toBe(token);
  });
});
