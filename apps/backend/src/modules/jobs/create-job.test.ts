import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../../db/client';
import { companies, jobs, skillCategories, users } from '../../db/schema';
import { createJob } from './create-job';

// Fixtures únicas entre arquivos de teste (ver README).
const TEST_PHONE = '+5511966660006';
const TEST_CNPJ = '11222333000155';
const TEST_CATEGORY_NAME = 'Categoria de teste — create-job';

const TOMORROW = new Date(Date.now() + 24 * 60 * 60 * 1000);
const TOMORROW_PLUS_5H = new Date(TOMORROW.getTime() + 5 * 60 * 60 * 1000);

function baseInput(categoryId: string) {
  return {
    categoryId,
    description: 'Uniforme preto próprio, experiência em eventos.',
    requiresExperience: false,
    addressLabel: 'Vila Madalena, São Paulo',
    locationLat: -23.546,
    locationLng: -46.69,
    positionsTotal: 4,
    payAmount: '130.00',
    startsAt: TOMORROW.toISOString(),
    endsAt: TOMORROW_PLUS_5H.toISOString(),
  };
}

async function createTestCompanyOwner() {
  const [owner] = await db.insert(users).values({ phone: TEST_PHONE }).returning();
  return owner;
}

async function createTestCompany(ownerUserId: string) {
  const [company] = await db
    .insert(companies)
    .values({ ownerUserId, legalName: 'Buffet Aurora Ltda', tradeName: 'Buffet Aurora', cnpj: TEST_CNPJ })
    .returning();
  return company;
}

