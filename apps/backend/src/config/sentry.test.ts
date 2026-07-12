import { afterEach, describe, expect, it, vi } from 'vitest';

const initMock = vi.fn();
vi.mock('@sentry/node', () => ({
  init: (...args: unknown[]) => initMock(...args),
  captureException: vi.fn(),
}));

describe('initSentry', () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    initMock.mockReset();
  });

  it('não inicializa o Sentry sem SENTRY_DSN configurada', async () => {
    vi.stubEnv('SENTRY_DSN', '');
    const { initSentry } = await import('./sentry');

    initSentry();

    expect(initMock).not.toHaveBeenCalled();
  });

  it('inicializa o Sentry quando SENTRY_DSN está configurada', async () => {
    vi.stubEnv('SENTRY_DSN', 'https://example@o0.ingest.sentry.io/0');
    const { initSentry } = await import('./sentry');

    initSentry();

    expect(initMock).toHaveBeenCalledWith(expect.objectContaining({ dsn: 'https://example@o0.ingest.sentry.io/0' }));
  });
});
