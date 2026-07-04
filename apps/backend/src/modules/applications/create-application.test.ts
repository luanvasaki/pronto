import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../../db/client';
import { applications, companies, jobs, skillCategories, users, workerProfiles } from '../../db/schema';
import { createApplication } from './create-application';

// Fixtures únicas entre arquivos de teste (ver README).
const WORKER_PHONE = '+5511966660010';
const OWNER_PHONE = '+5511966660011';
const TEST_CNPJ = '11222333000188';
const TEST_CATEGORY_NAME = 'Categoria de teste — create-application';

const TOMORROW = new Date(Date.now() + 24 * 60 * 60 * 1000);
const TOMORROW_PLUS_5H = new Date(TOMORROW.getTime() + 5 * 60 * 60 * 1000);

async function createWorker() {
  const [user] = await db.insert(users).values({ phone: WORKER_PHONE }).returning();
  await db.insert(workerProfiles).values({ userId: user.id, fullName: 'Ana Souza' });
  return user;
}

async function createJob(overrides: Partial<{ status: 'open' | 'filled' | 'cancelled'; positionsTotal: number; positionsFilled: number }> = {}) {
  const [owner] = await db.insert(users).values({ phone: OWNER_PHONE }).returning();
  const [company] = await db
    .insert(companies)
    .values({ ownerUserId: owner.id, legalName: 'Buffet Aurora Ltda', tradeName: 'Buffet Aurora', cnpj: TEST_CNPJ })
    .returning();
  const [category] = await db.insert(skillCategories).values({ name: TEST_CATEGORY_NAME }).returning();
  const [job] = await db
    .insert(jobs)
    .values({
      companyId: company.id,
      categoryId: category.id,
      description: 'Vaga de teste com descrição detalhada o suficiente.',
      addressLabel: 'Endereço de teste',
      locationLat: -23.55,
      locationLng: -46.63,
      positionsTotal: 2,
      payAmount: '100.00',
      startsAt: TOMORROW,
      endsAt: TOMORROW_PLUS_5H,
      ...overrides,
    })
    .returning();
  return job;
}

describe('createApplication', () => {
  afterEach(async () => {
    const owner = await db.query.users.findFirst({ where: eq(users.phone, OWNER_PHONE) });
    if (owner) {
      const [company] = await db.query.companies.findMany({ where: eq(companies.ownerUserId, owner.id) });
      if (company) {
        const companyJobs = await db.query.jobs.findMany({ where: eq(jobs.companyId, company.id) });
        for (const job of companyJobs) {
          await db.delete(applications).where(eq(applications.jobId, job.id));
        }
        await db.delete(jobs).where(eq(jobs.companyId, company.id));
      }
    }
    await db.delete(users).where(eq(users.phone, WORKER_PHONE));
    await db.delete(users).where(eq(users.phone, OWNER_PHONE));
    await db.delete(skillCategories).where(eq(skillCategories.name, TEST_CATEGORY_NAME));
  });

  it('rejeita quando o worker ainda não tem perfil', async () => {
    const [user] = await db.insert(users).values({ phone: WORKER_PHONE }).returning();
    const job = await createJob();

    await expect(createApplication(user.id, job.id)).rejects.toThrow('Complete seu cadastro');
  });

  it('rejeita vaga inexistente', async () => {
    const worker = await createWorker();

    await expect(createApplication(worker.id, '00000000-0000-0000-0000-000000000000')).rejects.toThrow(
      'Vaga não encontrada',
    );
  });

  it('rejeita vaga já preenchida', async () => {
    const worker = await createWorker();
    const job = await createJob({ status: 'filled', positionsFilled: 2 });

    await expect(createApplication(worker.id, job.id)).rejects.toThrow('não está mais aceitando');
  });

  it('rejeita candidatura duplicada', async () => {
    const worker = await createWorker();
    const job = await createJob();
    await createApplication(worker.id, job.id);

    await expect(createApplication(worker.id, job.id)).rejects.toThrow('já se candidatou');
  });

  it('rejeita candidatura duplicada mesmo em corrida (duas chamadas simultâneas)', async () => {
    const worker = await createWorker();
    const job = await createJob();

    const results = await Promise.allSettled([
      createApplication(worker.id, job.id),
      createApplication(worker.id, job.id),
    ]);

    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter((result) => result.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason.message).toContain('já se candidatou');
  });

  it('cria a candidatura com status "pending"', async () => {
    const worker = await createWorker();
    const job = await createJob();

    const result = await createApplication(worker.id, job.id);

    expect(result.status).toBe('pending');
    expect(result.jobId).toBe(job.id);
    expect(result.workerId).toBe(worker.id);
  });
});
