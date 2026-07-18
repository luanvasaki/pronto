import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { updateApplicationStatus } from '../applications/update-application-status';
import { db } from '../../db/client';
import {
  applications,
  companies,
  jobs,
  payments,
  ratings,
  shifts,
  skillCategories,
  users,
  workerProfiles,
} from '../../db/schema';
import { createApplication } from '../applications/create-application';
import { checkIn } from '../shifts/check-in';
import { checkOut } from '../shifts/check-out';
import { confirmCheckOut } from '../shifts/confirm-check-out';
import { PaymentGateway } from '../payments/payment-gateway';
import { createRating } from './create-rating';
import { COMPANY_RATING_CATEGORIES, WORKER_RATING_CATEGORIES } from './rating-categories';

const SUCCESS_GATEWAY: PaymentGateway = {
  charge: async () => ({ pspChargeId: 'psp_create-rating' }),
  release: async () => {},
};

// Fixtures únicas entre arquivos de teste (ver README).
const WORKER_PHONE = '+5511966660027';
const OTHER_WORKER_PHONE = '+5511966660028';
const OWNER_PHONE = '+5511966660029';
const TEST_CNPJ = '11222333000244';
const TEST_CATEGORY_NAME = 'Categoria de teste — rating';

const TOMORROW = new Date(Date.now() + 24 * 60 * 60 * 1000);
const TOMORROW_PLUS_5H = new Date(TOMORROW.getTime() + 5 * 60 * 60 * 1000);

/** Trabalhador avaliando a empresa usa as categorias de empresa, todas com a mesma nota. */
function companyCategoryScores(score: number): Record<string, number> {
  return Object.fromEntries(COMPANY_RATING_CATEGORIES.map((category) => [category.id, score]));
}

/** Empresa avaliando o trabalhador usa as categorias de trabalhador, todas com a mesma nota. */
function workerCategoryScores(score: number): Record<string, number> {
  return Object.fromEntries(WORKER_RATING_CATEGORIES.map((category) => [category.id, score]));
}

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
  const application = await createApplication(worker.id, job.id, true);
  await updateApplicationStatus(owner.id, application.id, 'approved');
  const shift = await db.query.shifts.findFirst({ where: eq(shifts.applicationId, application.id) });
  if (!shift) {
    throw new Error('Turno não foi criado no setup do teste.');
  }
  await checkIn(worker.id, shift.id);
  await checkOut(worker.id, shift.id);
  await confirmCheckOut(SUCCESS_GATEWAY, owner.id, shift.id);
  return { worker, owner, company, job, shift };
}

