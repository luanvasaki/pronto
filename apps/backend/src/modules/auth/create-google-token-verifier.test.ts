import { afterEach, describe, expect, it, vi } from 'vitest';

describe('createGoogleTokenVerifier', () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it('retorna UnconfiguredGoogleTokenVerifier sem GOOGLE_CLIENT_ID (dev/teste)', async () => {
    vi.stubEnv('GOOGLE_CLIENT_ID', '');
    vi.stubEnv('NODE_ENV', 'development');
    const { createGoogleTokenVerifier } = await import('./create-google-token-verifier');
    const { UnconfiguredGoogleTokenVerifier } = await import('./google-token-verifier');

    expect(createGoogleTokenVerifier()).toBeInstanceOf(UnconfiguredGoogleTokenVerifier);
  });

  it('lança erro em produção sem GOOGLE_CLIENT_ID configurada', async () => {
    vi.stubEnv('GOOGLE_CLIENT_ID', '');
    vi.stubEnv('NODE_ENV', 'production');
    const { createGoogleTokenVerifier } = await import('./create-google-token-verifier');

    expect(() => createGoogleTokenVerifier()).toThrow(/GOOGLE_CLIENT_ID/);
  });

  it('retorna RealGoogleTokenVerifier quando GOOGLE_CLIENT_ID está configurada', async () => {
    vi.stubEnv('GOOGLE_CLIENT_ID', 'test-client-id');
    const { createGoogleTokenVerifier } = await import('./create-google-token-verifier');
    const { RealGoogleTokenVerifier } = await import('./google-token-verifier');

    expect(createGoogleTokenVerifier()).toBeInstanceOf(RealGoogleTokenVerifier);
  });
});
