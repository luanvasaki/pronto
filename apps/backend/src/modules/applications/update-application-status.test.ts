import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../../db/client';
import { applications, companies, jobs, shifts, skillCategories, users, workerProfiles } from '../../db/schema';
import { createApplication } from './create-application';
import { updateApplicationStatus } from './update-application-status';

// Fixtures únicas entre arquivos de teste (ver README).
const WORKER_PHONE = '+5511966660017';
const OWNER_PHONE = '+5511966660019';
const OTHER_OWNER_PHONE = '+5511966660020';
const TEST_CNPJ = '11222333000211';
const TEST_CATEGORY_NAME = 'Categoria de teste — update-application-status';

const TOMORROW = new Date(Date.now() + 24 * 60 * 60 * 1000);
const TOMORROW_PLUS_5H = new Date(TOMORROW.getTime() + 5 * 60 * 60 * 1000);

async function setup(positionsTotal = 2) {
  const [worker] = await db.insert(users).values({ phone: WORKER_PHONE }).returning();
  await db.insert(workerProfiles).values({ userId: worker.id, fullName: 'Ana Souza' });
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
      positionsTotal,
      payAmount: '100.00',
      startsAt: TOMORROW,
      endsAt: TOMORROW_PLUS_5H,
    })
    .returning();
  const application = await createApplication(worker.id, job.id);
  return { worker, owner, job, application };
}

describe('updateApplicationStatus', () => {
  afterEach(async () => {
    const owner = await db.query.users.findFirst({ where: eq(users.phone, OWNER_PHONE) });
    if (owner) {
      const [company] = await db.query.companies.findMany({ where: eq(companies.ownerUserId, owner.id) });
      if (company) {
        const companyJobs = await db.query.jobs.findMany({ where: eq(jobs.companyId, company.id) });
        for (const job of companyJobs) {
          await db.delete(shifts).where(eq(shifts.jobId, job.id));
          await db.delete(applications).where(eq(applications.jobId, job.id));
        }
        await db.delete(jobs).where(eq(jobs.companyId, company.id));
      }
    }
    await db.delete(users).where(eq(users.phone, WORKER_PHONE));
    await db.delete(users).where(eq(users.phone, OWNER_PHONE));
    await db.delete(users).where(eq(users.phone, OTHER_OWNER_PHONE));
    await db.delete(skillCategories).where(eq(skillCategories.name, TEST_CATEGORY_NAME));
  });

  it('rejeita status inválido', async () => {
    const { owner, application } = await setup();

    await expect(updateApplicationStatus(owner.id, application.id, 'maybe')).rejects.toThrow(
      'Status inválido',
    );
  });

  it('rejeita quem não é dono da empresa', async () => {
    const { application } = await setup();
    const [otherOwner] = await db.insert(users).values({ phone: OTHER_OWNER_PHONE }).returning();

    await expect(updateApplicationStatus(otherOwner.id, application.id, 'approved')).rejects.toThrow(
      'não tem acesso',
    );
  });

  it('rejeita candidatura que já foi respondida', async () => {
    const { owner, application } = await setup();
    await updateApplicationStatus(owner.id, application.id, 'rejected');

    await expect(updateApplicationStatus(owner.id, application.id, 'approved')).rejects.toThrow(
      'já foi respondida',
    );
  });

  it('aprova e incrementa positionsFilled sem preencher a vaga', async () => {
    const { owner, job, application } = await setup(2);

    const result = await updateApplicationStatus(owner.id, application.id, 'approved');

    expect(result.status).toBe('approved');
    const updatedJob = await db.query.jobs.findFirst({ where: eq(jobs.id, job.id) });
    expect(updatedJob?.positionsFilled).toBe(1);
    expect(updatedJob?.status).toBe('open');
  });

  it('marca a vaga como "filled" quando a última posição é preenchida', async () => {
    const { owner, job, application } = await setup(1);

    await updateApplicationStatus(owner.id, application.id, 'approved');

    const updatedJob = await db.query.jobs.findFirst({ where: eq(jobs.id, job.id) });
    expect(updatedJob?.positionsFilled).toBe(1);
    expect(updatedJob?.status).toBe('filled');
  });

  it('rejeitar não altera positionsFilled', async () => {
    const { owner, job, application } = await setup();

    await updateApplicationStatus(owner.id, application.id, 'rejected');

    const updatedJob = await db.query.jobs.findFirst({ where: eq(jobs.id, job.id) });
    expect(updatedJob?.positionsFilled).toBe(0);
  });

  it('cria o turno com o valor da vaga congelado ao aprovar', async () => {
    const { owner, job, worker, application } = await setup();

    await updateApplicationStatus(owner.id, application.id, 'approved');

    const shift = await db.query.shifts.findFirst({ where: eq(shifts.applicationId, application.id) });
    expect(shift?.status).toBe('scheduled');
    expect(shift?.workerId).toBe(worker.id);
    expect(shift?.payAmountSnapshot).toBe(job.payAmount);
  });

  it('não cria turno ao rejeitar', async () => {
    const { owner, application } = await setup();

    await updateApplicationStatus(owner.id, application.id, 'rejected');

    const shift = await db.query.shifts.findFirst({ where: eq(shifts.applicationId, application.id) });
    expect(shift).toBeUndefined();
  });

  it('rejeita candidatura duplicada mesmo em corrida (duas chamadas simultâneas)', async () => {
    const { owner, application } = await setup();

    const results = await Promise.allSettled([
      updateApplicationStatus(owner.id, application.id, 'approved'),
      updateApplicationStatus(owner.id, application.id, 'rejected'),
    ]);

    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter((result) => result.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason.message).toContain('já foi respondida');
  });
});
