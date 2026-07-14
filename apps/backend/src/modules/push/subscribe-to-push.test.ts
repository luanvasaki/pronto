import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../../db/client';
import { pushSubscriptions, users } from '../../db/schema';
import { subscribeToPush } from './subscribe-to-push';

// Fixtures únicas entre arquivos de teste (ver README).
const OWNER_PHONE = '+5511966660401';
const OTHER_PHONE = '+5511966660402';
const TEST_ENDPOINT = 'https://fcm.googleapis.com/fcm/send/test-endpoint-subscribe-to-push';

async function createOwner(phone: string) {
  const [owner] = await db.insert(users).values({ phone }).returning();
  return owner;
}

describe('subscribeToPush', () => {
  afterEach(async () => {
    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, TEST_ENDPOINT));
    await db.delete(users).where(eq(users.phone, OWNER_PHONE));
    await db.delete(users).where(eq(users.phone, OTHER_PHONE));
  });

  it('rejeita quando faltam endpoint ou chaves', async () => {
    const owner = await createOwner(OWNER_PHONE);

    await expect(subscribeToPush(owner.id, { endpoint: undefined, keys: { p256dh: 'a', auth: 'b' } })).rejects.toThrow(
      'Inscrição de notificação inválida.',
    );
    await expect(subscribeToPush(owner.id, { endpoint: TEST_ENDPOINT, keys: undefined })).rejects.toThrow(
      'Inscrição de notificação inválida.',
    );
    await expect(
      subscribeToPush(owner.id, { endpoint: TEST_ENDPOINT, keys: { p256dh: 'a', auth: undefined } }),
    ).rejects.toThrow('Inscrição de notificação inválida.');
  });

  it('cria a inscrição associada ao usuário', async () => {
    const owner = await createOwner(OWNER_PHONE);

    await subscribeToPush(owner.id, { endpoint: TEST_ENDPOINT, keys: { p256dh: 'p256dh-1', auth: 'auth-1' } });

    const row = await db.query.pushSubscriptions.findFirst({ where: eq(pushSubscriptions.endpoint, TEST_ENDPOINT) });
    expect(row?.userId).toBe(owner.id);
    expect(row?.p256dh).toBe('p256dh-1');
    expect(row?.auth).toBe('auth-1');
  });

  it('reenviar o mesmo endpoint atualiza a linha em vez de duplicar', async () => {
    const owner = await createOwner(OWNER_PHONE);
    const other = await createOwner(OTHER_PHONE);

    await subscribeToPush(owner.id, { endpoint: TEST_ENDPOINT, keys: { p256dh: 'p256dh-1', auth: 'auth-1' } });
    // Mesmo endpoint, dono e chaves diferentes — simula o navegador
    // rotacionando a inscrição pra outro usuário (ex. troca de conta no
    // mesmo dispositivo).
    await subscribeToPush(other.id, { endpoint: TEST_ENDPOINT, keys: { p256dh: 'p256dh-2', auth: 'auth-2' } });

    const rows = await db.query.pushSubscriptions.findMany({ where: eq(pushSubscriptions.endpoint, TEST_ENDPOINT) });
    expect(rows).toHaveLength(1);
    expect(rows[0].userId).toBe(other.id);
    expect(rows[0].p256dh).toBe('p256dh-2');
  });
});
