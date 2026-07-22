import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { updateApplicationStatus } from '../applications/update-application-status';
import { db } from '../../db/client';
import { applications, companies, jobs, payments, shifts, skillCategories, users, workerProfiles } from '../../db/schema';
import { createApplication } from '../applications/create-application';

const CONSENT = { termsAccepted: true, minorsTermsAccepted: undefined, ipAddress: null, userAgent: null } as const;
import { checkIn } from '../shifts/check-in';
import { checkOut } from '../shifts/check-out';
import { chargeForShift } from './charge-for-shift';
import { confirmPayment } from './confirm-payment';
import { PaymentGateway } from './payment-gateway';
import { releasePayment } from './release-payment';

// Fixtures únicas entre arquivos de teste (ver README).
const WORKER_PHONE = '+5511966660040';
const OTHER_WORKER_PHONE = '+5511966660041';
const OWNER_PHONE = '+5511966660042';
const TEST_CNPJ = '11222333000273';
const TEST_CATEGORY_NAME = 'Categoria de teste — confirm payment';

const TOMORROW = new Date(Date.now() + 24 * 60 * 60 * 1000);
const TOMORROW_PLUS_5H = new Date(TOMORROW.getTime() + 5 * 60 * 60 * 1000);

const SUCCESS_GATEWAY: PaymentGateway = {
  charge: async () => ({ pspChargeId: 'psp_789' }),
  release: async () => {},
};

async function setupReleasedShift() {
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
  await checkIn(worker.id, shift.id);
  const completed = await checkOut(worker.id, shift.id);
  await chargeForShift(SUCCESS_GATEWAY, completed.id, completed.payAmountSnapshot);
  await releasePayment(SUCCESS_GATEWAY, owner.id, completed.id);
  return { worker, shift: completed };
}

describe('confirmPayment', () => {
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
    await db.delete(users).where(eq(users.phone, OTHER_WORKER_PHONE));
    await db.delete(users).where(eq(users.phone, OWNER_PHONE));
    await db.delete(skillCategories).where(eq(skillCategories.name, TEST_CATEGORY_NAME));
  });

  it('rejeita quem não é o trabalhador do turno', async () => {
    const { shift } = await setupReleasedShift();
    const [otherWorker] = await db.insert(users).values({ phone: OTHER_WORKER_PHONE }).returning();

    await expect(confirmPayment(otherWorker.id, shift.id, CONSENT)).rejects.toThrow('não tem acesso');
  });

  it('rejeita confirmar antes da empresa marcar como pago', async () => {
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
    if (!shift) throw new Error('Turno não foi criado no setup do teste.');
    await checkIn(worker.id, shift.id);
    const completed = await checkOut(worker.id, shift.id);
    await chargeForShift(SUCCESS_GATEWAY, completed.id, completed.payAmountSnapshot);

    await expect(confirmPayment(worker.id, completed.id, CONSENT)).rejects.toThrow(
      'ainda não foi marcado como pago',
    );
  });

  it('confirma o recebimento', async () => {
    const { worker, shift } = await setupReleasedShift();

    const result = await confirmPayment(worker.id, shift.id, CONSENT);

    expect(result.status).toBe('confirmed');
    expect(result.confirmedAt).toBeInstanceOf(Date);
    expect(result.confirmedAt!.getTime()).toBeGreaterThan(Date.now() - 5000);
    expect(result.disputedAt).toBeNull();
    expect(result.amount).toBe('150.00');
  });

  it('rejeita confirmar duas vezes mesmo em corrida (duas chamadas simultâneas)', async () => {
    const { worker, shift } = await setupReleasedShift();

    const results = await Promise.allSettled([
      confirmPayment(worker.id, shift.id, CONSENT),
      confirmPayment(worker.id, shift.id, CONSENT),
    ]);

    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter((result) => result.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    // A leitura antes do UPDATE condicional não é travada por linha —
    // dependendo do timing exato, a chamada perdedora vê o status ainda
    // "released" (cai no UPDATE condicional, "não está pronto pra
    // confirmação") ou já vê "confirmed"/"disputed" (cai na checagem
    // anterior, "ainda não foi marcado como pago"). As duas são a mesma
    // proteção contra corrida funcionando, só timings diferentes.
    expect((rejected[0] as PromiseRejectedResult).reason.message).toMatch(
      /não está pronto pra confirmação|ainda não foi marcado como pago/,
    );
  });

  it('contesta quando não recebeu', async () => {
    const { worker, shift } = await setupReleasedShift();

    const result = await confirmPayment(worker.id, shift.id, false);

    expect(result.status).toBe('disputed');
    expect(result.disputedAt).toBeInstanceOf(Date);
    expect(result.disputedAt!.getTime()).toBeGreaterThan(Date.now() - 5000);
    expect(result.confirmedAt).toBeNull();
  });

  it('rejeita confirmar duas vezes', async () => {
    const { worker, shift } = await setupReleasedShift();
    await confirmPayment(worker.id, shift.id, CONSENT);

    // Depois da 1ª confirmação, o status já não é mais 'released' —
    // a 2ª chamada cai na mesma guarda de "ainda não foi marcado como
    // pago", não porque a empresa não liberou, mas porque já saiu do
    // estado que aceita confirmação.
    await expect(confirmPayment(worker.id, shift.id, CONSENT)).rejects.toThrow(
      'ainda não foi marcado como pago',
    );
  });
});
