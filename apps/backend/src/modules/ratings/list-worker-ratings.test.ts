import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../../db/client';
import { applications, companies, jobs, ratings, shifts, skillCategories, users, workerProfiles } from '../../db/schema';
import { createApplication } from '../applications/create-application';
import { updateApplicationStatus } from '../applications/update-application-status';
import { checkIn } from '../shifts/check-in';
import { checkOut } from '../shifts/check-out';
import { createRating } from './create-rating';
import { listWorkerRatings } from './list-worker-ratings';
import { COMPANY_RATING_CATEGORIES, WORKER_RATING_CATEGORIES } from './rating-categories';

const WORKER_PHONE = '+5511966661090';
const OWNER_PHONE = '+5511966661091';
const TEST_CNPJ = '11222333000700';
const TEST_CATEGORY_NAME = 'Categoria de teste — list-worker-ratings';

const TOMORROW = new Date(Date.now() + 24 * 60 * 60 * 1000);
const TOMORROW_PLUS_5H = new Date(TOMORROW.getTime() + 5 * 60 * 60 * 1000);

function workerCategoryScores(score: number): Record<string, number> {
  return Object.fromEntries(WORKER_RATING_CATEGORIES.map((category) => [category.id, score]));
}

async function setupCompletedShift() {
  const [worker] = await db.insert(users).values({ phone: WORKER_PHONE }).returning();
  await db.insert(workerProfiles).values({ kycStatus: 'approved', userId: worker.id, fullName: 'Camila Rocha' });
  const [owner] = await db.insert(users).values({ phone: OWNER_PHONE }).returning();
  const [company] = await db
    .insert(companies)
    .values({ ownerUserId: owner.id, legalName: 'Espaço Vergueiro Ltda', tradeName: 'Espaço Vergueiro', cnpj: TEST_CNPJ })
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
  const application = await createApplication(worker.id, job.id);
  await updateApplicationStatus(owner.id, application.id, 'approved');
  const shift = await db.query.shifts.findFirst({ where: eq(shifts.applicationId, application.id) });
  if (!shift) throw new Error('Turno não foi criado no setup do teste.');
  await checkIn(worker.id, shift.id, { lat: -23.55, lng: -46.63 });
  await checkOut(worker.id, shift.id, { lat: -23.55, lng: -46.63 });
  return { worker, owner, company, shift };
}

describe('listWorkerRatings', () => {
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

  it('não lista avaliação ainda não revelada', async () => {
    const { worker, owner, shift } = await setupCompletedShift();
    await createRating(owner.id, shift.id, { categoryScores: workerCategoryScores(5), comment: undefined });

    const result = await listWorkerRatings(worker.id);

    expect(result).toEqual([]);
  });

  it('lista avaliação revelada com nome da empresa, categoria e comentário', async () => {
    const { worker, owner, company, shift } = await setupCompletedShift();
    await createRating(owner.id, shift.id, {
      categoryScores: workerCategoryScores(5),
      comment: 'Chegou no horário e foi muito educado.',
    });
    // Revela avaliando de volta.
    await createRating(worker.id, shift.id, {
      categoryScores: Object.fromEntries(COMPANY_RATING_CATEGORIES.map((category) => [category.id, 4])),
      comment: undefined,
    });

    const result = await listWorkerRatings(worker.id);

    expect(result).toHaveLength(1);
    expect(result[0].companyName).toBe(company.tradeName);
    expect(result[0].score).toBe(5);
    expect(result[0].comment).toBe('Chegou no horário e foi muito educado.');
    expect(result[0].categoryScores?.[WORKER_RATING_CATEGORIES[0].id]).toBe(5);
  });
});
