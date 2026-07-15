import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../../db/client';
import { applications, companies, jobs, skillCategories, users, workerProfiles, workerSkills } from '../../db/schema';
import { createApplication } from '../applications/create-application';
import { createJob } from './create-job';
import { getJobDetailForWorker } from './get-job-detail';

const WORKER_PHONE = '+5511966660070';
const OWNER_PHONE = '+5511966660071';
const TEST_CNPJ = '11112223340421';
const TEST_CATEGORY_NAME = 'Categoria de teste — get-job-detail';

const TOMORROW = new Date(Date.now() + 24 * 60 * 60 * 1000);
const TOMORROW_PLUS_5H = new Date(TOMORROW.getTime() + 5 * 60 * 60 * 1000);

async function setup() {
  const [owner] = await db.insert(users).values({ phone: OWNER_PHONE }).returning();
  await db
    .insert(companies)
    .values({ ownerUserId: owner.id, legalName: 'Buffet Aurora Ltda', tradeName: 'Buffet Aurora', cnpj: TEST_CNPJ, verificationStatus: 'approved' });
  const [category] = await db.insert(skillCategories).values({ name: TEST_CATEGORY_NAME }).returning();
  const job = await createJob(
    owner.id,
    {
      categoryId: category.id,
      description: 'Vaga de teste com descrição detalhada o suficiente.',
      requiresExperience: false,
      addressLabel: 'Endereço de teste',
      locationLat: -23.55,
      locationLng: -46.63,
      positionsTotal: 2,
      payAmount: '100.00',
      startsAt: TOMORROW.toISOString(),
      endsAt: TOMORROW_PLUS_5H.toISOString(),
    },
    true,
  );
  const [worker] = await db.insert(users).values({ phone: WORKER_PHONE }).returning();
  await db.insert(workerProfiles).values({ userId: worker.id, fullName: 'Ana Souza', kycStatus: 'approved' });
  return { worker, job };
}

describe('getJobDetailForWorker', () => {
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

  it('rejeita quando o trabalhador ainda não tem perfil', async () => {
    const { job } = await setup();
    const [outsider] = await db.insert(users).values({ phone: '+5511966660072' }).returning();

    await expect(getJobDetailForWorker(outsider.id, job.id)).rejects.toThrow('Complete seu cadastro');
    await db.delete(users).where(eq(users.id, outsider.id));
  });

  it('rejeita vaga inexistente', async () => {
    const { worker } = await setup();
    await expect(
      getJobDetailForWorker(worker.id, '00000000-0000-0000-0000-000000000000'),
    ).rejects.toThrow('Vaga não encontrada');
  });

  it('deixa ver detalhe de vaga aberta mesmo sem ter se candidatado', async () => {
    const { worker, job } = await setup();

    const result = await getJobDetailForWorker(worker.id, job.id);

    expect(result.description).toBe('Vaga de teste com descrição detalhada o suficiente.');
    expect(result.companyName).toBe('Buffet Aurora');
    expect(result.hasApplied).toBe(false);
  });

  it('marca hasApplied quando o trabalhador já se candidatou', async () => {
    const { worker, job } = await setup();
    await createApplication(worker.id, job.id, true);

    const result = await getJobDetailForWorker(worker.id, job.id);

    expect(result.hasApplied).toBe(true);
  });

  it('rejeita vaga não aberta pra quem nunca se candidatou', async () => {
    const { worker, job } = await setup();
    await db.update(jobs).set({ status: 'cancelled' }).where(eq(jobs.id, job.id));

    await expect(getJobDetailForWorker(worker.id, job.id)).rejects.toThrow('Você não tem acesso');
  });

  it('deixa ver vaga não aberta se o trabalhador já se candidatou antes', async () => {
    const { worker, job } = await setup();
    await createApplication(worker.id, job.id, true);
    await db.update(jobs).set({ status: 'filled' }).where(eq(jobs.id, job.id));

    const result = await getJobDetailForWorker(worker.id, job.id);

    expect(result.status).toBe('filled');
    expect(result.hasApplied).toBe(true);
  });

  it('marca matchesSkills e experienceMismatch com base no perfil do trabalhador', async () => {
    const { worker, job } = await setup();
    await db.update(jobs).set({ requiresExperience: true }).where(eq(jobs.id, job.id));
    const category = await db.query.skillCategories.findFirst({ where: eq(skillCategories.name, TEST_CATEGORY_NAME) });
    await db.insert(workerSkills).values({ workerId: worker.id, categoryId: category!.id, hasExperience: false });

    const result = await getJobDetailForWorker(worker.id, job.id);

    expect(result.matchesSkills).toBe(true);
    expect(result.experienceMismatch).toBe(true);
  });

  it('marca minorMismatch quando o trabalhador é menor e a vaga não aceita menor', async () => {
    const { worker, job } = await setup();
    const seventeenYearsAgo = new Date();
    seventeenYearsAgo.setFullYear(seventeenYearsAgo.getFullYear() - 17);
    await db
      .update(workerProfiles)
      .set({ birthDate: seventeenYearsAgo.toISOString().slice(0, 10) })
      .where(eq(workerProfiles.userId, worker.id));

    const result = await getJobDetailForWorker(worker.id, job.id);

    expect(result.minorMismatch).toBe(true);
  });

  it('não marca minorMismatch quando a vaga aceita menor', async () => {
    const { worker, job } = await setup();
    const seventeenYearsAgo = new Date();
    seventeenYearsAgo.setFullYear(seventeenYearsAgo.getFullYear() - 17);
    await db
      .update(workerProfiles)
      .set({ birthDate: seventeenYearsAgo.toISOString().slice(0, 10) })
      .where(eq(workerProfiles.userId, worker.id));
    await db.update(jobs).set({ minorsAllowed: true }).where(eq(jobs.id, job.id));

    const result = await getJobDetailForWorker(worker.id, job.id);

    expect(result.minorMismatch).toBe(false);
  });

  it('não marca minorMismatch pra trabalhador maior de idade, mesmo sem minorsAllowed', async () => {
    const { worker, job } = await setup();
    await db.update(workerProfiles).set({ birthDate: '2000-01-01' }).where(eq(workerProfiles.userId, worker.id));

    const result = await getJobDetailForWorker(worker.id, job.id);

    expect(result.minorMismatch).toBe(false);
  });
});
