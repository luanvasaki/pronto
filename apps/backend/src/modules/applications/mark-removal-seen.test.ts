import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../../db/client';
import { applications, companies, jobs, shifts, skillCategories, users, workerProfiles } from '../../db/schema';
import { createApplication } from './create-application';
import { markRemovalSeen } from './mark-removal-seen';
import { removeApprovedWorker } from './remove-approved-worker';
import { updateApplicationStatus } from './update-application-status';

// Fixtures únicas entre arquivos de teste (ver README).
const WORKER_PHONE = '+5511966660090';
const OTHER_WORKER_PHONE = '+5511966660091';
const OWNER_PHONE = '+5511966660092';
const TEST_CNPJ = '11222333000251';

const TOMORROW = new Date(Date.now() + 24 * 60 * 60 * 1000);
const TOMORROW_PLUS_5H = new Date(TOMORROW.getTime() + 5 * 60 * 60 * 1000);

async function setup() {
  const [worker] = await db.insert(users).values({ phone: WORKER_PHONE }).returning();
  await db.insert(workerProfiles).values({ kycStatus: 'approved', userId: worker.id, fullName: 'Ana Souza' });
  const [owner] = await db.insert(users).values({ phone: OWNER_PHONE }).returning();
  const [company] = await db
    .insert(companies)
    .values({ ownerUserId: owner.id, legalName: 'Buffet Aurora Ltda', tradeName: 'Buffet Aurora', cnpj: TEST_CNPJ })
    .returning();
  const [category] = await db.insert(skillCategories).values({ name: 'Categoria de teste — mark-removal-seen' }).returning();
  const [job] = await db
    .insert(jobs)
    .values({
      companyId: company.id,
      categoryId: category.id,
      description: 'Vaga de teste com descrição detalhada o suficiente.',
      addressLabel: 'Endereço de teste',
      locationLat: -23.55,
      locationLng: -46.63,
      positionsTotal: 1,
      payAmount: '100.00',
      startsAt: TOMORROW,
      endsAt: TOMORROW_PLUS_5H,
    })
    .returning();
  const application = await createApplication(worker.id, job.id);
  await updateApplicationStatus(owner.id, application.id, 'approved');
  await removeApprovedWorker(owner.id, application.id);
  return { worker, owner, application };
}

describe('markRemovalSeen', () => {
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
    await db.delete(skillCategories).where(eq(skillCategories.name, 'Categoria de teste — mark-removal-seen'));
  });

  it('rejeita candidatura inexistente', async () => {
    const { worker } = await setup();

    await expect(
      markRemovalSeen(worker.id, '00000000-0000-0000-0000-000000000000'),
    ).rejects.toThrow('Candidatura não encontrada');
  });

  it('rejeita quem não é o trabalhador dono da candidatura', async () => {
    const { application } = await setup();
    const [otherWorker] = await db.insert(users).values({ phone: OTHER_WORKER_PHONE }).returning();

    await expect(markRemovalSeen(otherWorker.id, application.id)).rejects.toThrow('não tem acesso');
  });

  it('marca a remoção como vista', async () => {
    const { worker, application } = await setup();

    const result = await markRemovalSeen(worker.id, application.id);

    expect(result.workerSeenRemovalAt).not.toBeNull();
    const refreshed = await db.query.applications.findFirst({ where: eq(applications.id, application.id) });
    expect(refreshed?.workerSeenRemovalAt).not.toBeNull();
  });

  it('é idempotente — marcar de novo não muda o timestamp já salvo', async () => {
    const { worker, application } = await setup();

    const first = await markRemovalSeen(worker.id, application.id);
    const second = await markRemovalSeen(worker.id, application.id);

    expect(second.workerSeenRemovalAt?.getTime()).toBe(first.workerSeenRemovalAt?.getTime());
  });
});
