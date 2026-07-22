import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { updateApplicationStatus } from '../applications/update-application-status';
import { db } from '../../db/client';
import { applications, companies, jobs, payments, ratings, shifts, skillCategories, users, workerProfiles } from '../../db/schema';
import { createApplication } from '../applications/create-application';

const CONSENT = { termsAccepted: true, minorsTermsAccepted: undefined, ipAddress: null, userAgent: null } as const;
import { checkIn } from '../shifts/check-in';
import { checkOut } from '../shifts/check-out';
import { confirmCheckOut } from '../shifts/confirm-check-out';
import { PaymentGateway } from '../payments/payment-gateway';
import { skipRating } from './skip-rating';

const SUCCESS_GATEWAY: PaymentGateway = {
  charge: async () => ({ pspChargeId: 'psp_skip-rating' }),
  release: async () => {},
};

const WORKER_PHONE = '+5511966660060';
const OUTSIDER_PHONE = '+5511966660061';
const OWNER_PHONE = '+5511966660062';
const TEST_CNPJ = '11112223340693';
const TEST_CATEGORY_NAME = 'Categoria de teste — skip-rating';

const TOMORROW = new Date(Date.now() + 24 * 60 * 60 * 1000);
const TOMORROW_PLUS_5H = new Date(TOMORROW.getTime() + 5 * 60 * 60 * 1000);

async function setupCompletedShift() {
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
  return { worker, owner, shift };
}

describe('skipRating', () => {
  afterEach(async () => {
    const owner = await db.query.users.findFirst({ where: eq(users.phone, OWNER_PHONE) });
    if (owner) {
      const [company] = await db.query.companies.findMany({ where: eq(companies.ownerUserId, owner.id) });
      if (company) {
        const companyJobs = await db.query.jobs.findMany({ where: eq(jobs.companyId, company.id) });
        for (const job of companyJobs) {
          const jobShifts = await db.query.shifts.findMany({ where: eq(shifts.jobId, job.id) });
          for (const shift of jobShifts) {
            await db.delete(ratings).where(eq(ratings.shiftId, shift.id));
            await db.delete(payments).where(eq(payments.shiftId, shift.id));
          }
          await db.delete(shifts).where(eq(shifts.jobId, job.id));
          await db.delete(applications).where(eq(applications.jobId, job.id));
        }
        await db.delete(jobs).where(eq(jobs.companyId, company.id));
      }
    }
    await db.delete(users).where(eq(users.phone, WORKER_PHONE));
    await db.delete(users).where(eq(users.phone, OUTSIDER_PHONE));
    await db.delete(users).where(eq(users.phone, OWNER_PHONE));
    await db.delete(skillCategories).where(eq(skillCategories.name, TEST_CATEGORY_NAME));
  });

  it('rejeita turno inexistente', async () => {
    const { owner } = await setupCompletedShift();
    await expect(skipRating(owner.id, '00000000-0000-0000-0000-000000000000')).rejects.toThrow(
      'Turno não encontrado',
    );
  });

  it('rejeita quem não é nem o trabalhador nem o dono da empresa', async () => {
    const { shift } = await setupCompletedShift();
    const [outsider] = await db.insert(users).values({ phone: OUTSIDER_PHONE }).returning();

    await expect(skipRating(outsider.id, shift.id)).rejects.toThrow('Você não tem acesso');
  });

  it('rejeita turno que ainda não foi concluído (sem check-in/check-out)', async () => {
    const { owner, shift } = await setupCompletedShift();

    await expect(skipRating(owner.id, shift.id)).rejects.toThrow('turnos concluídos');
  });

  it('marca companyRatingSkippedAt quando quem chama é o dono da empresa', async () => {
    const { worker, owner, shift } = await setupCompletedShift();
    await checkIn(worker.id, shift.id);
    await checkOut(worker.id, shift.id);
    await confirmCheckOut(SUCCESS_GATEWAY, owner.id, shift.id);

    const before = new Date();
    const result = await skipRating(owner.id, shift.id);

    expect(result.shiftId).toBe(shift.id);
    expect(result.skippedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());

    const updated = await db.query.shifts.findFirst({ where: eq(shifts.id, shift.id) });
    expect(updated?.companyRatingSkippedAt).not.toBeNull();
    expect(updated?.workerRatingSkippedAt).toBeNull();
  });

  it('marca workerRatingSkippedAt quando quem chama é o trabalhador do turno', async () => {
    const { worker, owner, shift } = await setupCompletedShift();
    await checkIn(worker.id, shift.id);
    await checkOut(worker.id, shift.id);
    await confirmCheckOut(SUCCESS_GATEWAY, owner.id, shift.id);

    const before = new Date();
    const result = await skipRating(worker.id, shift.id);

    expect(result.shiftId).toBe(shift.id);
    expect(result.skippedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());

    const updated = await db.query.shifts.findFirst({ where: eq(shifts.id, shift.id) });
    expect(updated?.workerRatingSkippedAt).not.toBeNull();
    expect(updated?.companyRatingSkippedAt).toBeNull();
  });
});
