import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../client';
import { companies } from './companies';
import { jobs } from './jobs';
import { skillCategories } from './skill-categories';
import { users } from './users';

// Fixtures precisam ser únicas entre arquivos de teste, não só dentro
// de um arquivo — os testes rodam em paralelo contra o mesmo Postgres.
const TEST_PHONE = '+5511966660000';
const TEST_CNPJ = '11222333000144';
const TEST_CATEGORY_NAME = 'Categoria de teste — jobs';

async function createTestCompanyAndCategory() {
  const [owner] = await db.insert(users).values({ phone: TEST_PHONE }).returning();
  const [company] = await db
    .insert(companies)
    .values({
      ownerUserId: owner.id,
      legalName: 'Buffet Aurora Ltda',
      tradeName: 'Buffet Aurora',
      cnpj: TEST_CNPJ,
    })
    .returning();
  const [category] = await db
    .insert(skillCategories)
    .values({ name: TEST_CATEGORY_NAME })
    .returning();

  return { owner, company, category };
}

function baseJobValues(companyId: string, categoryId: string) {
  return {
    companyId,
    categoryId,
    description: 'Uniforme preto próprio, experiência em eventos.',
    addressLabel: 'Vila Madalena, São Paulo',
    locationLat: -23.546,
    locationLng: -46.69,
    positionsTotal: 4,
    payAmount: '130.00',
    startsAt: new Date('2026-08-01T18:00:00-03:00'),
    endsAt: new Date('2026-08-01T23:00:00-03:00'),
  };
}

describe('tabela jobs', () => {
  afterEach(async () => {
    // Vaga bloqueia exclusão da empresa (FK sem cascade, de propósito —
    // ver comentário no schema). Por isso a limpeza precisa apagar a
    // vaga antes de descer até empresa/usuário, nessa ordem.
    const owner = await db.query.users.findFirst({ where: eq(users.phone, TEST_PHONE) });
    if (owner) {
      const ownedCompanies = await db.query.companies.findMany({
        where: eq(companies.ownerUserId, owner.id),
      });
      for (const company of ownedCompanies) {
        await db.delete(jobs).where(eq(jobs.companyId, company.id));
      }
    }

    await db.delete(skillCategories).where(eq(skillCategories.name, TEST_CATEGORY_NAME));
    await db.delete(users).where(eq(users.phone, TEST_PHONE));
  });

  it('cria uma vaga com status "open" e 0 posições preenchidas por padrão', async () => {
    const { company, category } = await createTestCompanyAndCategory();

    const [job] = await db
      .insert(jobs)
      .values(baseJobValues(company.id, category.id))
      .returning();

    expect(job.status).toBe('open');
    expect(job.positionsFilled).toBe(0);
    expect(job.positionsTotal).toBe(4);
  });

  it('não permite apagar uma empresa que já tem vaga publicada', async () => {
    const { company, category } = await createTestCompanyAndCategory();
    await db.insert(jobs).values(baseJobValues(company.id, category.id));

    await expect(db.delete(companies).where(eq(companies.id, company.id))).rejects.toThrow();
  });
});
