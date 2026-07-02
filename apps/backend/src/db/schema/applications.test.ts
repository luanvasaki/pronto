import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { applications } from './applications';
import { db } from '../client';
import { companies } from './companies';
import { jobs } from './jobs';
import { skillCategories } from './skill-categories';
import { users } from './users';
import { workerProfiles } from './worker-profiles';

// Fixtures únicas entre arquivos de teste (ver README — testes rodam
// em paralelo contra o mesmo Postgres).
const COMPANY_OWNER_PHONE = '+5511955550000';
const WORKER_PHONE = '+5511955550001';
const TEST_CNPJ = '55566677000188';
const TEST_CATEGORY_NAME = 'Categoria de teste — applications';

async function createTestJobAndWorker() {
  const [owner] = await db.insert(users).values({ phone: COMPANY_OWNER_PHONE }).returning();
  const [company] = await db
    .insert(companies)
    .values({
      ownerUserId: owner.id,
      legalName: 'Hotel Vega Ltda',
      tradeName: 'Hotel Vega',
      cnpj: TEST_CNPJ,
    })
    .returning();
  const [category] = await db
    .insert(skillCategories)
    .values({ name: TEST_CATEGORY_NAME })
    .returning();
  const [job] = await db
    .insert(jobs)
    .values({
      companyId: company.id,
      categoryId: category.id,
      description: 'Bartender para evento corporativo.',
      addressLabel: 'Itaim Bibi, São Paulo',
      locationLat: -23.585,
      locationLng: -46.679,
      positionsTotal: 2,
      payAmount: '180.00',
      startsAt: new Date('2026-08-02T20:00:00-03:00'),
      endsAt: new Date('2026-08-03T02:00:00-03:00'),
    })
    .returning();

  const [workerUser] = await db.insert(users).values({ phone: WORKER_PHONE }).returning();
  const [workerProfile] = await db
    .insert(workerProfiles)
    .values({ userId: workerUser.id, fullName: 'Ana Souza' })
    .returning();

  return { job, workerProfile };
}

describe('tabela applications', () => {
  afterEach(async () => {
    // Aplica a mesma ordem de limpeza usada em jobs.test.ts: a linha
    // dependente (aqui, applications) sai antes de qualquer coisa que
    // ela referencia sem cascade.
    const testJobs = await db.query.jobs.findMany({
      where: eq(jobs.addressLabel, 'Itaim Bibi, São Paulo'),
    });
    for (const job of testJobs) {
      await db.delete(applications).where(eq(applications.jobId, job.id));
    }
    await db.delete(jobs).where(eq(jobs.addressLabel, 'Itaim Bibi, São Paulo'));
    await db.delete(skillCategories).where(eq(skillCategories.name, TEST_CATEGORY_NAME));
    await db.delete(users).where(eq(users.phone, COMPANY_OWNER_PHONE));
    await db.delete(users).where(eq(users.phone, WORKER_PHONE));
  });

  it('cria uma candidatura com status "pending" por padrão', async () => {
    const { job, workerProfile } = await createTestJobAndWorker();

    const [application] = await db
      .insert(applications)
      .values({ jobId: job.id, workerId: workerProfile.userId })
      .returning();

    expect(application.status).toBe('pending');
  });

  it('não permite duas candidaturas do mesmo trabalhador na mesma vaga', async () => {
    const { job, workerProfile } = await createTestJobAndWorker();
    await db.insert(applications).values({ jobId: job.id, workerId: workerProfile.userId });

    await expect(
      db.insert(applications).values({ jobId: job.id, workerId: workerProfile.userId }),
    ).rejects.toThrow();
  });

  it('não permite apagar uma vaga que já tem candidatura', async () => {
    const { job, workerProfile } = await createTestJobAndWorker();
    await db.insert(applications).values({ jobId: job.id, workerId: workerProfile.userId });

    await expect(db.delete(jobs).where(eq(jobs.id, job.id))).rejects.toThrow();
  });
});
