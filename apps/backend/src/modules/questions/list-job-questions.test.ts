import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../../db/client';
import { applications, companies, jobQuestions, jobs, skillCategories, users, workerProfiles } from '../../db/schema';
import { listJobQuestions } from './list-job-questions';

const OWNER_PHONE = '+5511966660050';
const WORKER_PHONE = '+5511966660051';
const OTHER_WORKER_PHONE = '+5511966660052';
const OUTSIDER_PHONE = '+5511966660053';
const TEST_CNPJ = '11222333000233';
const TEST_CATEGORY_NAME = 'Categoria de teste — list-job-questions';

const TOMORROW = new Date(Date.now() + 24 * 60 * 60 * 1000);
const TOMORROW_PLUS_5H = new Date(TOMORROW.getTime() + 5 * 60 * 60 * 1000);

async function setup() {
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
    })
    .returning();
  const [worker] = await db.insert(users).values({ phone: WORKER_PHONE }).returning();
  await db.insert(workerProfiles).values({ userId: worker.id, fullName: 'Ana Souza', kycStatus: 'approved' });
  await db.insert(applications).values({ jobId: job.id, workerId: worker.id });
  await db.insert(jobQuestions).values({ jobId: job.id, workerId: worker.id, question: 'Tem vestiário?' });

  const [otherWorker] = await db.insert(users).values({ phone: OTHER_WORKER_PHONE }).returning();
  await db.insert(workerProfiles).values({ userId: otherWorker.id, fullName: 'Bruno Lima', kycStatus: 'approved' });
  await db.insert(applications).values({ jobId: job.id, workerId: otherWorker.id });

  return { owner, job, otherWorker };
}

describe('listJobQuestions', () => {
  afterEach(async () => {
    const owner = await db.query.users.findFirst({ where: eq(users.phone, OWNER_PHONE) });
    if (owner) {
      const [company] = await db.query.companies.findMany({ where: eq(companies.ownerUserId, owner.id) });
      if (company) {
        const companyJobs = await db.query.jobs.findMany({ where: eq(jobs.companyId, company.id) });
        for (const job of companyJobs) {
          await db.delete(jobQuestions).where(eq(jobQuestions.jobId, job.id));
          await db.delete(applications).where(eq(applications.jobId, job.id));
        }
        await db.delete(jobs).where(eq(jobs.companyId, company.id));
      }
    }
    await db.delete(users).where(eq(users.phone, WORKER_PHONE));
    await db.delete(users).where(eq(users.phone, OTHER_WORKER_PHONE));
    await db.delete(users).where(eq(users.phone, OUTSIDER_PHONE));
    await db.delete(users).where(eq(users.phone, OWNER_PHONE));
    await db.delete(skillCategories).where(eq(skillCategories.name, TEST_CATEGORY_NAME));
  });

  it('deixa o dono da empresa ver as perguntas', async () => {
    const { owner, job } = await setup();
    const result = await listJobQuestions(owner.id, job.id);
    expect(result).toHaveLength(1);
    expect(result[0].worker.fullName).toBe('Ana Souza');
  });

  it('deixa outro inscrito (que não perguntou) ver a pergunta — FAQ pública', async () => {
    const { job, otherWorker } = await setup();
    const result = await listJobQuestions(otherWorker.id, job.id);
    expect(result).toHaveLength(1);
  });

  it('rejeita quem não é dono nem inscrito', async () => {
    const { job } = await setup();
    const [outsider] = await db.insert(users).values({ phone: OUTSIDER_PHONE }).returning();

    await expect(listJobQuestions(outsider.id, job.id)).rejects.toThrow('Você não tem acesso');
  });
});
