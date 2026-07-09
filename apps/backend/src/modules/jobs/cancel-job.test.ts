import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { checkIn } from '../shifts/check-in';
import { updateApplicationStatus } from '../applications/update-application-status';
import { db } from '../../db/client';
import { applications, companies, jobs, shifts, skillCategories, users, workerProfiles } from '../../db/schema';
import { createApplication } from '../applications/create-application';
import { cancelJob } from './cancel-job';
import { createJob } from './create-job';

// Fixtures únicas entre arquivos de teste (ver README).
const OWNER_PHONE = '+5511966660054';
const OTHER_OWNER_PHONE = '+5511966660055';
const WORKER_PHONE = '+5511966660056';
const SECOND_WORKER_PHONE = '+5511966660057';
const TEST_CNPJ = '11222333000322';
const TEST_CATEGORY_NAME = 'Categoria de teste — cancel-job';

const TOMORROW = new Date(Date.now() + 24 * 60 * 60 * 1000);
const TOMORROW_PLUS_5H = new Date(TOMORROW.getTime() + 5 * 60 * 60 * 1000);

function baseInput(categoryId: string, positionsTotal = 2) {
  return {
    categoryId,
    description: 'Uniforme preto próprio, experiência em eventos.',
    requiresExperience: false,
    addressLabel: 'Vila Madalena, São Paulo',
    locationLat: -23.546,
    locationLng: -46.69,
    positionsTotal,
    payAmount: '130.00',
    startsAt: TOMORROW.toISOString(),
    endsAt: TOMORROW_PLUS_5H.toISOString(),
  };
}

async function setup(positionsTotal = 2) {
  const [owner] = await db.insert(users).values({ phone: OWNER_PHONE }).returning();
  await db
    .insert(companies)
    .values({ ownerUserId: owner.id, legalName: 'Buffet Aurora Ltda', tradeName: 'Buffet Aurora', cnpj: TEST_CNPJ });
  const [category] = await db.insert(skillCategories).values({ name: TEST_CATEGORY_NAME }).returning();
  const job = await createJob(owner.id, baseInput(category.id, positionsTotal));
  return { owner, category, job };
}

describe('cancelJob', () => {
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
    await db.delete(users).where(eq(users.phone, OWNER_PHONE));
    await db.delete(users).where(eq(users.phone, OTHER_OWNER_PHONE));
    await db.delete(users).where(eq(users.phone, WORKER_PHONE));
    await db.delete(users).where(eq(users.phone, SECOND_WORKER_PHONE));
    await db.delete(skillCategories).where(eq(skillCategories.name, TEST_CATEGORY_NAME));
  });

  it('rejeita quem não é dono da empresa', async () => {
    const { job } = await setup();
    const [otherOwner] = await db.insert(users).values({ phone: OTHER_OWNER_PHONE }).returning();

    await expect(cancelJob(otherOwner.id, job.id)).rejects.toThrow('não tem acesso');
  });

  it('rejeita vaga já cancelada', async () => {
    const { owner, job } = await setup();
    await cancelJob(owner.id, job.id);

    await expect(cancelJob(owner.id, job.id)).rejects.toThrow('já está cancelada');
  });

  it('rejeita cancelar quando já existe turno em andamento', async () => {
    const { owner, job } = await setup(1);
    const [worker] = await db.insert(users).values({ phone: WORKER_PHONE }).returning();
    await db.insert(workerProfiles).values({ userId: worker.id, fullName: 'Ana Souza' });
    const application = await createApplication(worker.id, job.id);
    await updateApplicationStatus(owner.id, application.id, 'approved');
    const shift = await db.query.shifts.findFirst({ where: eq(shifts.applicationId, application.id) });
    await checkIn(worker.id, shift!.id, { lat: -23.55, lng: -46.63 });

    await expect(cancelJob(owner.id, job.id)).rejects.toThrow('turno em andamento ou concluído');
  });

  it('cancela a vaga, rejeita candidaturas pendentes e cancela turnos agendados', async () => {
    const { owner, job } = await setup(2);
    const [worker] = await db.insert(users).values({ phone: WORKER_PHONE }).returning();
    await db.insert(workerProfiles).values({ userId: worker.id, fullName: 'Ana Souza' });
    const approvedApplication = await createApplication(worker.id, job.id);
    await updateApplicationStatus(owner.id, approvedApplication.id, 'approved');

    const [secondWorker] = await db.insert(users).values({ phone: SECOND_WORKER_PHONE }).returning();
    await db.insert(workerProfiles).values({ userId: secondWorker.id, fullName: 'Beatriz Lima' });
    const pendingApplication = await createApplication(secondWorker.id, job.id);

    const result = await cancelJob(owner.id, job.id);

    expect(result.status).toBe('cancelled');

    const refreshedPending = await db.query.applications.findFirst({
      where: eq(applications.id, pendingApplication.id),
    });
    expect(refreshedPending?.status).toBe('rejected');

    const scheduledShift = await db.query.shifts.findFirst({
      where: eq(shifts.applicationId, approvedApplication.id),
    });
    expect(scheduledShift?.status).toBe('cancelled');
  });
});
