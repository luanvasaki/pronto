import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { applications } from './applications';
import { db } from '../client';
import { companies } from './companies';
import { jobs } from './jobs';
import { payments } from './payments';
import { shifts } from './shifts';
import { skillCategories } from './skill-categories';
import { users } from './users';
import { workerProfiles } from './worker-profiles';

// Fixtures únicas entre arquivos de teste (ver README).
const COMPANY_OWNER_PHONE = '+5511922220000';
const WORKER_PHONE = '+5511922220001';
const TEST_CNPJ = '22233344000155';
const TEST_CATEGORY_NAME = 'Categoria de teste — payments';
const TEST_ADDRESS_LABEL = 'Vila Olímpia, São Paulo';

async function createTestShift() {
  const [owner] = await db.insert(users).values({ phone: COMPANY_OWNER_PHONE }).returning();
  const [company] = await db
    .insert(companies)
    .values({
      ownerUserId: owner.id,
      legalName: 'Hotel Vila Olímpia Ltda',
      tradeName: 'Hotel Vila Olímpia',
      cnpj: TEST_CNPJ,
    })
    .returning();
  const [category] = await db
    .insert(skillCategories)
    .values({ name: TEST_CATEGORY_NAME })
    .returning();
  const [job] = await db
    .insert(jobs)
    .values({
      companyId: company.id,
      categoryId: category.id,
      description: 'Recepcionista para conferência.',
      addressLabel: TEST_ADDRESS_LABEL,
      locationLat: -23.595,
      locationLng: -46.687,
      positionsTotal: 1,
      payAmount: '140.00',
      startsAt: new Date('2026-08-09T08:00:00-03:00'),
      endsAt: new Date('2026-08-09T17:00:00-03:00'),
    })
    .returning();
  const [workerUser] = await db.insert(users).values({ phone: WORKER_PHONE }).returning();
  const [workerProfile] = await db
    .insert(workerProfiles)
    .values({ userId: workerUser.id, fullName: 'Rafael Lima' })
    .returning();
  const [application] = await db
    .insert(applications)
    .values({ jobId: job.id, workerId: workerProfile.userId, status: 'approved' })
    .returning();
  const [shift] = await db
    .insert(shifts)
    .values({
      applicationId: application.id,
      jobId: job.id,
      workerId: workerProfile.userId,
      payAmountSnapshot: job.payAmount,
    })
    .returning();

  return shift;
}

describe('tabela payments', () => {
  afterEach(async () => {
    const testJobs = await db.query.jobs.findMany({
      where: eq(jobs.addressLabel, TEST_ADDRESS_LABEL),
    });
    for (const job of testJobs) {
      const jobShifts = await db.query.shifts.findMany({ where: eq(shifts.jobId, job.id) });
      for (const shift of jobShifts) {
        await db.delete(payments).where(eq(payments.shiftId, shift.id));
      }
      await db.delete(shifts).where(eq(shifts.jobId, job.id));
      await db.delete(applications).where(eq(applications.jobId, job.id));
    }
    await db.delete(jobs).where(eq(jobs.addressLabel, TEST_ADDRESS_LABEL));
    await db.delete(skillCategories).where(eq(skillCategories.name, TEST_CATEGORY_NAME));
    await db.delete(users).where(eq(users.phone, COMPANY_OWNER_PHONE));
    await db.delete(users).where(eq(users.phone, WORKER_PHONE));
  });

  it('cria um pagamento com status "pending" por padrão', async () => {
    const shift = await createTestShift();

    const [payment] = await db
      .insert(payments)
      .values({ shiftId: shift.id, amount: shift.payAmountSnapshot })
      .returning();

    expect(payment.status).toBe('pending');
    expect(payment.pspChargeId).toBeNull();
  });

  it('não permite dois pagamentos pro mesmo shift', async () => {
    const shift = await createTestShift();
    await db.insert(payments).values({ shiftId: shift.id, amount: shift.payAmountSnapshot });

    await expect(
      db.insert(payments).values({ shiftId: shift.id, amount: shift.payAmountSnapshot }),
    ).rejects.toThrow();
  });

  it('registra a cobrança com a referência do PSP', async () => {
    const shift = await createTestShift();
    const [payment] = await db
      .insert(payments)
      .values({ shiftId: shift.id, amount: shift.payAmountSnapshot })
      .returning();

    const [updated] = await db
      .update(payments)
      .set({ status: 'charged', pspChargeId: 'ch_test_123', chargedAt: new Date() })
      .where(eq(payments.id, payment.id))
      .returning();

    expect(updated.status).toBe('charged');
    expect(updated.pspChargeId).toBe('ch_test_123');
  });
});
