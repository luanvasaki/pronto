import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../../db/client';
import { applications, companies, jobs, payments, shifts, skillCategories, users, workerProfiles } from '../../db/schema';
import { createApplication } from '../applications/create-application';
import { updateApplicationStatus } from '../applications/update-application-status';
import { checkIn } from '../shifts/check-in';
import { checkOut } from '../shifts/check-out';
import { confirmCheckOut } from '../shifts/confirm-check-out';
import { PaymentGateway } from '../payments/payment-gateway';
import { upsertCompanyProfile } from './upsert-company-profile';
import { getCompanyProfile } from './get-company-profile';

const SUCCESS_GATEWAY: PaymentGateway = {
  charge: async () => ({ pspChargeId: 'psp_get-company-profile' }),
  release: async () => {},
};

// Fixtures únicas entre arquivos de teste (ver README).
const TEST_PHONE = '+5511966661095';
const TEST_CNPJ = '11222333007003';
const WORKER_PHONE = '+5511966661096';
const SECOND_WORKER_PHONE = '+5511966661097';
const TEST_CATEGORY_NAME = 'Categoria de teste — get-company-profile';

const TOMORROW = new Date(Date.now() + 24 * 60 * 60 * 1000);
const TOMORROW_PLUS_5H = new Date(TOMORROW.getTime() + 5 * 60 * 60 * 1000);

async function createJobForCompany(companyId: string, categoryId: string) {
  const [job] = await db
    .insert(jobs)
    .values({
      companyId,
      categoryId,
      description: 'Vaga de teste com descrição detalhada o suficiente.',
      addressLabel: 'Endereço de teste',
      locationLat: -23.55,
      locationLng: -46.63,
      positionsTotal: 3,
      payAmount: '100.00',
      startsAt: TOMORROW,
      endsAt: TOMORROW_PLUS_5H,
    })
    .returning();
  return job;
}

async function completeShift(workerId: string, ownerId: string, jobId: string) {
  const application = await createApplication(workerId, jobId, true);
  await updateApplicationStatus(ownerId, application.id, 'approved');
  const shift = await db.query.shifts.findFirst({ where: eq(shifts.applicationId, application.id) });
  if (!shift) throw new Error('Turno não foi criado no setup do teste.');
  await checkIn(workerId, shift.id);
  await checkOut(workerId, shift.id);
  await confirmCheckOut(SUCCESS_GATEWAY, ownerId, shift.id);
  return shift;
}

