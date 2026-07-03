import { describe, expect, it } from 'vitest';
import { signAccessToken, verifyAccessToken } from './jwt';

describe('jwt', () => {
  it('assina e verifica um access token válido', () => {
    const token = signAccessToken('user-123');

    const payload = verifyAccessToken(token);

    expect(payload.sub).toBe('user-123');
    expect(payload.type).toBe('access');
  });

  it('rejeita um token adulterado', () => {
    const token = signAccessToken('user-123');
    const tampered = token.slice(0, -2) + 'xx';

    expect(() => verifyAccessToken(tampered)).toThrow();
  });
});