describe('createRating', () => {
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
    await db.delete(users).where(eq(users.phone, OTHER_WORKER_PHONE));
    await db.delete(users).where(eq(users.phone, OWNER_PHONE));
    await db.delete(skillCategories).where(eq(skillCategories.name, TEST_CATEGORY_NAME));
  });

  it('rejeita categoryScores ausente', async () => {
    const { worker, shift } = await setupCompletedShift();

    await expect(
      createRating(worker.id, shift.id, { categoryScores: undefined, comment: undefined }),
    ).rejects.toThrow('Avalie todas as categorias');
  });

  it('rejeita categoryScores incompleto (faltando categoria)', async () => {
    const { worker, shift } = await setupCompletedShift();
    const incomplete = companyCategoryScores(4);
    delete incomplete[COMPANY_RATING_CATEGORIES[0].id];

    await expect(
      createRating(worker.id, shift.id, { categoryScores: incomplete, comment: undefined }),
    ).rejects.toThrow('Avalie todas as categorias');
  });

  it('rejeita categoria que não pertence ao papel de quem avalia', async () => {
    const { worker, shift } = await setupCompletedShift();
    // Trabalhador avalia empresa — categorias de trabalhador não se aplicam aqui.
    const wrongCategories = workerCategoryScores(4);

    await expect(
      createRating(worker.id, shift.id, { categoryScores: wrongCategories, comment: undefined }),
    ).rejects.toThrow('Avalie todas as categorias');
  });

  it('rejeita nota de categoria fora do intervalo 1-5', async () => {
    const { worker, shift } = await setupCompletedShift();
    const invalid = { ...companyCategoryScores(4), [COMPANY_RATING_CATEGORIES[0].id]: 6 };

    await expect(
      createRating(worker.id, shift.id, { categoryScores: invalid, comment: undefined }),
    ).rejects.toThrow('nota inteira de 1 a 5');
  });

  it('rejeita avaliar turno que ainda não foi concluído', async () => {
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

    await expect(
      createRating(worker.id, shift!.id, { categoryScores: companyCategoryScores(5), comment: undefined }),
    ).rejects.toThrow('turnos concluídos');
  });

  it('rejeita quem não tem relação com o turno', async () => {
    const { shift } = await setupCompletedShift();
    const [otherWorker] = await db.insert(users).values({ phone: OTHER_WORKER_PHONE }).returning();

    await expect(
      createRating(otherWorker.id, shift.id, { categoryScores: companyCategoryScores(5), comment: undefined }),
    ).rejects.toThrow('não tem acesso');
  });

  it('trabalhador avalia a empresa (todas as categorias) — nota fica registrada mesmo antes de revelada', async () => {
    const { worker, shift } = await setupCompletedShift();

    const result = await createRating(worker.id, shift.id, {
      categoryScores: companyCategoryScores(4),
      comment: 'Ambiente organizado.',
    });

    expect(result.raterRole).toBe('worker');
    expect(result.score).toBe(4);
    expect(result.categoryScores).toEqual(companyCategoryScores(4));
  });

  it('avaliação às cegas: a média da empresa só atualiza depois que os dois lados avaliam', async () => {
    const { worker, owner, company, shift } = await setupCompletedShift();

    await createRating(worker.id, shift.id, { categoryScores: companyCategoryScores(4), comment: undefined });
    const afterOnlyWorker = await db.query.companies.findFirst({ where: eq(companies.id, company.id) });
    expect(afterOnlyWorker?.avgRating).toBeNull();

    await createRating(owner.id, shift.id, { categoryScores: workerCategoryScores(5), comment: undefined });
    const afterBoth = await db.query.companies.findFirst({ where: eq(companies.id, company.id) });
    expect(afterBoth?.avgRating).toBe('4.0');
    expect(afterBoth?.avgCategoryScores?.[COMPANY_RATING_CATEGORIES[0].id]).toBe('4.0');
  });

  it('avaliação às cegas: a média do trabalhador só atualiza depois que os dois lados avaliam', async () => {
    const { worker, owner, shift } = await setupCompletedShift();

    await createRating(owner.id, shift.id, { categoryScores: workerCategoryScores(5), comment: undefined });
    const afterOnlyCompany = await db.query.workerProfiles.findFirst({ where: eq(workerProfiles.userId, worker.id) });
    expect(afterOnlyCompany?.avgRating).toBeNull();

    await createRating(worker.id, shift.id, { categoryScores: companyCategoryScores(4), comment: undefined });
    const afterBoth = await db.query.workerProfiles.findFirst({ where: eq(workerProfiles.userId, worker.id) });
    expect(afterBoth?.avgRating).toBe('5.0');
    expect(afterBoth?.avgCategoryScores?.[WORKER_RATING_CATEGORIES[0].id]).toBe('5.0');
  });

  it('a média da empresa é recalculada sobre TODAS as avaliações reveladas, não só a mais recente', async () => {
    const { worker, owner, company, job, shift } = await setupCompletedShift();
    await createRating(worker.id, shift.id, { categoryScores: companyCategoryScores(4), comment: undefined });
    await createRating(owner.id, shift.id, { categoryScores: workerCategoryScores(5), comment: undefined });
    const afterFirstShift = await db.query.companies.findFirst({ where: eq(companies.id, company.id) });
    expect(afterFirstShift?.avgRating).toBe('4.0');

    // Segundo turno concluído, mesma vaga (positionsTotal: 2), segundo
    // trabalhador — avalia a empresa com nota bem diferente da primeira.
    // Se o recálculo estivesse considerando só a avaliação mais recente
    // (ou somando errado), a média não bateria com a conta manual abaixo.
    const [secondWorker] = await db.insert(users).values({ phone: OTHER_WORKER_PHONE }).returning();
    await db.insert(workerProfiles).values({ kycStatus: 'approved', userId: secondWorker.id, fullName: 'Beatriz Lima' });
    const secondApplication = await createApplication(secondWorker.id, job.id, true);
    await updateApplicationStatus(owner.id, secondApplication.id, 'approved');
    const secondShift = await db.query.shifts.findFirst({ where: eq(shifts.applicationId, secondApplication.id) });
    if (!secondShift) throw new Error('Segundo turno não foi criado no setup do teste.');
    await checkIn(secondWorker.id, secondShift.id);
    await checkOut(secondWorker.id, secondShift.id);
    await confirmCheckOut(SUCCESS_GATEWAY, owner.id, secondShift.id);

    await createRating(secondWorker.id, secondShift.id, { categoryScores: companyCategoryScores(2), comment: undefined });
    await createRating(owner.id, secondShift.id, { categoryScores: workerCategoryScores(3), comment: undefined });

    const afterBothShifts = await db.query.companies.findFirst({ where: eq(companies.id, company.id) });
    // (4 + 2) / 2 = 3.0 — prova que a segunda avaliação foi somada à
    // primeira, não a substituiu.
    expect(afterBothShifts?.avgRating).toBe('3.0');
    expect(afterBothShifts?.avgCategoryScores?.[COMPANY_RATING_CATEGORIES[0].id]).toBe('3.0');
  });

  it('nota geral é a média arredondada das categorias', async () => {
    const { owner, shift } = await setupCompletedShift();
    const ids = WORKER_RATING_CATEGORIES.map((category) => category.id);
    // 3+4+4+5+5 = 21 / 5 = 4.2 -> arredonda pra 4
    const mixed = { [ids[0]]: 3, [ids[1]]: 4, [ids[2]]: 4, [ids[3]]: 5, [ids[4]]: 5 };

    const result = await createRating(owner.id, shift.id, { categoryScores: mixed, comment: undefined });

    expect(result.score).toBe(4);
  });

  it('rejeita segunda avaliação do mesmo papel pro mesmo turno', async () => {
    const { worker, shift } = await setupCompletedShift();
    await createRating(worker.id, shift.id, { categoryScores: companyCategoryScores(4), comment: undefined });

    await expect(
      createRating(worker.id, shift.id, { categoryScores: companyCategoryScores(5), comment: undefined }),
    ).rejects.toThrow('já avaliou');
  });
});
