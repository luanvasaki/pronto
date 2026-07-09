import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../../db/client';
import { skillCategories, users, workerSkills } from '../../db/schema';
import { upsertWorkerProfile } from './upsert-worker-profile';

// Fixtures únicas entre arquivos de teste (ver README).
const TEST_PHONE = '+5511966660001';
const OTHER_PHONE = '+5511966660071';
const CATEGORY_A = 'Categoria de teste — upsert A';
const CATEGORY_B = 'Categoria de teste — upsert B';
const TEST_CPF = '11122233344';
const OTHER_CPF = '55566677788';

async function createTestUser() {
  const [user] = await db.insert(users).values({ phone: TEST_PHONE }).returning();
  return user;
}

describe('upsertWorkerProfile', () => {
  afterEach(async () => {
    // Usuário primeiro (cascade limpa worker_profiles/worker_skills),
    // categoria depois — ver nota de ordem no teste de worker_skills.
    await db.delete(users).where(eq(users.phone, TEST_PHONE));
    await db.delete(users).where(eq(users.phone, OTHER_PHONE));
    await db.delete(skillCategories).where(eq(skillCategories.name, CATEGORY_A));
    await db.delete(skillCategories).where(eq(skillCategories.name, CATEGORY_B));
  });

  it('rejeita nome ausente', async () => {
    const user = await createTestUser();

    await expect(
      upsertWorkerProfile(user.id, { fullName: undefined, categoryIds: ['x'], photoUrl: undefined }),
    ).rejects.toThrow('Nome é obrigatório');
  });

  it('rejeita photoUrl que não é a foto do Google do próprio usuário', async () => {
    const user = await createTestUser();
    const [category] = await db.insert(skillCategories).values({ name: CATEGORY_A }).returning();

    await expect(
      upsertWorkerProfile(user.id, {
        fullName: 'Ana Souza',
        categoryIds: [category.id],
        photoUrl: 'https://attacker.example.com/foto.jpg',
      }),
    ).rejects.toThrow('Foto de perfil inválida');
  });

  it('aceita photoUrl igual ao googlePhotoUrl do usuário', async () => {
    const googlePhotoUrl = 'https://lh3.googleusercontent.com/a/foto-teste';
    const [user] = await db
      .insert(users)
      .values({ phone: TEST_PHONE, googlePhotoUrl })
      .returning();
    const [category] = await db.insert(skillCategories).values({ name: CATEGORY_A }).returning();

    const result = await upsertWorkerProfile(user.id, {
      fullName: 'Ana Souza',
      categoryIds: [category.id],
      photoUrl: googlePhotoUrl,
    });

    expect(result.photoUrl).toBe(googlePhotoUrl);
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

  it('salva bio e CPF quando informados', async () => {
    const user = await createTestUser();
    const [category] = await db.insert(skillCategories).values({ name: CATEGORY_A }).returning();

    const result = await upsertWorkerProfile(user.id, {
      fullName: 'Ana Souza',
      categoryIds: [category.id],
      bio: 'Garçonete com 5 anos de experiência em eventos.',
      cpf: TEST_CPF,
    });

    expect(result.bio).toBe('Garçonete com 5 anos de experiência em eventos.');
    expect(result.cpf).toBe(TEST_CPF);
  });

  it('rejeita CPF com formato inválido', async () => {
    const user = await createTestUser();
    const [category] = await db.insert(skillCategories).values({ name: CATEGORY_A }).returning();

    await expect(
      upsertWorkerProfile(user.id, { fullName: 'Ana Souza', categoryIds: [category.id], cpf: '123' }),
    ).rejects.toThrow('CPF inválido');
  });

  it('rejeita CPF já usado por outro trabalhador', async () => {
    const user = await createTestUser();
    const [otherUser] = await db.insert(users).values({ phone: OTHER_PHONE }).returning();
    const [category] = await db.insert(skillCategories).values({ name: CATEGORY_A }).returning();
    await upsertWorkerProfile(otherUser.id, { fullName: 'Outra Pessoa', categoryIds: [category.id], cpf: OTHER_CPF });

    await expect(
      upsertWorkerProfile(user.id, { fullName: 'Ana Souza', categoryIds: [category.id], cpf: OTHER_CPF }),
    ).rejects.toThrow('Esse CPF já está cadastrado');
  });

  it('preserva bio e CPF já salvos quando uma atualização posterior não os reenvia', async () => {
    const user = await createTestUser();
    const [category] = await db.insert(skillCategories).values({ name: CATEGORY_A }).returning();
    await upsertWorkerProfile(user.id, {
      fullName: 'Ana Souza',
      categoryIds: [category.id],
      bio: 'Bio original.',
      cpf: TEST_CPF,
    });

    const updated = await upsertWorkerProfile(user.id, { fullName: 'Ana Souza Lima', categoryIds: [category.id] });

    expect(updated.fullName).toBe('Ana Souza Lima');
    expect(updated.bio).toBe('Bio original.');
    expect(updated.cpf).toBe(TEST_CPF);
  });

  it('salva a experiência declarada por categoria', async () => {
    const user = await createTestUser();
    const [categoryA] = await db.insert(skillCategories).values({ name: CATEGORY_A }).returning();
    const [categoryB] = await db.insert(skillCategories).values({ name: CATEGORY_B }).returning();

    const result = await upsertWorkerProfile(user.id, {
      fullName: 'Ana Souza',
      categoryIds: [categoryA.id, categoryB.id],
      experienceByCategory: { [categoryA.id]: true, [categoryB.id]: false },
    });

    expect(result.experienceByCategory[categoryA.id]).toBe(true);
    expect(result.experienceByCategory[categoryB.id]).toBe(false);
    const skillA = await db.query.workerSkills.findFirst({
      where: eq(workerSkills.categoryId, categoryA.id),
    });
    expect(skillA?.hasExperience).toBe(true);
  });

  it('preserva a experiência já declarada quando uma atualização posterior não a reenvia', async () => {
    const user = await createTestUser();
    const [categoryA] = await db.insert(skillCategories).values({ name: CATEGORY_A }).returning();
    const [categoryB] = await db.insert(skillCategories).values({ name: CATEGORY_B }).returning();
    await upsertWorkerProfile(user.id, {
      fullName: 'Ana Souza',
      categoryIds: [categoryA.id],
      experienceByCategory: { [categoryA.id]: true },
    });

    // Adiciona categoryB sem reenviar experienceByCategory — igual ao
    // que a tela de perfil faz ao só ligar/desligar um chip.
    const updated = await upsertWorkerProfile(user.id, {
      fullName: 'Ana Souza',
      categoryIds: [categoryA.id, categoryB.id],
    });

    expect(updated.experienceByCategory[categoryA.id]).toBe(true);
    expect(updated.experienceByCategory[categoryB.id]).toBe(false);
  });
});
