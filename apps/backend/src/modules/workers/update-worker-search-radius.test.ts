import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../../db/client';
import { users, workerProfiles } from '../../db/schema';
import { updateWorkerSearchRadius } from './update-worker-search-radius';

const TEST_PHONE = '+5511966660080';

async function createTestUser() {
  const [user] = await db.insert(users).values({ phone: TEST_PHONE }).returning();
  await db.insert(workerProfiles).values({ userId: user.id, fullName: 'Ana Souza' });
  return user;
}

describe('updateWorkerSearchRadius', () => {
  afterEach(async () => {
    await db.delete(users).where(eq(users.phone, TEST_PHONE));
  });

  it('rejeita valor não numérico', async () => {
    const user = await createTestUser();
    await expect(updateWorkerSearchRadius(user.id, undefined)).rejects.toThrow('Raio de busca precisa ser');
  });

  it('rejeita valor decimal', async () => {
    const user = await createTestUser();
    await expect(updateWorkerSearchRadius(user.id, 10.5)).rejects.toThrow('Raio de busca precisa ser');
  });

  it('rejeita valor abaixo do mínimo', async () => {
    const user = await createTestUser();
    await expect(updateWorkerSearchRadius(user.id, 0)).rejects.toThrow('Raio de busca precisa ser');
  });

  it('rejeita valor acima do máximo', async () => {
    const user = await createTestUser();
    await expect(updateWorkerSearchRadius(user.id, 101)).rejects.toThrow('Raio de busca precisa ser');
  });

  it('rejeita quando o trabalhador ainda não tem perfil', async () => {
    const [user] = await db.insert(users).values({ phone: '+5511966660081' }).returning();
    await expect(updateWorkerSearchRadius(user.id, 20)).rejects.toThrow('Complete seu cadastro');
    await db.delete(users).where(eq(users.id, user.id));
  });

  it('salva o novo raio', async () => {
    const user = await createTestUser();

    const result = await updateWorkerSearchRadius(user.id, 30);

    expect(result.searchRadiusKm).toBe(30);
    const updated = await db.query.workerProfiles.findFirst({ where: eq(workerProfiles.userId, user.id) });
    expect(updated?.searchRadiusKm).toBe(30);
  });
});
