import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { updateApplicationStatus } from '../applications/update-application-status';
import { db } from '../../db/client';
import { applications, companies, jobs, ratings, shifts, skillCategories, users, workerProfiles } from '../../db/schema';
import { createApplication } from '../applications/create-application';
import { createRating } from '../ratings/create-rating';
import { COMPANY_RATING_CATEGORIES, WORKER_RATING_CATEGORIES } from '../ratings/rating-categories';
import { checkIn } from './check-in';
import { checkOut } from './check-out';
import { listMyShifts } from './list-my-shifts';

// Fixtures únicas entre arquivos de teste (ver README).
const WORKER_PHONE = '+5511966662210';
const OWNER_PHONE = '+5511966662211';
const TEST_CNPJ = '11222333000705';
const TEST_CATEGORY_NAME = 'Categoria de teste — list-my-shifts';

const TOMORROW = new Date(Date.now() + 24 * 60 * 60 * 1000);
const TOMORROW_PLUS_5H = new Date(TOMORROW.getTime() + 5 * 60 * 60 * 1000);

describe('listMyShifts', () => {
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

  it('retorna lista vazia quando não há turnos', async () => {
    const [worker] = await db.insert(users).values({ phone: WORKER_PHONE }).returning();

    const result = await listMyShifts(worker.id);

    expect(result).toEqual([]);
  });

  it('lista os turnos do worker com os dados da vaga', async () => {
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
    const application = await createApplication(worker.id, job.id);
    await updateApplicationStatus(owner.id, application.id, 'approved');

    const result = await listMyShifts(worker.id);

    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('scheduled');
    expect(result[0].payAmountSnapshot).toBe('100.00');
    expect(result[0].job.id).toBe(job.id);
    expect(result[0].companyName).toBe('Buffet Aurora');
  });

  it('avaliação às cegas: não mostra a nota que a empresa deu até o trabalhador também avaliar', async () => {
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
    const application = await createApplication(worker.id, job.id);
    await updateApplicationStatus(owner.id, application.id, 'approved');
    const shift = await db.query.shifts.findFirst({ where: eq(shifts.applicationId, application.id) });
    if (!shift) throw new Error('Turno não foi criado no setup do teste.');
    await checkIn(worker.id, shift.id, { lat: -23.55, lng: -46.63 });
    await checkOut(worker.id, shift.id, { lat: -23.55, lng: -46.63 });

    const scores = Object.fromEntries(WORKER_RATING_CATEGORIES.map((category) => [category.id, 5]));
    await createRating(owner.id, shift.id, { categoryScores: scores, comment: 'Ótimo profissional.' });

    const beforeOwnRating = await listMyShifts(worker.id);
    expect(beforeOwnRating[0].ratings.company).toBeNull();

    await createRating(worker.id, shift.id, {
      categoryScores: Object.fromEntries(COMPANY_RATING_CATEGORIES.map((category) => [category.id, 4])),
      comment: undefined,
    });

    const afterOwnRating = await listMyShifts(worker.id);
    expect(afterOwnRating[0].ratings.company?.score).toBe(5);
    expect(afterOwnRating[0].ratings.worker?.score).toBe(4);
  });
});
