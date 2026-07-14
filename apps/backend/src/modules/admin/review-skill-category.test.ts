import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../../db/client';
import { skillCategories, users } from '../../db/schema';
import { reviewSkillCategory } from './review-skill-category';

// Fixture única entre arquivos de teste (ver README).
const TEST_CATEGORY_NAME = 'Categoria pendente de teste';
const TEST_CATEGORY_NAME_FIXED = 'Categoria Pendente De Teste';
const ADMIN_PHONE = '+5511966660100';

async function setupPendingCategory(name = TEST_CATEGORY_NAME) {
  const [category] = await db.insert(skillCategories).values({ name, status: 'pending' }).returning();
  return category;
}

async function setupAdmin() {
  const [admin] = await db.insert(users).values({ phone: ADMIN_PHONE, isAdmin: true }).returning();
  return admin;
}

describe('reviewSkillCategory', () => {
  afterEach(async () => {
    await db.delete(skillCategories).where(eq(skillCategories.name, TEST_CATEGORY_NAME));
    await db.delete(skillCategories).where(eq(skillCategories.name, TEST_CATEGORY_NAME_FIXED));
    await db.delete(users).where(eq(users.phone, ADMIN_PHONE));
  });

  it('rejeita status inválido', async () => {
    const admin = await setupAdmin();
    const category = await setupPendingCategory();

    await expect(reviewSkillCategory(admin.id, category.id, 'invalido', undefined)).rejects.toThrow(
      'Status inválido',
    );
  });

  it('rejeita categoria inexistente', async () => {
    const admin = await setupAdmin();

    await expect(
      reviewSkillCategory(admin.id, '00000000-0000-0000-0000-000000000000', 'approved', undefined),
    ).rejects.toThrow('não encontrada');
  });

  it('aprova a categoria sem alterar o nome e registra quem revisou', async () => {
    const admin = await setupAdmin();
    const category = await setupPendingCategory();

    const result = await reviewSkillCategory(admin.id, category.id, 'approved', undefined);

    expect(result.status).toBe('approved');
    expect(result.name).toBe(TEST_CATEGORY_NAME);
    const updated = await db.query.skillCategories.findFirst({ where: eq(skillCategories.id, category.id) });
    expect(updated?.reviewedBy).toBe(admin.id);
    expect(updated?.reviewedAt).toBeInstanceOf(Date);
  });

  it('aprova corrigindo o nome', async () => {
    const admin = await setupAdmin();
    const category = await setupPendingCategory();

    const result = await reviewSkillCategory(admin.id, category.id, 'approved', TEST_CATEGORY_NAME_FIXED);

    expect(result.status).toBe('approved');
    expect(result.name).toBe(TEST_CATEGORY_NAME_FIXED);
  });

  it('rejeita a categoria', async () => {
    const admin = await setupAdmin();
    const category = await setupPendingCategory();

    const result = await reviewSkillCategory(admin.id, category.id, 'rejected', undefined);

    expect(result.status).toBe('rejected');
  });

  it('rejeita revisar a mesma categoria duas vezes', async () => {
    const admin = await setupAdmin();
    const category = await setupPendingCategory();
    await reviewSkillCategory(admin.id, category.id, 'approved', undefined);

    await expect(reviewSkillCategory(admin.id, category.id, 'rejected', undefined)).rejects.toThrow(
      'já foi revisada',
    );
  });

  it('rejeita revisar a mesma categoria duas vezes mesmo em corrida (duas chamadas simultâneas)', async () => {
    const admin = await setupAdmin();
    const category = await setupPendingCategory();

    const results = await Promise.allSettled([
      reviewSkillCategory(admin.id, category.id, 'approved', undefined),
      reviewSkillCategory(admin.id, category.id, 'rejected', undefined),
    ]);

    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter((result) => result.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason.message).toContain('já foi revisada');
  });
});
