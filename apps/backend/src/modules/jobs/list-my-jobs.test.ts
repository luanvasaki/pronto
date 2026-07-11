import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../../db/client';
import { companies, jobs, skillCategories, users } from '../../db/schema';
import { createJob } from './create-job';
import { listMyJobs } from './list-my-jobs';

// Fixtures únicas entre arquivos de teste (ver README).
const TEST_PHONE = '+5511966660007';
const TEST_CNPJ = '11222333000166';
const TEST_CATEGORY_NAME = 'Categoria de teste — list-my-jobs';

const TOMORROW = new Date(Date.now() + 24 * 60 * 60 * 1000);
const TOMORROW_PLUS_5H = new Date(TOMORROW.getTime() + 5 * 60 * 60 * 1000);

async function createTestCompanyOwner() {
  const [owner] = await db.insert(users).values({ phone: TEST_PHONE }).returning();
  return owner;
}

describe('listMyJobs', () => {
  afterEach(async () => {
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

  it('retorna lista vazia pra quem ainda não tem empresa', async () => {
    const owner = await createTestCompanyOwner();

    const result = await listMyJobs(owner.id);

    expect(result).toEqual([]);
  });

  it('lista só as vagas da empresa do dono, mais recente primeiro', async () => {
    const owner = await createTestCompanyOwner();
    await db
      .insert(companies)
      .values({ verificationStatus: 'approved', ownerUserId: owner.id, legalName: 'Buffet Aurora Ltda', tradeName: 'Buffet Aurora', cnpj: TEST_CNPJ });
    const [category] = await db.insert(skillCategories).values({ name: TEST_CATEGORY_NAME }).returning();

    const first = await createJob(owner.id, {
      categoryId: category.id,
      description: 'Primeira vaga publicada, descrição bem detalhada.',
      requiresExperience: false,
      addressLabel: 'Vila Madalena, São Paulo',
      locationLat: -23.546,
      locationLng: -46.69,
      positionsTotal: 2,
      payAmount: '100.00',
      startsAt: TOMORROW.toISOString(),
      endsAt: TOMORROW_PLUS_5H.toISOString(),
    });
    const second = await createJob(owner.id, {
      categoryId: category.id,
      description: 'Segunda vaga publicada, descrição bem detalhada.',
      requiresExperience: false,
      addressLabel: 'Vila Madalena, São Paulo',
      locationLat: -23.546,
      locationLng: -46.69,
      positionsTotal: 3,
      payAmount: '150.00',
      startsAt: TOMORROW.toISOString(),
      endsAt: TOMORROW_PLUS_5H.toISOString(),
    });

    const result = await listMyJobs(owner.id);

    expect(result.map((job) => job.id)).toEqual([second.id, first.id]);
  });
});
