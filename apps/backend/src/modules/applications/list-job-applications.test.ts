import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../../db/client';
import { applications, companies, jobs, payments, ratings, shifts, skillCategories, users, workerProfiles, workerSkills } from '../../db/schema';
import { createRating } from '../ratings/create-rating';
import { COMPANY_RATING_CATEGORIES, WORKER_RATING_CATEGORIES } from '../ratings/rating-categories';
import { checkIn } from '../shifts/check-in';
import { checkOut } from '../shifts/check-out';
import { confirmCheckOut } from '../shifts/confirm-check-out';
import { PaymentGateway } from '../payments/payment-gateway';
import { createApplication } from './create-application';

const CONSENT = { termsAccepted: true, minorsTermsAccepted: undefined, ipAddress: null, userAgent: null } as const;

const SUCCESS_GATEWAY: PaymentGateway = {
  charge: async () => ({ pspChargeId: 'psp_list-job-applications' }),
  release: async () => {},
};
import { listJobApplications } from './list-job-applications';
import { updateApplicationStatus } from './update-application-status';

// Fixtures únicas entre arquivos de teste (ver README).
const WORKER_PHONE = '+5511966660014';
const OWNER_PHONE = '+5511966660015';
const OTHER_OWNER_PHONE = '+5511966660016';
const SECOND_WORKER_PHONE = '+5511966660017';
const TEST_CNPJ = '11112223341070';
const TEST_CATEGORY_NAME = 'Categoria de teste — list-job-applications';

const TOMORROW = new Date(Date.now() + 24 * 60 * 60 * 1000);
const TOMORROW_PLUS_5H = new Date(TOMORROW.getTime() + 5 * 60 * 60 * 1000);

async function setup(requiresExperience = false) {
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
      requiresExperience,
      addressLabel: 'Endereço de teste',
      locationLat: -23.55,
      locationLng: -46.63,
      positionsTotal: 2,
      payAmount: '100.00',
      startsAt: TOMORROW,
      endsAt: TOMORROW_PLUS_5H,
    })
    .returning();
  return { worker, owner, job };
}

