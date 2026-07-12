import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { updateApplicationStatus } from '../applications/update-application-status';
import { db } from '../../db/client';
import { applications, companies, jobs, payments, shifts, skillCategories, users, workerProfiles } from '../../db/schema';
import { createApplication } from '../applications/create-application';
import { chargeForShift } from '../payments/charge-for-shift';
import { PaymentGateway } from '../payments/payment-gateway';
import { checkIn } from '../shifts/check-in';
import { checkOut } from '../shifts/check-out';
import { listFailedPayments } from './list-failed-payments';

const WORKER_PHONE = '+5511966660095';
const OWNER_PHONE = '+5511966660096';
const TEST_CNPJ = '11222333000288';
const TEST_CATEGORY_NAME = 'Categoria de teste — list-failed-payments';

const TOMORROW = new Date(Date.now() + 24 * 60 * 60 * 1000);
const TOMORROW_PLUS_5H = new Date(TOMORROW.getTime() + 5 * 60 * 60 * 1000);

const FAILING_GATEWAY: PaymentGateway = {
  charge: async () => {
    throw new Error('PSP indisponível');
  },
  release: async () => {},
};

async function setupFailedPayment() {
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
      payAmount: '150.00',
      startsAt: TOMORROW,
      endsAt: TOMORROW_PLUS_5H,
    })
    .returning();
  const application = await createApplication(worker.id, job.id);
  await updateApplicationStatus(owner.id, application.id, 'approved');
  const shift = await db.query.shifts.findFirst({ where: eq(shifts.applicationId, application.id) });
  if (!shift) {
    throw new Error('Turno não foi criado no setup do teste.');
  }
  await checkIn(worker.id, shift.id, { lat: -23.55, lng: -46.63 });
  const completed = await checkOut(worker.id, shift.id, { lat: -23.55, lng: -46.63 });
  await chargeForShift(FAILING_GATEWAY, completed.id, completed.payAmountSnapshot);
  return { company, shift: completed };
}

describe('listFailedPayments', () => {
  afterEach(async () => {
    const owner = await db.query.users.findFirst({ where: eq(users.phone, OWNER_PHONE) });
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
    await db.delete(users).where(eq(users.phone, WORKER_PHONE));
    await db.delete(users).where(eq(users.phone, OWNER_PHONE));
    await db.delete(skillCategories).where(eq(skillCategories.name, TEST_CATEGORY_NAME));
  });

  it('retorna vazio quando não há pagamento falho', async () => {
    const result = await listFailedPayments();
    expect(result).toEqual([]);
  });

  it('lista o pagamento falho com empresa e trabalhador', async () => {
    const { shift } = await setupFailedPayment();

    const result = await listFailedPayments();

    const entry = result.find((payment) => payment.shiftId === shift.id);
    expect(entry).toBeDefined();
    expect(entry?.companyName).toBe('Buffet Aurora');
    expect(entry?.workerFullName).toBe('Ana Souza');
    expect(entry?.amount).toBe('150.00');
  });

  it('não inclui pagamento que não está "failed"', async () => {
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
        payAmount: '150.00',
        startsAt: TOMORROW,
        endsAt: TOMORROW_PLUS_5H,
      })
      .returning();
    const application = await createApplication(worker.id, job.id);
    await updateApplicationStatus(owner.id, application.id, 'approved');
    const shift = await db.query.shifts.findFirst({ where: eq(shifts.applicationId, application.id) });
    await checkIn(worker.id, shift!.id, { lat: -23.55, lng: -46.63 });
    const completed = await checkOut(worker.id, shift!.id, { lat: -23.55, lng: -46.63 });
    await chargeForShift(
      { charge: async () => ({ pspChargeId: 'psp_ok' }), release: async () => {} },
      completed.id,
      completed.payAmountSnapshot,
    );

    const result = await listFailedPayments();

    expect(result.find((payment) => payment.shiftId === completed.id)).toBeUndefined();
  });
});
