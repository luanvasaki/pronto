import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../../db/client';
import { applications, companies, jobs, payments, ratings, shifts, skillCategories, users, workerProfiles } from '../../db/schema';
import { createApplication } from '../applications/create-application';

const CONSENT = { termsAccepted: true, minorsTermsAccepted: undefined, ipAddress: null, userAgent: null } as const;
import { updateApplicationStatus } from '../applications/update-application-status';
import { checkIn } from '../shifts/check-in';
import { checkOut } from '../shifts/check-out';
import { confirmCheckOut } from '../shifts/confirm-check-out';
import { PaymentGateway } from '../payments/payment-gateway';
import { createRating } from './create-rating';
import { listCompanyRatings } from './list-company-ratings';
import { COMPANY_RATING_CATEGORIES, WORKER_RATING_CATEGORIES } from './rating-categories';

const SUCCESS_GATEWAY: PaymentGateway = {
  charge: async () => ({ pspChargeId: 'psp_list-company-ratings' }),
  release: async () => {},
};

const WORKER_PHONE = '+5511966661092';
const OWNER_PHONE = '+5511966661093';
const TEST_CNPJ = '11222333000701';
const TEST_CATEGORY_NAME = 'Categoria de teste — list-company-ratings';

const TOMORROW = new Date(Date.now() + 24 * 60 * 60 * 1000);
const TOMORROW_PLUS_5H = new Date(TOMORROW.getTime() + 5 * 60 * 60 * 1000);

function companyCategoryScores(score: number): Record<string, number> {
  return Object.fromEntries(COMPANY_RATING_CATEGORIES.map((category) => [category.id, score]));
}

async function setupCompletedShift() {
  const [worker] = await db.insert(users).values({ phone: WORKER_PHONE }).returning();
  await db.insert(workerProfiles).values({ kycStatus: 'approved', userId: worker.id, fullName: 'Diego Farias' });
  const [owner] = await db.insert(users).values({ phone: OWNER_PHONE }).returning();
  const [company] = await db
    .insert(companies)
    .values({ ownerUserId: owner.id, legalName: 'Casa Ipiranga Ltda', tradeName: 'Casa Ipiranga', cnpj: TEST_CNPJ })
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
      positionsTotal: 1,
      payAmount: '150.00',
      startsAt: TOMORROW,
      endsAt: TOMORROW_PLUS_5H,
    })
    .returning();
  const application = await createApplication(worker.id, job.id, CONSENT);
  await updateApplicationStatus(owner.id, application.id, 'approved');
  const shift = await db.query.shifts.findFirst({ where: eq(shifts.applicationId, application.id) });
  if (!shift) throw new Error('Turno não foi criado no setup do teste.');
  await checkIn(worker.id, shift.id);
  await checkOut(worker.id, shift.id);
  await confirmCheckOut(SUCCESS_GATEWAY, owner.id, shift.id);
  return { worker, owner, company, shift };
}

describe('listCompanyRatings', () => {
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
    await db.delete(users).where(eq(users.phone, OWNER_PHONE));
    await db.delete(skillCategories).where(eq(skillCategories.name, TEST_CATEGORY_NAME));
  });

  it('rejeita quem não tem empresa cadastrada', async () => {
    const [randomUser] = await db.insert(users).values({ phone: '+5511966661099' }).returning();

    await expect(listCompanyRatings(randomUser.id)).rejects.toThrow('cadastro da empresa');

    await db.delete(users).where(eq(users.id, randomUser.id));
  });

  it('não lista avaliação ainda não revelada', async () => {
    const { owner, worker, shift } = await setupCompletedShift();
    await createRating(worker.id, shift.id, { categoryScores: companyCategoryScores(4), comment: undefined });

    const result = await listCompanyRatings(owner.id);

    expect(result).toEqual([]);
  });

  it('lista avaliação revelada com nome do trabalhador, categoria e comentário', async () => {
    const { owner, worker, shift } = await setupCompletedShift();
    await createRating(worker.id, shift.id, {
      categoryScores: companyCategoryScores(4),
      comment: 'Endereço foi passado com clareza.',
    });
    await createRating(owner.id, shift.id, {
      categoryScores: Object.fromEntries(WORKER_RATING_CATEGORIES.map((category) => [category.id, 5])),
      comment: undefined,
    });

    const result = await listCompanyRatings(owner.id);

    expect(result).toHaveLength(1);
    expect(result[0].workerName).toBe('Diego Farias');
    expect(result[0].score).toBe(4);
    expect(result[0].comment).toBe('Endereço foi passado com clareza.');
    expect(result[0].categoryScores?.[COMPANY_RATING_CATEGORIES[0].id]).toBe(4);
  });
});
