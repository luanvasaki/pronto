import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { updateApplicationStatus } from '../applications/update-application-status';
import { db } from '../../db/client';
import { applications, companies, jobs, payments, shifts, skillCategories, users, workerProfiles } from '../../db/schema';
import { createApplication } from '../applications/create-application';

const CONSENT = { termsAccepted: true, minorsTermsAccepted: undefined, ipAddress: null, userAgent: null } as const;
import { PaymentGateway } from '../payments/payment-gateway';
import { checkIn } from './check-in';
import { checkOut } from './check-out';
import { confirmCheckOut } from './confirm-check-out';

// Fixtures únicas entre arquivos de teste (ver README).
const WORKER_PHONE = '+5511966660073';
const OUTSIDER_PHONE = '+5511966660074';
const OWNER_PHONE = '+5511966660075';
const TEST_CNPJ = '11112223340711';
const TEST_CATEGORY_NAME = 'Categoria de teste — confirm-check-out';

const TOMORROW = new Date(Date.now() + 24 * 60 * 60 * 1000);
const TOMORROW_PLUS_5H = new Date(TOMORROW.getTime() + 5 * 60 * 60 * 1000);

const SUCCESS_GATEWAY: PaymentGateway = {
  charge: async () => ({ pspChargeId: 'psp_confirm-check-out' }),
  release: async () => {},
};

async function setupScheduledShift() {
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
      payAmount: '175.00',
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

describe('confirmCheckOut', () => {
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
    await db.delete(users).where(eq(users.phone, OUTSIDER_PHONE));
    await db.delete(users).where(eq(users.phone, OWNER_PHONE));
    await db.delete(skillCategories).where(eq(skillCategories.name, TEST_CATEGORY_NAME));
  });

  it('rejeita turno inexistente', async () => {
    const { owner } = await setupScheduledShift();

    await expect(
      confirmCheckOut(SUCCESS_GATEWAY, owner.id, '00000000-0000-0000-0000-000000000000'),
    ).rejects.toThrow('Turno não encontrado');
  });

  it('rejeita quem não é dono da empresa', async () => {
    const { worker, shift } = await setupScheduledShift();
    await checkIn(worker.id, shift.id);
    await checkOut(worker.id, shift.id);
    const [outsider] = await db.insert(users).values({ phone: OUTSIDER_PHONE }).returning();

    await expect(confirmCheckOut(SUCCESS_GATEWAY, outsider.id, shift.id)).rejects.toThrow('Você não tem acesso');
  });

  it('rejeita turno que ainda não fez check-out', async () => {
    const { worker, owner, shift } = await setupScheduledShift();
    await checkIn(worker.id, shift.id);

    await expect(confirmCheckOut(SUCCESS_GATEWAY, owner.id, shift.id)).rejects.toThrow(
      'não está esperando confirmação de check-out',
    );
  });

  it('confirma o check-out, muda o status pra "completed" e cria a cobrança', async () => {
    const { worker, owner, shift } = await setupScheduledShift();
    await checkIn(worker.id, shift.id);
    await checkOut(worker.id, shift.id);

    const result = await confirmCheckOut(SUCCESS_GATEWAY, owner.id, shift.id);

    expect(result.status).toBe('completed');
    expect(result.checkOutConfirmedAt).not.toBeNull();

    const payment = await db.query.payments.findFirst({ where: eq(payments.shiftId, shift.id) });
    expect(payment).toBeDefined();
    expect(payment?.status).toBe('charged');
    expect(payment?.amount).toBe('175.00');
  });

  it('rejeita segunda confirmação do mesmo turno', async () => {
    const { worker, owner, shift } = await setupScheduledShift();
    await checkIn(worker.id, shift.id);
    await checkOut(worker.id, shift.id);
    await confirmCheckOut(SUCCESS_GATEWAY, owner.id, shift.id);

    await expect(confirmCheckOut(SUCCESS_GATEWAY, owner.id, shift.id)).rejects.toThrow(
      'não está esperando confirmação de check-out',
    );
  });

  it('só uma confirmação vence quando duas chamadas chegam juntas', async () => {
    const { worker, owner, shift } = await setupScheduledShift();
    await checkIn(worker.id, shift.id);
    await checkOut(worker.id, shift.id);

    const results = await Promise.allSettled([
      confirmCheckOut(SUCCESS_GATEWAY, owner.id, shift.id),
      confirmCheckOut(SUCCESS_GATEWAY, owner.id, shift.id),
    ]);

    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    expect(fulfilled).toHaveLength(1);
  });
});
