import * as Sentry from '@sentry/browser';

/**
 * Mesmo padrão do backend (apps/backend/src/config/sentry.ts): sem
 * NEXT_PUBLIC_SENTRY_DSN configurada, captureException/init não fazem
 * nada — resto do código não precisa checar se está ativo.
 */
export function initSentry(): void {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) {
    return;
  }

  Sentry.init({ dsn, environment: process.env.NODE_ENV });
}

export { Sentry };
