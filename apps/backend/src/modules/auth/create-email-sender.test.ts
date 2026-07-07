import { afterEach, describe, expect, it, vi } from 'vitest';

describe('createEmailSender', () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it('retorna ConsoleEmailSender quando não há RESEND_API_KEY configurada (dev/teste)', async () => {
    vi.stubEnv('RESEND_API_KEY', '');
    vi.stubEnv('NODE_ENV', 'development');
    const { createEmailSender } = await import('./create-email-sender');
    const { ConsoleEmailSender } = await import('./email-sender');

    expect(createEmailSender()).toBeInstanceOf(ConsoleEmailSender);
  });

  it('lança erro em produção sem RESEND_API_KEY configurada', async () => {
    vi.stubEnv('RESEND_API_KEY', '');
    vi.stubEnv('NODE_ENV', 'production');
    const { createEmailSender } = await import('./create-email-sender');

    expect(() => createEmailSender()).toThrow(/RESEND_API_KEY/);
  });

  it('retorna ResendEmailSender quando RESEND_API_KEY está configurada', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test_key');
    const { createEmailSender } = await import('./create-email-sender');
    const { ResendEmailSender } = await import('./resend-email-sender');

    expect(createEmailSender()).toBeInstanceOf(ResendEmailSender);
  });
});
