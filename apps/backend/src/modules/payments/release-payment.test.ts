import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { updateApplicationStatus } from '../applications/update-application-status';
import { db } from '../../db/client';
import { applications, companies, jobs, payments, shifts, skillCategories, users, workerProfiles } from '../../db/schema';
import { createApplication } from '../applications/create-application';
import { checkIn } from '../shifts/check-in';
import { checkOut } from '../shifts/check-out';
import { chargeForShift } from './charge-for-shift';
import { PaymentGateway } from './payment-gateway';
import { releasePayment } from './release-payment';

// Fixtures únicas entre arquivos de teste (ver README).
const WORKER_PHONE = '+5511966660032';
const OWNER_PHONE = '+5511966660033';
const OTHER_OWNER_PHONE = '+5511966660034';
const TEST_CNPJ = '11222333000266';
const TEST_CATEGORY_NAME = 'Categoria de teste — release';

const TOMORROW = new Date(Date.now() + 24 * 60 * 60 * 1000);
const TOMORROW_PLUS_5H = new Date(TOMORROW.getTime() + 5 * 60 * 60 * 1000);

const SUCCESS_GATEWAY: PaymentGateway = {
  charge: async () => ({ pspChargeId: 'psp_456' }),
  release: async () => {},
};

async function setupChargedShift() {
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
  const application = await createApplication(worker.id, job.id, true);
  await updateApplicationStatus(owner.id, application.id, 'approved');
  const shift = await db.query.shifts.findFirst({ where: eq(shifts.applicationId, application.id) });
  if (!shift) {
    throw new Error('Turno não foi criado no setup do teste.');
  }
  await checkIn(worker.id, shift.id, { lat: -23.55, lng: -46.63 });
  const completed = await checkOut(worker.id, shift.id, { lat: -23.55, lng: -46.63 });
  await chargeForShift(SUCCESS_GATEWAY, completed.id, completed.payAmountSnapshot);
  return { owner, shift: completed };
}

describe('releasePayment', () => {
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
    await db.delete(users).where(eq(users.phone, OTHER_OWNER_PHONE));
    await db.delete(skillCategories).where(eq(skillCategories.name, TEST_CATEGORY_NAME));
  });

  it('rejeita quem não é dono da empresa da vaga', async () => {
    const { shift } = await setupChargedShift();
    const [otherOwner] = await db.insert(users).values({ phone: OTHER_OWNER_PHONE }).returning();

    await expect(releasePayment(SUCCESS_GATEWAY, otherOwner.id, shift.id)).rejects.toThrow('não tem acesso');
  });

  it('libera o pagamento cobrado', async () => {
    const { owner, shift } = await setupChargedShift();

    const result = await releasePayment(SUCCESS_GATEWAY, owner.id, shift.id);

    expect(result.status).toBe('released');
    expect(result.releasedAt).not.toBeNull();
  });

  it('rejeita liberar duas vezes', async () => {
    const { owner, shift } = await setupChargedShift();
    await releasePayment(SUCCESS_GATEWAY, owner.id, shift.id);

    await expect(releasePayment(SUCCESS_GATEWAY, owner.id, shift.id)).rejects.toThrow(
      'não está pronto pra ser liberado',
    );
  });

  it('libera no gateway só uma vez mesmo com duas chamadas simultâneas (corrida)', async () => {
    const { owner, shift } = await setupChargedShift();
    let releaseCallCount = 0;
    const countingGateway: PaymentGateway = {
      charge: SUCCESS_GATEWAY.charge,
      release: async (pspChargeId) => {
        releaseCallCount += 1;
        await SUCCESS_GATEWAY.release(pspChargeId);
      },
    };

    const results = await Promise.allSettled([
      releasePayment(countingGateway, owner.id, shift.id),
      releasePayment(countingGateway, owner.id, shift.id),
    ]);

    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter((result) => result.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    // Só quem vence o UPDATE condicional chama o gateway — sem isso, as
    // duas chamadas passariam pela checagem de status antes de qualquer
    // uma escrever, e o gateway seria chamado duas vezes.
    expect(releaseCallCount).toBe(1);
  });
});
