import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { updateApplicationStatus } from '../applications/update-application-status';
import { db } from '../../db/client';
import { applications, companies, jobs, shifts, skillCategories, users, workerProfiles } from '../../db/schema';
import { createApplication } from '../applications/create-application';
import { checkIn } from './check-in';
import { checkOut } from './check-out';

// Fixtures únicas entre arquivos de teste (ver README).
const WORKER_PHONE = '+5511966660024';
const OTHER_WORKER_PHONE = '+5511966660025';
const OWNER_PHONE = '+5511966660026';
const TEST_CNPJ = '11222333000233';
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
  const application = await createApplication(worker.id, job.id, true);
  await updateApplicationStatus(owner.id, application.id, 'approved');
  const shift = await db.query.shifts.findFirst({ where: eq(shifts.applicationId, application.id) });
  if (!shift) {
    throw new Error('Turno não foi criado no setup do teste.');
  }
  await checkIn(worker.id, shift.id, { lat: -23.55, lng: -46.63 });
  return { worker, job, shift };
}

describe('checkOut', () => {
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
    const application = await createApplication(worker.id, job.id, true);
    await updateApplicationStatus(owner.id, application.id, 'approved');
    const shift = await db.query.shifts.findFirst({ where: eq(shifts.applicationId, application.id) });

    await expect(checkOut(worker.id, shift!.id, { lat: -23.55, lng: -46.63 })).rejects.toThrow(
      'não está esperando check-out',
    );
  });

  it('rejeita quem não é o worker do turno', async () => {
    const { shift } = await setupCheckedInShift();
    const [otherWorker] = await db.insert(users).values({ phone: OTHER_WORKER_PHONE }).returning();

    await expect(checkOut(otherWorker.id, shift.id, { lat: -23.55, lng: -46.63 })).rejects.toThrow(
      'não tem acesso',
    );
  });

  it('faz check-out e muda o status pra "completed"', async () => {
    const { worker, shift } = await setupCheckedInShift();

    const result = await checkOut(worker.id, shift.id, { lat: -23.5501, lng: -46.6301 });

    expect(result.status).toBe('completed');
    expect(result.checkOutLat).toBe(-23.5501);
    expect(result.checkOutAt).not.toBeNull();
  });

  it('rejeita check-out longe do local da vaga', async () => {
    const { worker, shift } = await setupCheckedInShift();

    await expect(checkOut(worker.id, shift.id, { lat: -23.56, lng: -46.64 })).rejects.toThrow(
      'Você precisa estar no local do turno',
    );

    const unchanged = await db.query.shifts.findFirst({ where: eq(shifts.id, shift.id) });
    expect(unchanged?.status).toBe('checked_in');
  });

  it('rejeita segundo check-out do mesmo turno', async () => {
    const { worker, shift } = await setupCheckedInShift();
    await checkOut(worker.id, shift.id, { lat: -23.55, lng: -46.63 });

    await expect(checkOut(worker.id, shift.id, { lat: -23.55, lng: -46.63 })).rejects.toThrow(
      'não está esperando check-out',
    );
  });

  it('rejeita check-out duplicado mesmo em corrida (duas chamadas simultâneas)', async () => {
    const { worker, shift } = await setupCheckedInShift();

    const results = await Promise.allSettled([
      checkOut(worker.id, shift.id, { lat: -23.55, lng: -46.63 }),
      checkOut(worker.id, shift.id, { lat: -23.55, lng: -46.63 }),
    ]);

    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter((result) => result.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason.message).toContain('não está esperando check-out');
  });
});
