import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../client';
import { users } from './users';
import { workerProfiles } from './worker-profiles';

const TEST_PHONE = '+5511988880000';

async function createTestUser() {
  const [user] = await db.insert(users).values({ phone: TEST_PHONE }).returning();
  return user;
}

describe('tabela worker_profiles', () => {
  afterEach(async () => {
    await db.delete(users).where(eq(users.phone, TEST_PHONE));
  });

  it('cria um perfil com os valores padrão esperados', async () => {
    const user = await createTestUser();

    const [profile] = await db
      .insert(workerProfiles)
      .values({ userId: user.id, fullName: 'Carlos Silva' })
      .returning();

    expect(profile.searchRadiusKm).toBe(10);
    expect(profile.kycStatus).toBe('pending');
    expect(profile.totalShiftsCompleted).toBe(0);
    expect(profile.totalNoShows).toBe(0);
  });

  it('não permite perfil sem um usuário existente', async () => {
    const fakeUserId = '00000000-0000-0000-0000-000000000000';

    await expect(
      db.insert(workerProfiles).values({ userId: fakeUserId, fullName: 'Ninguém' }),
    ).rejects.toThrow();
  });

  it('remove o perfil junto quando o usuário é removido (cascade)', async () => {
    const user = await createTestUser();
    await db.insert(workerProfiles).values({ userId: user.id, fullName: 'Carlos Silva' });

    await db.delete(users).where(eq(users.id, user.id));

    const remaining = await db
      .select()
      .from(workerProfiles)
      .where(eq(workerProfiles.userId, user.id));

    expect(remaining).toHaveLength(0);
  });
});
