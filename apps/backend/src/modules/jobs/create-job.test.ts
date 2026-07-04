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
  });
});