describe('getCompanyProfile', () => {
  afterEach(async () => {
    const owner = await db.query.users.findFirst({ where: eq(users.phone, TEST_PHONE) });
    if (owner) {
      const [company] = await db.query.companies.findMany({ where: eq(companies.ownerUserId, owner.id) });
      if (company) {
        const companyJobs = await db.query.jobs.findMany({ where: eq(jobs.companyId, company.id) });
        for (const job of companyJobs) {
          const jobShifts = await db.query.shifts.findMany({ where: eq(shifts.jobId, job.id) });
          for (const shift of jobShifts) {
            await db.delete(payments).where(eq(payments.shiftId, shift.id));
          }
          await db.delete(shifts).where(eq(shifts.jobId, job.id));
          await db.delete(applications).where(eq(applications.jobId, job.id));
        }
        await db.delete(jobs).where(eq(jobs.companyId, company.id));
      }
    }
    await db.delete(users).where(eq(users.phone, TEST_PHONE));
    await db.delete(users).where(eq(users.phone, WORKER_PHONE));
    await db.delete(users).where(eq(users.phone, SECOND_WORKER_PHONE));
    await db.delete(skillCategories).where(eq(skillCategories.name, TEST_CATEGORY_NAME));
  });

  it('rejeita quem ainda não cadastrou a empresa', async () => {
    const [user] = await db.insert(users).values({ phone: TEST_PHONE }).returning();

    await expect(getCompanyProfile(user.id)).rejects.toThrow('Complete o cadastro da empresa');
  });

  it('retorna os dados e estatísticas da empresa', async () => {
    const [user] = await db.insert(users).values({ phone: TEST_PHONE }).returning();
    await upsertCompanyProfile(user.id, { legalName: 'Bar do Zé Ltda', tradeName: 'Bar do Zé', cnpj: TEST_CNPJ });

    const result = await getCompanyProfile(user.id);

    expect(result.tradeName).toBe('Bar do Zé');
    expect(result.verificationStatus).toBe('pending');
    expect(result.rejectionReason).toBeNull();
    expect(result.avgRating).toBeNull();
    expect(result.jobsPosted).toBe(0);
    expect(result.shiftsCompleted).toBe(0);
    expect(result.rehireRate).toBeNull();
    expect(result.jobsOpenedThisMonth).toBe(0);
    expect(result.workersHiredThisMonth).toBe(0);
    expect(result.topHiredWorkerName).toBeNull();
    expect(result.topHiredWorkerCount).toBe(0);
  });

  it('reflete o motivo da rejeição quando a empresa foi recusada', async () => {
    const [user] = await db.insert(users).values({ phone: TEST_PHONE }).returning();
    await upsertCompanyProfile(user.id, { legalName: 'Bar do Zé Ltda', tradeName: 'Bar do Zé', cnpj: TEST_CNPJ });
    await db
      .update(companies)
      .set({ verificationStatus: 'rejected', rejectionReason: 'Foto do cartão CNPJ ilegível' })
      .where(eq(companies.ownerUserId, user.id));

    const result = await getCompanyProfile(user.id);

    expect(result.verificationStatus).toBe('rejected');
    expect(result.rejectionReason).toBe('Foto do cartão CNPJ ilegível');
  });

  it('reflete avgRating quando já existe', async () => {
    const [user] = await db.insert(users).values({ phone: TEST_PHONE }).returning();
    await upsertCompanyProfile(user.id, { legalName: 'Bar do Zé Ltda', tradeName: 'Bar do Zé', cnpj: TEST_CNPJ });
    await db.update(companies).set({ avgRating: '4.2' }).where(eq(companies.ownerUserId, user.id));

    const result = await getCompanyProfile(user.id);

    expect(result.avgRating).toBe('4.2');
  });

  it('jobsPosted conta vagas publicadas ao vivo', async () => {
    const [user] = await db.insert(users).values({ phone: TEST_PHONE }).returning();
    const company = await upsertCompanyProfile(user.id, {
      legalName: 'Bar do Zé Ltda',
      tradeName: 'Bar do Zé',
      cnpj: TEST_CNPJ,
    });
    const [category] = await db.insert(skillCategories).values({ name: TEST_CATEGORY_NAME }).returning();
    await createJobForCompany(company.id, category.id);
    await createJobForCompany(company.id, category.id);

    const result = await getCompanyProfile(user.id);

    expect(result.jobsPosted).toBe(2);
  });

  it('shiftsCompleted conta turnos concluídos de todas as vagas da empresa', async () => {
    const [owner] = await db.insert(users).values({ phone: TEST_PHONE }).returning();
    const company = await upsertCompanyProfile(owner.id, {
      legalName: 'Bar do Zé Ltda',
      tradeName: 'Bar do Zé',
      cnpj: TEST_CNPJ,
    });
    const [category] = await db.insert(skillCategories).values({ name: TEST_CATEGORY_NAME }).returning();
    const [worker] = await db.insert(users).values({ phone: WORKER_PHONE }).returning();
    await db.insert(workerProfiles).values({ kycStatus: 'approved', userId: worker.id, fullName: 'Rafael Lima' });

    const job = await createJobForCompany(company.id, category.id);
    await completeShift(worker.id, owner.id, job.id);

    const result = await getCompanyProfile(owner.id);

    expect(result.shiftsCompleted).toBe(1);
  });

  it('taxa de recontratação: 100% recontratando o mesmo trabalhador, 50% com 2 trabalhadores e 1 recontratado', async () => {
    const [owner] = await db.insert(users).values({ phone: TEST_PHONE }).returning();
    const company = await upsertCompanyProfile(owner.id, {
      legalName: 'Bar do Zé Ltda',
      tradeName: 'Bar do Zé',
      cnpj: TEST_CNPJ,
    });
    const [category] = await db.insert(skillCategories).values({ name: TEST_CATEGORY_NAME }).returning();
    const [worker] = await db.insert(users).values({ phone: WORKER_PHONE }).returning();
    await db.insert(workerProfiles).values({ kycStatus: 'approved', userId: worker.id, fullName: 'Rafael Lima' });
    const [secondWorker] = await db.insert(users).values({ phone: SECOND_WORKER_PHONE }).returning();
    await db.insert(workerProfiles).values({ kycStatus: 'approved', userId: secondWorker.id, fullName: 'Beatriz Souza' });

    const firstJob = await createJobForCompany(company.id, category.id);
    await completeShift(worker.id, owner.id, firstJob.id);
    const secondJob = await createJobForCompany(company.id, category.id);
    await completeShift(worker.id, owner.id, secondJob.id);
    const thirdJob = await createJobForCompany(company.id, category.id);
    await completeShift(secondWorker.id, owner.id, thirdJob.id);

    const result = await getCompanyProfile(owner.id);

    expect(result.rehireRate).toBe(50);
  });

  it('jobsOpenedThisMonth conta só as vagas publicadas no mês corrente', async () => {
    const [user] = await db.insert(users).values({ phone: TEST_PHONE }).returning();
    const company = await upsertCompanyProfile(user.id, {
      legalName: 'Bar do Zé Ltda',
      tradeName: 'Bar do Zé',
      cnpj: TEST_CNPJ,
    });
    const [category] = await db.insert(skillCategories).values({ name: TEST_CATEGORY_NAME }).returning();
    await createJobForCompany(company.id, category.id);
    await createJobForCompany(company.id, category.id);

    const result = await getCompanyProfile(user.id);

    expect(result.jobsOpenedThisMonth).toBe(2);
  });

  it('workersHiredThisMonth e topHiredWorker refletem quem foi aprovado nesse mês', async () => {
    const [owner] = await db.insert(users).values({ phone: TEST_PHONE }).returning();
    const company = await upsertCompanyProfile(owner.id, {
      legalName: 'Bar do Zé Ltda',
      tradeName: 'Bar do Zé',
      cnpj: TEST_CNPJ,
    });
    const [category] = await db.insert(skillCategories).values({ name: TEST_CATEGORY_NAME }).returning();
    const [worker] = await db.insert(users).values({ phone: WORKER_PHONE }).returning();
    await db.insert(workerProfiles).values({ kycStatus: 'approved', userId: worker.id, fullName: 'Rafael Lima' });
    const [secondWorker] = await db.insert(users).values({ phone: SECOND_WORKER_PHONE }).returning();
    await db.insert(workerProfiles).values({ kycStatus: 'approved', userId: secondWorker.id, fullName: 'Beatriz Souza' });

    const firstJob = await createJobForCompany(company.id, category.id);
    await completeShift(worker.id, owner.id, firstJob.id);
    const secondJob = await createJobForCompany(company.id, category.id);
    await completeShift(worker.id, owner.id, secondJob.id);
    const thirdJob = await createJobForCompany(company.id, category.id);
    await completeShift(secondWorker.id, owner.id, thirdJob.id);

    const result = await getCompanyProfile(owner.id);

    expect(result.workersHiredThisMonth).toBe(2);
    expect(result.topHiredWorkerName).toBe('Rafael Lima');
    expect(result.topHiredWorkerCount).toBe(2);
  });
});
