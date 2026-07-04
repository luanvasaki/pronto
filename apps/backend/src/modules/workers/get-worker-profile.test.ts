import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../../db/client';
import { skillCategories, users, workerProfiles } from '../../db/schema';
import { upsertWorkerProfile } from './upsert-worker-profile';
import { getWorkerProfile } from './get-worker-profile';

// Fixtures únicas entre arquivos de teste (ver README).
const TEST_PHONE = '+5511966660035';
const TEST_CATEGORY_NAME = 'Categoria de teste — get-worker-profile';

describe('getWorkerProfile', () => {
  afterEach(async () => {
    await db.delete(users).where(eq(users.phone, TEST_PHONE));
    await db.delete(skillCategories).where(eq(skillCategories.name, TEST_CATEGORY_NAME));
  });

  it('rejeita quem ainda não completou o cadastro', async () => {
    const [user] = await db.insert(users).values({ phone: TEST_PHONE }).returning();

    await expect(getWorkerProfile(user.id)).rejects.toThrow('Complete seu cadastro');
  });

  it('retorna nome, categorias e estatísticas do trabalhador', async () => {
    const [user] = await db.insert(users).values({ phone: TEST_PHONE }).returning();
    const [category] = await db.insert(skillCategories).values({ name: TEST_CATEGORY_NAME }).returning();
    await upsertWorkerProfile(user.id, { fullName: 'Ana Souza', categoryIds: [category.id] });

    const result = await getWorkerProfile(user.id);

    expect(result.fullName).toBe('Ana Souza');
    expect(result.categoryIds).toEqual([category.id]);
    expect(result.kycStatus).toBe('pending');
    expect(result.totalShiftsCompleted).toBe(0);
    expect(result.totalNoShows).toBe(0);
    expect(result.avgRating).toBeNull();
  });

  it('reflete avgRating quando já existe', async () => {
    const [user] = await db.insert(users).values({ phone: TEST_PHONE }).returning();
    const [category] = await db.insert(skillCategories).values({ name: TEST_CATEGORY_NAME }).returning();
    await upsertWorkerProfile(user.id, { fullName: 'Ana Souza', categoryIds: [category.id] });
    await db.update(workerProfiles).set({ avgRating: '4.5', totalShiftsCompleted: 3 }).where(eq(workerProfiles.userId, user.id));

    const result = await getWorkerProfile(user.id);

    expect(result.avgRating).toBe('4.5');
    expect(result.totalShiftsCompleted).toBe(3);
  });
});
