import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../../db/client';
import { applications, companies, jobs, shifts, skillCategories, users, workerProfiles } from '../../db/schema';
import { createApplication } from './create-application';
import { updateApplicationStatus } from './update-application-status';
import { withdrawApplication } from './withdraw-application';

// Fixtures únicas entre arquivos de teste (ver README).
const WORKER_PHONE = '+5511966660096';
const OTHER_WORKER_PHONE = '+5511966660097';
const OWNER_PHONE = '+5511966660098';
const TEST_CNPJ = '11222333000260';

const TOMORROW = new Date(Date.now() + 24 * 60 * 60 * 1000);
const TOMORROW_PLUS_5H = new Date(TOMORROW.getTime() + 5 * 60 * 60 * 1000);

async function setup(positionsTotal = 2) {
  const [worker] = await db.insert(users).values({ phone: WORKER_PHONE }).returning();
  await db.insert(workerProfiles).values({ kycStatus: 'approved', userId: worker.id, fullName: 'Ana Souza' });
  const [owner] = await db.insert(users).values({ phone: OWNER_PHONE }).returning();
  const [company] = await db
    .insert(companies)
    .values({ ownerUserId: owner.id, legalName: 'Buffet Aurora Ltda', tradeName: 'Buffet Aurora', cnpj: TEST_CNPJ })
    .returning();
  const [category] = await db
    .insert(skillCategories)
    .values({ name: 'Categoria de teste — withdraw-application' })
    .returning();
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
  const application = await createApplication(worker.id, job.id, true);
  return { worker, owner, job, application };
}

describe('withdrawApplication', () => {
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
    await db.delete(users).where(eq(users.phone, OTHER_WORKER_PHONE));
    await db.delete(users).where(eq(users.phone, OWNER_PHONE));
    await db.delete(skillCategories).where(eq(skillCategories.name, 'Categoria de teste — withdraw-application'));
  });

  it('rejeita candidatura inexistente', async () => {
    const { worker } = await setup();

    await expect(
      withdrawApplication(worker.id, '00000000-0000-0000-0000-000000000000'),
    ).rejects.toThrow('Candidatura não encontrada');
  });

  it('rejeita quem não é o dono da candidatura', async () => {
    const { application } = await setup();
    const [otherWorker] = await db.insert(users).values({ phone: OTHER_WORKER_PHONE }).returning();

    await expect(withdrawApplication(otherWorker.id, application.id)).rejects.toThrow('não tem acesso');
  });

  it('cancela uma candidatura pendente', async () => {
    const { worker, application } = await setup();

    const result = await withdrawApplication(worker.id, application.id);

    expect(result.status).toBe('withdrawn');
  });

  it('rejeita cancelar uma candidatura já aprovada', async () => {
    const { worker, owner, application } = await setup();
    await updateApplicationStatus(owner.id, application.id, 'approved');

    await expect(withdrawApplication(worker.id, application.id)).rejects.toThrow(
      'Só é possível cancelar uma candidatura pendente',
    );
  });

  it('rejeita cancelar a mesma candidatura duas vezes', async () => {
    const { worker, application } = await setup();
    await withdrawApplication(worker.id, application.id);

    await expect(withdrawApplication(worker.id, application.id)).rejects.toThrow(
      'Só é possível cancelar uma candidatura pendente',
    );
  });
});
