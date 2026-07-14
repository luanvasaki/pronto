import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../../db/client';
import { pushSubscriptions, users } from '../../db/schema';
import { subscribeToPush } from './subscribe-to-push';
import { unsubscribeFromPush } from './unsubscribe-from-push';

// Fixtures únicas entre arquivos de teste (ver README).
const OWNER_PHONE = '+5511966660403';
const OTHER_PHONE = '+5511966660404';
const TEST_ENDPOINT = 'https://fcm.googleapis.com/fcm/send/test-endpoint-unsubscribe-from-push';

async function createOwner(phone: string) {
  const [owner] = await db.insert(users).values({ phone }).returning();
  return owner;
}

describe('unsubscribeFromPush', () => {
  afterEach(async () => {
    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, TEST_ENDPOINT));
    await db.delete(users).where(eq(users.phone, OWNER_PHONE));
    await db.delete(users).where(eq(users.phone, OTHER_PHONE));
  });

  it('rejeita quando o endpoint não é enviado', async () => {
    const owner = await createOwner(OWNER_PHONE);

    await expect(unsubscribeFromPush(owner.id, undefined)).rejects.toThrow('Endpoint é obrigatório.');
  });

  it('remove a inscrição do usuário', async () => {
    const owner = await createOwner(OWNER_PHONE);
    await subscribeToPush(owner.id, { endpoint: TEST_ENDPOINT, keys: { p256dh: 'p256dh-1', auth: 'auth-1' } });

    await unsubscribeFromPush(owner.id, TEST_ENDPOINT);

    const row = await db.query.pushSubscriptions.findFirst({ where: eq(pushSubscriptions.endpoint, TEST_ENDPOINT) });
    expect(row).toBeUndefined();
  });

  it('não remove inscrição de outro usuário com o mesmo endpoint por engano', async () => {
    const owner = await createOwner(OWNER_PHONE);
    const other = await createOwner(OTHER_PHONE);
    await subscribeToPush(owner.id, { endpoint: TEST_ENDPOINT, keys: { p256dh: 'p256dh-1', auth: 'auth-1' } });

    // `other` nunca se inscreveu com esse endpoint — tentar remover não
    // deve afetar a inscrição real do `owner`.
    await unsubscribeFromPush(other.id, TEST_ENDPOINT);

    const row = await db.query.pushSubscriptions.findFirst({ where: eq(pushSubscriptions.endpoint, TEST_ENDPOINT) });
    expect(row?.userId).toBe(owner.id);
  });

  it('não lança quando o endpoint já não existe', async () => {
    const owner = await createOwner(OWNER_PHONE);

    await expect(unsubscribeFromPush(owner.id, TEST_ENDPOINT)).resolves.toBeUndefined();
  });
});
