import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../../db/client';
import { skillCategories, users, workerSkills } from '../../db/schema';
import { upsertWorkerProfile } from './upsert-worker-profile';

// Fixtures únicas entre arquivos de teste (ver README).
const TEST_PHONE = '+5511966660001';
const CATEGORY_A = 'Categoria de teste — upsert A';
const CATEGORY_B = 'Categoria de teste — upsert B';

async function createTestUser() {
  const [user] = await db.insert(users).values({ phone: TEST_PHONE }).returning();
  return user;
}

describe('upsertWorkerProfile', () => {
  afterEach(async () => {
    // Usuário primeiro (cascade limpa worker_profiles/worker_skills),
    // categoria depois — ver nota de ordem no teste de worker_skills.
    await db.delete(users).where(eq(users.phone, TEST_PHONE));
    await db.delete(skillCategories).where(eq(skillCategories.name, CATEGORY_A));
    await db.delete(skillCategories).where(eq(skillCategories.name, CATEGORY_B));
  });

  it('rejeita nome ausente', async () => {
    const user = await createTestUser();

    await expect(
      upsertWorkerProfile(user.id, { fullName: undefined, categoryIds: ['x'] }),
    ).rejects.toThrow('Nome é obrigatório');
  });

  it('rejeita lista de categorias vazia', async () => {
    const user = await createTestUser();

    await expect(
      upsertWorkerProfile(user.id, { fullName: 'Ana Souza', categoryIds: [] }),
    ).rejects.toThrow('Escolha ao menos uma categoria');
  });

  it('rejeita categoria que não existe', async () => {
    const user = await createTestUser();

    await expect(
      upsertWorkerProfile(user.id, {
        fullName: 'Ana Souza',
        categoryIds: ['00000000-0000-0000-0000-000000000000'],
      }),
    ).rejects.toThrow('Categoria inválida');
  });

  it('cria o perfil com as categorias associadas', async () => {
    const user = await createTestUser();
    const [category] = await db.insert(skillCategories).values({ name: CATEGORY_A }).returning();

    const result = await upsertWorkerProfile(user.id, {
      fullName: '  Ana Souza  ',
      categoryIds: [category.id],
    });

    expect(result.fullName).toBe('Ana Souza');
    const skills = await db.query.workerSkills.findMany({
      where: eq(workerSkills.workerId, user.id),
    });
    expect(skills).toHaveLength(1);
  });

  it('atualiza o nome e substitui as categorias numa segunda chamada', async () => {
    const user = await createTestUser();
    const [categoryA] = await db.insert(skillCategories).values({ name: CATEGORY_A }).returning();
    const [categoryB] = await db.insert(skillCategories).values({ name: CATEGORY_B }).returning();

    await upsertWorkerProfile(user.id, { fullName: 'Ana Souza', categoryIds: [categoryA.id] });
    const updated = await upsertWorkerProfile(user.id, {
      fullName: 'Ana Souza Lima',
      categoryIds: [categoryB.id],
    });

    expect(updated.fullName).toBe('Ana Souza Lima');
    const skills = await db.query.workerSkills.findMany({
      where: eq(workerSkills.workerId, user.id),
    });
    expect(skills).toHaveLength(1);
    expect(skills[0].categoryId).toBe(categoryB.id);
  });
});