describe('listJobApplications', () => {
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
    await db.delete(users).where(eq(users.phone, OTHER_OWNER_PHONE));
    await db.delete(users).where(eq(users.phone, SECOND_WORKER_PHONE));
    await db.delete(skillCategories).where(eq(skillCategories.name, TEST_CATEGORY_NAME));
  });

  it('rejeita vaga inexistente', async () => {
    const { owner } = await setup();

    await expect(
      listJobApplications(owner.id, '00000000-0000-0000-0000-000000000000'),
    ).rejects.toThrow('Vaga não encontrada');
  });

  it('rejeita quem não é dono da empresa da vaga', async () => {
    const { job } = await setup();
    const [otherOwner] = await db.insert(users).values({ phone: OTHER_OWNER_PHONE }).returning();

    await expect(listJobApplications(otherOwner.id, job.id)).rejects.toThrow('não tem acesso');
  });

  it('lista os candidatos com nome do worker, sinalizando que ele não tem a especialidade da vaga', async () => {
    const { worker, owner, job } = await setup();
    await createApplication(worker.id, job.id, CONSENT);

    const result = await listJobApplications(owner.id, job.id);

    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('pending');
    expect(result[0].worker.fullName).toBe('Ana Souza');
    expect(result[0].worker.matchesSkills).toBe(false);
    expect(result[0].shift).toBeNull();
  });

  it('sinaliza quando o worker tem a especialidade da vaga', async () => {
    const { worker, owner, job } = await setup();
    await db.insert(workerSkills).values({ workerId: worker.id, categoryId: job.categoryId });
    await createApplication(worker.id, job.id, CONSENT);

    const result = await listJobApplications(owner.id, job.id);

    expect(result[0].worker.matchesSkills).toBe(true);
  });

  it('sinaliza experienceMismatch quando a vaga exige experiência e o worker não declarou ter', async () => {
    const { worker, owner, job } = await setup(true);
    await db.insert(workerSkills).values({ workerId: worker.id, categoryId: job.categoryId, hasExperience: false });
    await createApplication(worker.id, job.id, CONSENT);

    const result = await listJobApplications(owner.id, job.id);

    expect(result[0].experienceMismatch).toBe(true);
  });

  it('não sinaliza experienceMismatch quando o worker declarou experiência', async () => {
    const { worker, owner, job } = await setup(true);
    await db.insert(workerSkills).values({ workerId: worker.id, categoryId: job.categoryId, hasExperience: true });
    await createApplication(worker.id, job.id, CONSENT);

    const result = await listJobApplications(owner.id, job.id);

    expect(result[0].experienceMismatch).toBe(false);
  });

  it('não sinaliza experienceMismatch quando a vaga não exige experiência', async () => {
    const { worker, owner, job } = await setup(false);
    await createApplication(worker.id, job.id, CONSENT);

    const result = await listJobApplications(owner.id, job.id);

    expect(result[0].experienceMismatch).toBe(false);
  });

  it('conta turnos concluídos anteriores com a mesma empresa como previousShiftsWithCompany', async () => {
    const { worker, owner, job } = await setup();
    const [category] = await db.query.skillCategories.findMany({ where: eq(skillCategories.name, TEST_CATEGORY_NAME) });
    const [previousJob] = await db
      .insert(jobs)
      .values({
        companyId: job.companyId,
        categoryId: category.id,
        description: 'Vaga anterior, já concluída, com descrição detalhada.',
        addressLabel: 'Endereço de teste',
        locationLat: -23.55,
        locationLng: -46.63,
        positionsTotal: 1,
        payAmount: '100.00',
        startsAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
        endsAt: new Date(Date.now() - 40 * 60 * 60 * 1000),
      })
      .returning();
    // Insert direto (não createApplication) — a vaga anterior é criada
    // com startsAt no passado só pra simular histórico, e isso já
    // fecharia candidaturas de verdade (ver applications-close.ts).
    const [previousApplication] = await db
      .insert(applications)
      .values({ jobId: previousJob.id, workerId: worker.id })
      .returning();
    await updateApplicationStatus(owner.id, previousApplication.id, 'approved');
    const previousShift = await db.query.shifts.findFirst({
      where: eq(shifts.applicationId, previousApplication.id),
    });
    await db.update(shifts).set({ status: 'completed' }).where(eq(shifts.id, previousShift!.id));

    await createApplication(worker.id, job.id, CONSENT);
    const result = await listJobApplications(owner.id, job.id);

    expect(result[0].worker.previousShiftsWithCompany).toBe(1);
  });

  it('não conta turno anterior que não foi concluído (ex: apenas agendado)', async () => {
    const { worker, owner, job } = await setup();
    const [category] = await db.query.skillCategories.findMany({ where: eq(skillCategories.name, TEST_CATEGORY_NAME) });
    const [previousJob] = await db
      .insert(jobs)
      .values({
        companyId: job.companyId,
        categoryId: category.id,
        description: 'Vaga anterior, ainda agendada, com descrição detalhada.',
        addressLabel: 'Endereço de teste',
        locationLat: -23.55,
        locationLng: -46.63,
        positionsTotal: 1,
        payAmount: '100.00',
        startsAt: TOMORROW,
        endsAt: TOMORROW_PLUS_5H,
      })
      .returning();
    const previousApplication = await createApplication(worker.id, previousJob.id, CONSENT);
    await updateApplicationStatus(owner.id, previousApplication.id, 'approved');

    await createApplication(worker.id, job.id, CONSENT);
    const result = await listJobApplications(owner.id, job.id);

    expect(result[0].worker.previousShiftsWithCompany).toBe(0);
  });

  it('inclui o turno quando a candidatura já foi aprovada', async () => {
    const { worker, owner, job } = await setup();
    const application = await createApplication(worker.id, job.id, CONSENT);
    await updateApplicationStatus(owner.id, application.id, 'approved');

    const result = await listJobApplications(owner.id, job.id);

    expect(result[0].status).toBe('approved');
    expect(result[0].shift?.status).toBe('scheduled');
    expect(result[0].shift?.checkInAt).toBeNull();
  });

  it('ordena candidatos por nota média (melhor avaliado primeiro)', async () => {
    const { worker, owner, job } = await setup();
    await db.update(workerProfiles).set({ avgRating: '3.0' }).where(eq(workerProfiles.userId, worker.id));
    await createApplication(worker.id, job.id, CONSENT);

    const [secondWorker] = await db.insert(users).values({ phone: SECOND_WORKER_PHONE }).returning();
    await db.insert(workerProfiles).values({ kycStatus: 'approved', userId: secondWorker.id, fullName: 'Beatriz Lima', avgRating: '4.8' });
    await createApplication(secondWorker.id, job.id, CONSENT);

    const result = await listJobApplications(owner.id, job.id);

    expect(result).toHaveLength(2);
    expect(result[0].worker.fullName).toBe('Beatriz Lima');
    expect(result[1].worker.fullName).toBe('Ana Souza');
  });

  it('avaliação às cegas: não mostra a nota que o trabalhador deu até a empresa também avaliar', async () => {
    const { worker, owner, job } = await setup();
    const application = await createApplication(worker.id, job.id, CONSENT);
    await updateApplicationStatus(owner.id, application.id, 'approved');
    const shift = await db.query.shifts.findFirst({ where: eq(shifts.applicationId, application.id) });
    if (!shift) throw new Error('Turno não foi criado no setup do teste.');
    await checkIn(worker.id, shift.id);
    await checkOut(worker.id, shift.id);
    await confirmCheckOut(SUCCESS_GATEWAY, owner.id, shift.id);

    await createRating(worker.id, shift.id, {
      categoryScores: Object.fromEntries(COMPANY_RATING_CATEGORIES.map((category) => [category.id, 4])),
      comment: 'Combinou tudo certinho.',
    });

    const beforeOwnRating = await listJobApplications(owner.id, job.id);
    expect(beforeOwnRating[0].shift?.ratings.worker).toBeNull();

    await createRating(owner.id, shift.id, {
      categoryScores: Object.fromEntries(WORKER_RATING_CATEGORIES.map((category) => [category.id, 5])),
      comment: undefined,
    });

    const afterOwnRating = await listJobApplications(owner.id, job.id);
    expect(afterOwnRating[0].shift?.ratings.worker?.score).toBe(4);
    expect(afterOwnRating[0].shift?.ratings.company?.score).toBe(5);
  });
});
