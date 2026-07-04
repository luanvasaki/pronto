import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../../db/client';
import { users, workerProfiles } from '../../db/schema';
import { updateWorkerLocation } from './update-worker-location';

// Fixtures únicas entre arquivos de teste (ver README).
const TEST_PHONE = '+5511966660005';

async function createTestUser() {
  const [user] = await db.insert(users).values({ phone: TEST_PHONE }).returning();
  return user;
}

describe('updateWorkerLocation', () => {
  afterEach(async () => {
    await db.delete(users).where(eq(users.phone, TEST_PHONE));
  });

  it('rejeita latitude inválida', async () => {
    const user = await createTestUser();

    await expect(updateWorkerLocation(user.id, { lat: 200, lng: 0 })).rejects.toThrow(
      'Latitude inválida',
    );
  });

  it('rejeita longitude inválida', async () => {
    const user = await createTestUser();

    await expect(updateWorkerLocation(user.id, { lat: 0, lng: -200 })).rejects.toThrow(
      'Longitude inválida',
    );
  });

  it('rejeita quando o perfil ainda não existe', async () => {
    const user = await createTestUser();

    await expect(updateWorkerLocation(user.id, { lat: -23.55, lng: -46.63 })).rejects.toThrow(
      'Complete seu cadastro',
    );
  });

  it('salva a localização quando o perfil já existe', async () => {
    const user = await createTestUser();
    await db.insert(workerProfiles).values({ userId: user.id, fullName: 'Ana Souza' });

    const result = await updateWorkerLocation(user.id, { lat: -23.55, lng: -46.63 });

    expect(result).toEqual({ homeLat: -23.55, homeLng: -46.63 });
  });
});
