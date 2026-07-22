import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { updateApplicationStatus } from '../applications/update-application-status';
import { db } from '../../db/client';
import { applications, companies, jobs, shifts, skillCategories, users, workerProfiles } from '../../db/schema';
import { createApplication } from '../applications/create-application';

const CONSENT = { termsAccepted: true, minorsTermsAccepted: undefined, ipAddress: null, userAgent: null } as const;
import { checkIn } from './check-in';
import { checkOut } from './check-out';

const sendPushToUserMock = vi.fn();
vi.mock('../push/send-push-notification', () => ({
  sendPushToUser: (...args: unknown[]) => sendPushToUserMock(...args),
}));

// Fixtures únicas entre arquivos de teste (ver README).
const WORKER_PHONE = '+5511966660024';
const OTHER_WORKER_PHONE = '+5511966660025';
const OWNER_PHONE = '+5511966660026';
const TEST_CNPJ = '11112223340774';
const TEST_CATEGORY_NAME = 'Categoria de teste — check-out';

const TOMORROW = new Date(Date.now() + 24 * 60 * 60 * 1000);
const TOMORROW_PLUS_5H = new Date(TOMORROW.getTime() + 5 * 60 * 60 * 1000);

async function setupCheckedInShift() {
  const [worker] = await db.insert(users).values({ phone: WORKER_PHONE }).returning();
  await db.insert(workerProfiles).values({ kycStatus: 'approved', userId: worker.id, fullName: 'Ana Souza' });
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
  const application = await createApplication(worker.id, job.id, CONSENT);
  await updateApplicationStatus(owner.id, application.id, 'approved');
  const shift = await db.query.shifts.findFirst({ where: eq(shifts.applicationId, application.id) });
  if (!shift) {
    throw new Error('Turno não foi criado no setup do teste.');
  }
  await checkIn(worker.id, shift.id);
  return { worker, job, shift };
}

describe('checkOut', () => {
  afterEach(async () => {
    sendPushToUserMock.mockReset();
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
    await db.delete(skillCategories).where(eq(skillCategories.name, TEST_CATEGORY_NAME));
  });

  it('rejeita turno que ainda não fez check-in', async () => {
    const [worker] = await db.insert(users).values({ phone: WORKER_PHONE }).returning();
    await db.insert(workerProfiles).values({ kycStatus: 'approved', userId: worker.id, fullName: 'Ana Souza' });
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
    const application = await createApplication(worker.id, job.id, CONSENT);
    await updateApplicationStatus(owner.id, application.id, 'approved');
    const shift = await db.query.shifts.findFirst({ where: eq(shifts.applicationId, application.id) });

    await expect(checkOut(worker.id, shift!.id)).rejects.toThrow('não está esperando check-out');
  });

  it('rejeita quem não é o worker do turno', async () => {
    const { shift } = await setupCheckedInShift();
    const [otherWorker] = await db.insert(users).values({ phone: OTHER_WORKER_PHONE }).returning();

    await expect(checkOut(otherWorker.id, shift.id)).rejects.toThrow('não tem acesso');
  });

  it('faz check-out sem exigir geolocalização e muda o status pra "checked_out" (não "completed")', async () => {
    const { worker, shift } = await setupCheckedInShift();

    const result = await checkOut(worker.id, shift.id);

    expect(result.status).toBe('checked_out');
    expect(result.checkOutAt).toBeInstanceOf(Date);
    expect(result.checkOutAt!.getTime()).toBeGreaterThan(Date.now() - 5000);
    expect(result.checkOutConfirmedAt).toBeNull();
  });

  it('notifica o dono da empresa por push quando o check-out é feito', async () => {
    const { worker, job, shift } = await setupCheckedInShift();
    sendPushToUserMock.mockReset();

    await checkOut(worker.id, shift.id);

    const company = await db.query.companies.findFirst({ where: eq(companies.id, job.companyId) });
    expect(sendPushToUserMock).toHaveBeenCalledTimes(1);
    expect(sendPushToUserMock).toHaveBeenCalledWith(company?.ownerUserId, {
      title: 'Ana Souza fez check-out',
      body: TEST_CATEGORY_NAME,
      url: '/escala',
    });
  });

  it('rejeita segundo check-out do mesmo turno', async () => {
    const { worker, shift } = await setupCheckedInShift();
    await checkOut(worker.id, shift.id);

    await expect(checkOut(worker.id, shift.id)).rejects.toThrow('não está esperando check-out');
  });

  it('rejeita check-out duplicado mesmo em corrida (duas chamadas simultâneas)', async () => {
    const { worker, shift } = await setupCheckedInShift();

    const results = await Promise.allSettled([checkOut(worker.id, shift.id), checkOut(worker.id, shift.id)]);

    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter((result) => result.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason.message).toContain('não está esperando check-out');
  });
});
