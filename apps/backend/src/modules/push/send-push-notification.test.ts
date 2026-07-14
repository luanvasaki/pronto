import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { env } from '../../config/env';
import { db } from '../../db/client';
import { pushSubscriptions, users } from '../../db/schema';

// Fixtures únicas entre arquivos de teste (ver README).
const OWNER_PHONE = '+5511966660405';
const ENDPOINT_A = 'https://fcm.googleapis.com/fcm/send/test-endpoint-send-push-a';
const ENDPOINT_B = 'https://fcm.googleapis.com/fcm/send/test-endpoint-send-push-b';

const sendNotificationMock = vi.fn();
const setVapidDetailsMock = vi.fn();

class MockWebPushError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
  }
}

vi.mock('web-push', () => ({
  default: {
    sendNotification: (...args: unknown[]) => sendNotificationMock(...args),
    setVapidDetails: (...args: unknown[]) => setVapidDetailsMock(...args),
    WebPushError: MockWebPushError,
  },
}));

// `env` é um objeto mutável comum (não congelado) — mexer direto nele em
// vez de vi.stubEnv()/process.env: config/env.ts já foi importado (via
// db/client.ts, que outros módulos deste arquivo puxam) antes de
// qualquer stub rodar, então mudar process.env depois não teria efeito
// no objeto `env` já capturado.
const originalVapidPublicKey = env.vapidPublicKey;
const originalVapidPrivateKey = env.vapidPrivateKey;
const originalVapidSubject = env.vapidSubject;

async function createOwner() {
  const [owner] = await db.insert(users).values({ phone: OWNER_PHONE }).returning();
  return owner;
}

describe('sendPushToUser', () => {
  afterEach(async () => {
    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, ENDPOINT_A));
    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, ENDPOINT_B));
    await db.delete(users).where(eq(users.phone, OWNER_PHONE));
    sendNotificationMock.mockReset();
    setVapidDetailsMock.mockReset();
    env.vapidPublicKey = originalVapidPublicKey;
    env.vapidPrivateKey = originalVapidPrivateKey;
    env.vapidSubject = originalVapidSubject;
  });

  it('não faz nada (não lança, não envia) quando VAPID não está configurado', async () => {
    env.vapidPublicKey = undefined;
    env.vapidPrivateKey = undefined;
    env.vapidSubject = undefined;
    const { sendPushToUser } = await import('./send-push-notification');
    const owner = await createOwner();
    await db.insert(pushSubscriptions).values({ userId: owner.id, endpoint: ENDPOINT_A, p256dh: 'p', auth: 'a' });

    await expect(sendPushToUser(owner.id, { title: 'Oi', body: 'teste' })).resolves.toBeUndefined();

    expect(sendNotificationMock).not.toHaveBeenCalled();
  });

  it('não faz nada quando o usuário não tem nenhuma inscrição', async () => {
    env.vapidPublicKey = 'public-key';
    env.vapidPrivateKey = 'private-key';
    env.vapidSubject = 'mailto:test@example.com';
    const { sendPushToUser } = await import('./send-push-notification');
    const owner = await createOwner();

    await sendPushToUser(owner.id, { title: 'Oi', body: 'teste' });

    expect(sendNotificationMock).not.toHaveBeenCalled();
  });

  it('envia pra cada inscrição do usuário, com o payload em JSON', async () => {
    env.vapidPublicKey = 'public-key';
    env.vapidPrivateKey = 'private-key';
    env.vapidSubject = 'mailto:test@example.com';
    const { sendPushToUser } = await import('./send-push-notification');
    const owner = await createOwner();
    await db.insert(pushSubscriptions).values([
      { userId: owner.id, endpoint: ENDPOINT_A, p256dh: 'p1', auth: 'a1' },
      { userId: owner.id, endpoint: ENDPOINT_B, p256dh: 'p2', auth: 'a2' },
    ]);
    sendNotificationMock.mockResolvedValue({ statusCode: 201, body: '', headers: {} });

    await sendPushToUser(owner.id, { title: 'Fulano fez check-in', body: 'Garçom', url: '/escala' });

    expect(sendNotificationMock).toHaveBeenCalledTimes(2);
    expect(setVapidDetailsMock).toHaveBeenCalledWith('mailto:test@example.com', 'public-key', 'private-key');
    const [subscriptionArg, payloadArg] = sendNotificationMock.mock.calls[0];
    expect(subscriptionArg.endpoint).toMatch(/test-endpoint-send-push-/);
    expect(JSON.parse(payloadArg)).toEqual({ title: 'Fulano fez check-in', body: 'Garçom', url: '/escala' });
  });

  it('remove a inscrição quando o envio falha com 410 (expirada/revogada)', async () => {
    env.vapidPublicKey = 'public-key';
    env.vapidPrivateKey = 'private-key';
    env.vapidSubject = 'mailto:test@example.com';
    const { sendPushToUser } = await import('./send-push-notification');
    const owner = await createOwner();
    await db.insert(pushSubscriptions).values({ userId: owner.id, endpoint: ENDPOINT_A, p256dh: 'p1', auth: 'a1' });
    sendNotificationMock.mockRejectedValue(new MockWebPushError('gone', 410));

    await sendPushToUser(owner.id, { title: 'Oi', body: 'teste' });

    const row = await db.query.pushSubscriptions.findFirst({ where: eq(pushSubscriptions.endpoint, ENDPOINT_A) });
    expect(row).toBeUndefined();
  });

  it('mantém a inscrição quando o envio falha por outro motivo (ex. 500 temporário)', async () => {
    env.vapidPublicKey = 'public-key';
    env.vapidPrivateKey = 'private-key';
    env.vapidSubject = 'mailto:test@example.com';
    const { sendPushToUser } = await import('./send-push-notification');
    const owner = await createOwner();
    await db.insert(pushSubscriptions).values({ userId: owner.id, endpoint: ENDPOINT_A, p256dh: 'p1', auth: 'a1' });
    sendNotificationMock.mockRejectedValue(new MockWebPushError('server error', 500));

    await expect(sendPushToUser(owner.id, { title: 'Oi', body: 'teste' })).resolves.toBeUndefined();

    const row = await db.query.pushSubscriptions.findFirst({ where: eq(pushSubscriptions.endpoint, ENDPOINT_A) });
    expect(row).toBeDefined();
  });
});
