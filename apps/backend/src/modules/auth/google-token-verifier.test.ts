import { describe, expect, it } from 'vitest';
import { UnconfiguredGoogleTokenVerifier } from './google-token-verifier';

describe('UnconfiguredGoogleTokenVerifier', () => {
  it('lança 503 ao tentar verificar', async () => {
    const verifier = new UnconfiguredGoogleTokenVerifier();

    await expect(verifier.verify('qualquer-token')).rejects.toMatchObject({ statusCode: 503 });
  });
});