describe('createJob', () => {
  afterEach(async () => {
    // jobs não tem cascade a partir de companies (de propósito, ver
    // schema) — apaga a vaga antes da empresa/usuário, nessa ordem.
    const owner = await db.query.users.findFirst({ where: eq(users.phone, TEST_PHONE) });
    if (owner) {
      const [company] = await db.query.companies.findMany({ where: eq(companies.ownerUserId, owner.id) });
      if (company) {
        await db.delete(jobs).where(eq(jobs.companyId, company.id));
      }
    }
    await db.delete(users).where(eq(users.phone, TEST_PHONE));
    await db.delete(skillCategories).where(eq(skillCategories.name, TEST_CATEGORY_NAME));
  });

  it('rejeita quando o usuário não tem empresa cadastrada', async () => {
    const owner = await createTestCompanyOwner();
    const [category] = await db.insert(skillCategories).values({ name: TEST_CATEGORY_NAME }).returning();

    await expect(createJob(owner.id, baseInput(category.id))).rejects.toThrow(
      'Complete o cadastro da empresa',
    );
  });

  it('rejeita categoria inválida', async () => {
    const owner = await createTestCompanyOwner();
    await createTestCompany(owner.id);

    await expect(
      createJob(owner.id, baseInput('00000000-0000-0000-0000-000000000000')),
    ).rejects.toThrow('Categoria inválida');
  });

  it('rejeita descrição curta', async () => {
    const owner = await createTestCompanyOwner();
    await createTestCompany(owner.id);
    const [category] = await db.insert(skillCategories).values({ name: TEST_CATEGORY_NAME }).returning();

    await expect(
      createJob(owner.id, { ...baseInput(category.id), description: 'curta' }),
    ).rejects.toThrow('Descrição precisa');
  });

  it('rejeita data de término antes do início', async () => {
    const owner = await createTestCompanyOwner();
    await createTestCompany(owner.id);
    const [category] = await db.insert(skillCategories).values({ name: TEST_CATEGORY_NAME }).returning();

    await expect(
      createJob(owner.id, { ...baseInput(category.id), startsAt: TOMORROW_PLUS_5H.toISOString(), endsAt: TOMORROW.toISOString() }),
    ).rejects.toThrow('Data de término precisa ser depois do início');
  });

  it('rejeita data de início no passado', async () => {
    const owner = await createTestCompanyOwner();
    await createTestCompany(owner.id);
    const [category] = await db.insert(skillCategories).values({ name: TEST_CATEGORY_NAME }).returning();
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

    await expect(
      createJob(owner.id, { ...baseInput(category.id), startsAt: yesterday.toISOString() }),
    ).rejects.toThrow('Data de início precisa ser no futuro');
  });

  it('cria a vaga com status "open" por padrão', async () => {
    const owner = await createTestCompanyOwner();
    await createTestCompany(owner.id);
    const [category] = await db.insert(skillCategories).values({ name: TEST_CATEGORY_NAME }).returning();

    const result = await createJob(owner.id, baseInput(category.id));

    expect(result.status).toBe('open');
    expect(result.positionsFilled).toBe(0);
    expect(result.positionsTotal).toBe(4);
    expect(result.requiresExperience).toBe(false);
    expect(result.dressCode).toBeNull();
    expect(result.toolsRequired).toBeNull();
  });

  it('rejeita quando requiresExperience não é informado', async () => {
    const owner = await createTestCompanyOwner();
    await createTestCompany(owner.id);
    const [category] = await db.insert(skillCategories).values({ name: TEST_CATEGORY_NAME }).returning();

    await expect(
      createJob(owner.id, { ...baseInput(category.id), requiresExperience: undefined }),
    ).rejects.toThrow('Informe se a vaga exige experiência anterior');
  });

  it('salva vestimenta e ferramentas exigidas quando informadas', async () => {
    const owner = await createTestCompanyOwner();
    await createTestCompany(owner.id);
    const [category] = await db.insert(skillCategories).values({ name: TEST_CATEGORY_NAME }).returning();

    const result = await createJob(owner.id, {
      ...baseInput(category.id),
      requiresExperience: true,
      dressCode: 'Social completo, preto e branco',
      toolsRequired: 'Câmera profissional própria',
    });

    expect(result.requiresExperience).toBe(true);
    expect(result.dressCode).toBe('Social completo, preto e branco');
    expect(result.toolsRequired).toBe('Câmera profissional própria');
  });

  it('deixa applicationsCloseAt nulo quando não informado (usa o padrão de 1h antes)', async () => {
    const owner = await createTestCompanyOwner();
    await createTestCompany(owner.id);
    const [category] = await db.insert(skillCategories).values({ name: TEST_CATEGORY_NAME }).returning();

    const result = await createJob(owner.id, baseInput(category.id));

    expect(result.applicationsCloseAt).toBeNull();
  });

  it('salva applicationsCloseAt quando a empresa escolhe um prazo', async () => {
    const owner = await createTestCompanyOwner();
    await createTestCompany(owner.id);
    const [category] = await db.insert(skillCategories).values({ name: TEST_CATEGORY_NAME }).returning();
    const closeAt = new Date(TOMORROW.getTime() - 3 * 60 * 60 * 1000);

    const result = await createJob(owner.id, {
      ...baseInput(category.id),
      applicationsCloseAt: closeAt.toISOString(),
    });

    expect(result.applicationsCloseAt?.toISOString()).toBe(closeAt.toISOString());
  });

  it('rejeita applicationsCloseAt depois do início do turno', async () => {
    const owner = await createTestCompanyOwner();
    await createTestCompany(owner.id);
    const [category] = await db.insert(skillCategories).values({ name: TEST_CATEGORY_NAME }).returning();
    const afterStart = new Date(TOMORROW.getTime() + 60 * 60 * 1000);

    await expect(
      createJob(owner.id, { ...baseInput(category.id), applicationsCloseAt: afterStart.toISOString() }),
    ).rejects.toThrow('até o início do turno');
  });

  it('rejeita applicationsCloseAt no passado', async () => {
    const owner = await createTestCompanyOwner();
    await createTestCompany(owner.id);
    const [category] = await db.insert(skillCategories).values({ name: TEST_CATEGORY_NAME }).returning();
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

    await expect(
      createJob(owner.id, { ...baseInput(category.id), applicationsCloseAt: yesterday.toISOString() }),
    ).rejects.toThrow('Prazo pra se candidatar precisa ser no futuro');
  });

  it('rejeita categoria de CNH inválida', async () => {
    const owner = await createTestCompanyOwner();
    await createTestCompany(owner.id);
    const [category] = await db.insert(skillCategories).values({ name: TEST_CATEGORY_NAME }).returning();

    await expect(
      createJob(owner.id, { ...baseInput(category.id), cnhCategory: 'Z' }),
    ).rejects.toThrow('Categoria de CNH inválida');
  });

  it('rejeita cnhRequired sem escolher a categoria', async () => {
    const owner = await createTestCompanyOwner();
    await createTestCompany(owner.id);
    const [category] = await db.insert(skillCategories).values({ name: TEST_CATEGORY_NAME }).returning();

    await expect(
      createJob(owner.id, { ...baseInput(category.id), cnhRequired: true }),
    ).rejects.toThrow('Escolha a categoria de CNH exigida');
  });

  it('salva a exigência de CNH quando informada', async () => {
    const owner = await createTestCompanyOwner();
    await createTestCompany(owner.id);
    const [category] = await db.insert(skillCategories).values({ name: TEST_CATEGORY_NAME }).returning();

    const result = await createJob(owner.id, {
      ...baseInput(category.id),
      cnhCategory: 'B',
      cnhRequired: true,
    });

    expect(result.cnhCategory).toBe('B');
    expect(result.cnhRequired).toBe(true);
  });

  it('trata cnhRequired como preferência (false) quando não exigido explicitamente', async () => {
    const owner = await createTestCompanyOwner();
    await createTestCompany(owner.id);
    const [category] = await db.insert(skillCategories).values({ name: TEST_CATEGORY_NAME }).returning();

    const result = await createJob(owner.id, { ...baseInput(category.id), cnhCategory: 'B' });

    expect(result.cnhCategory).toBe('B');
    expect(result.cnhRequired).toBe(false);
  });
});
