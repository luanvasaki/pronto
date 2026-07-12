import * as Sentry from '@sentry/node';
import { env } from './env';

/**
 * Único lugar que decide se o Sentry está ativo — mesmo padrão de
 * createEmailSender()/createFileStorage(). Sem SENTRY_DSN configurada
 * (nenhuma conta criada ainda), isso é um no-op: `Sentry.captureException`
 * chamado sem `init()` não faz nada e não lança erro, então o resto do
 * código (error-handler.ts) pode chamar sem checar se está ativo.
 */
export function initSentry(): void {
  if (!env.sentryDsn) {
    return;
  }

  Sentry.init({ dsn: env.sentryDsn, environment: env.nodeEnv });
}

export { Sentry };
