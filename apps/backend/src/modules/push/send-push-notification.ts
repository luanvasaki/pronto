import { eq } from 'drizzle-orm';
import webpush from 'web-push';
import { env } from '../../config/env';
import { db } from '../../db/client';
import { pushSubscriptions } from '../../db/schema';

export interface PushPayload {
  title: string;
  body: string;
  /** Caminho relativo (ex. "/escala") aberto ao clicar na notificação — ver notificationclick no service worker. */
  url?: string;
}

/**
 * Chamado a cada envio em vez de memoizado — setVapidDetails só grava
 * config em memória do próprio pacote web-push, sem I/O, então não há
 * custo real em rechecar a cada vez. Sem cache, testar o caminho "sem
 * VAPID configurado" não depende da ordem em que os testes rodam.
 */
function ensureConfigured(): boolean {
  if (!env.vapidPublicKey || !env.vapidPrivateKey || !env.vapidSubject) {
    return false;
  }
  webpush.setVapidDetails(env.vapidSubject, env.vapidPublicKey, env.vapidPrivateKey);
  return true;
}

/**
 * Notificação é um complemento, nunca um caminho crítico — essa função
 * jamais lança. Quem chama (ex. checkIn) não pode falhar por causa de um
 * push que não foi entregue. Sem VAPID configurado (dev sem as chaves),
 * vira no-op silencioso, mesmo espírito do Sentry opcional em env.ts.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  if (!ensureConfigured()) {
    return;
  }

  const subscriptions = await db.query.pushSubscriptions.findMany({ where: eq(pushSubscriptions.userId, userId) });
  if (subscriptions.length === 0) {
    return;
  }

  const body = JSON.stringify(payload);

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
          body,
        );
      } catch (error) {
        // 404/410 = inscrição expirada ou revogada pelo navegador — limpa
        // pra não tentar de novo pra sempre. Qualquer outro erro só loga:
        // ver docstring, um push falho não pode propagar pro chamador.
        const statusCode = error instanceof webpush.WebPushError ? error.statusCode : undefined;
        if (statusCode === 404 || statusCode === 410) {
          await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, subscription.id));
        } else {
          console.error('[sendPushToUser] falha ao enviar notificação:', error);
        }
      }
    }),
  );
}
