import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { updateApplicationStatus } from '../applications/update-application-status';
import { db } from '../../db/client';
import { applications, companies, jobs, payments, shifts, skillCategories, users, workerProfiles } from '../../db/schema';
import { createApplication } from '../applications/create-application';

const CONSENT = { termsAccepted: true, minorsTermsAccepted: undefined, ipAddress: null, userAgent: null } as const;
import { checkIn } from '../shifts/check-in';
import { checkOut } from '../shifts/check-out';
import { PaymentGateway } from './payment-gateway';
import { chargeForShift } from './charge-for-shift';

// Fixtures únicas entre arquivos de teste (ver README).
const WORKER_PHONE = '+5511966660030';
const OWNER_PHONE = '+5511966660031';
const TEST_CNPJ = '11222333000255';
const TEST_CATEGORY_NAME = 'Categoria de teste — payment';

const TOMORROW = new Date(Date.now() + 24 * 60 * 60 * 1000);
const TOMORROW_PLUS_5H = new Date(TOMORROW.getTime() + 5 * 60 * 60 * 1000);

const SUCCESS_GATEWAY: PaymentGateway = {
  charge: async () => ({ pspChargeId: 'psp_123' }),
  release: async () => {},
};

const FAILING_GATEWAY: PaymentGateway = {
  charge: async () => {
    throw new Error('PSP indisponível');
  },
  release: async () => {},
};

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
      payAmount: '150.00',
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
  await checkIn(worker.id, shift.id, { lat: -23.55, lng: -46.63 });
  return await checkOut(worker.id, shift.id, { lat: -23.55, lng: -46.63 });
}

describe('chargeForShift', () => {
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

  it('cria o pagamento como "charged" quando o gateway confirma', async () => {
    const shift = await setupCompletedShift();

    await chargeForShift(SUCCESS_GATEWAY, shift.id, shift.payAmountSnapshot);

    const payment = await db.query.payments.findFirst({ where: eq(payments.shiftId, shift.id) });
    expect(payment?.status).toBe('charged');
    expect(payment?.pspChargeId).toBe('psp_123');
    expect(payment?.chargedAt).not.toBeNull();
    expect(payment?.amount).toBe(shift.payAmountSnapshot);
    expect(payment?.amount).toBe('150.00');
  });

  it('marca o pagamento como "failed" quando o gateway falha', async () => {
    const shift = await setupCompletedShift();

    await chargeForShift(FAILING_GATEWAY, shift.id, shift.payAmountSnapshot);

    const payment = await db.query.payments.findFirst({ where: eq(payments.shiftId, shift.id) });
    expect(payment?.status).toBe('failed');
  });

  it('loga o motivo da falha do gateway, pra não ficar muda no servidor', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const shift = await setupCompletedShift();

    await chargeForShift(FAILING_GATEWAY, shift.id, shift.payAmountSnapshot);

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining(shift.id),
      expect.any(Error),
    );
    consoleErrorSpy.mockRestore();
  });
});
