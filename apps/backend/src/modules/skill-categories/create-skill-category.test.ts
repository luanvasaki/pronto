import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../../db/client';
import { companies, skillCategories, users, workerProfiles } from '../../db/schema';
import { createSkillCategory } from './create-skill-category';

// Fixtures únicas entre arquivos de teste (ver README).
const TEST_PHONE = '+5511966660070';
const WORKER_PHONE = '+5511966660072';
const TEST_CNPJ = '11222333000212';
const TEST_CATEGORY_NAME = 'Manobrista de teste';
const WORKER_CATEGORY_NAME = 'Fotógrafo de teste';

async function createTestCompanyOwner() {
  const [owner] = await db.insert(users).values({ phone: TEST_PHONE }).returning();
  await db
    .insert(companies)
    .values({ ownerUserId: owner.id, legalName: 'Bar Teste Ltda', tradeName: 'Bar Teste', cnpj: TEST_CNPJ });
  return owner;
}

async function createTestWorker() {
  const [worker] = await db.insert(users).values({ phone: WORKER_PHONE }).returning();
  await db.insert(workerProfiles).values({ userId: worker.id, fullName: 'Rafael Lima' });
  return worker;
}

describe('createSkillCategory', () => {
  afterEach(async () => {
    await db.delete(skillCategories).where(eq(skillCategories.name, TEST_CATEGORY_NAME));
    await db.delete(skillCategories).where(eq(skillCategories.name, TEST_CATEGORY_NAME.toUpperCase()));
    await db.delete(skillCategories).where(eq(skillCategories.name, WORKER_CATEGORY_NAME));
    await db.delete(users).where(eq(users.phone, TEST_PHONE));
    await db.delete(users).where(eq(users.phone, WORKER_PHONE));
  });

  it('cria a categoria mesmo quando o usuário ainda não tem empresa nem perfil de trabalhador (cadastro em andamento)', async () => {
    const [owner] = await db.insert(users).values({ phone: TEST_PHONE }).returning();

    const result = await createSkillCategory(owner.id, TEST_CATEGORY_NAME);

    expect(result.name).toBe(TEST_CATEGORY_NAME);
    const row = await db.query.skillCategories.findFirst({ where: eq(skillCategories.id, result.id) });
    expect(row?.status).toBe('pending');
    expect(row?.createdByCompanyId).toBeNull();
    expect(row?.createdByWorkerId).toBeNull();
  });

  it('rejeita nome vazio ou muito curto', async () => {
    const owner = await createTestCompanyOwner();

    await expect(createSkillCategory(owner.id, ' ')).rejects.toThrow('Nome da categoria precisa ter');
    await expect(createSkillCategory(owner.id, 'a')).rejects.toThrow('Nome da categoria precisa ter');
  });

  it('cria a categoria como "pending" com a empresa criadora', async () => {
    const owner = await createTestCompanyOwner();
    const company = await db.query.companies.findFirst({ where: eq(companies.ownerUserId, owner.id) });

    const result = await createSkillCategory(owner.id, TEST_CATEGORY_NAME);

    expect(result.name).toBe(TEST_CATEGORY_NAME);
    const row = await db.query.skillCategories.findFirst({ where: eq(skillCategories.id, result.id) });
    expect(row?.status).toBe('pending');
    expect(row?.createdByCompanyId).toBe(company?.id);
  });

  it('reaproveita categoria já existente com o mesmo nome (ignorando maiúsculas)', async () => {
    const owner = await createTestCompanyOwner();
    const first = await createSkillCategory(owner.id, TEST_CATEGORY_NAME);

    const second = await createSkillCategory(owner.id, TEST_CATEGORY_NAME.toUpperCase());

    expect(second.id).toBe(first.id);
    const rows = await db.query.skillCategories.findMany({ where: eq(skillCategories.id, first.id) });
    expect(rows).toHaveLength(1);
  });

  it('mesmo em corrida (duas chamadas simultâneas com o mesmo nome), as duas resolvem pra uma só categoria', async () => {
    const owner = await createTestCompanyOwner();

    const [first, second] = await Promise.all([
      createSkillCategory(owner.id, TEST_CATEGORY_NAME),
      createSkillCategory(owner.id, TEST_CATEGORY_NAME),
    ]);

    expect(first.id).toBe(second.id);
    const rows = await db.query.skillCategories.findMany({ where: eq(skillCategories.name, TEST_CATEGORY_NAME) });
    expect(rows).toHaveLength(1);
  });

  it('mesmo em corrida com nomes diferindo só na caixa, as duas resolvem pra uma só categoria', async () => {
    const owner = await createTestCompanyOwner();

    const [first, second] = await Promise.all([
      createSkillCategory(owner.id, TEST_CATEGORY_NAME),
      createSkillCategory(owner.id, TEST_CATEGORY_NAME.toUpperCase()),
    ]);

    expect(first.id).toBe(second.id);
    const rows = await db.query.skillCategories.findMany({
      where: eq(skillCategories.name, TEST_CATEGORY_NAME),
    });
    const rowsUpper = await db.query.skillCategories.findMany({
      where: eq(skillCategories.name, TEST_CATEGORY_NAME.toUpperCase()),
    });
    expect(rows.length + rowsUpper.length).toBe(1);
  });

  it('cria a categoria como "pending" com o trabalhador criador', async () => {
    const worker = await createTestWorker();

    const result = await createSkillCategory(worker.id, WORKER_CATEGORY_NAME);

    expect(result.name).toBe(WORKER_CATEGORY_NAME);
    const row = await db.query.skillCategories.findFirst({ where: eq(skillCategories.id, result.id) });
    expect(row?.status).toBe('pending');
    expect(row?.createdByWorkerId).toBe(worker.id);
    expect(row?.createdByCompanyId).toBeNull();
  });
});
