import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { applications } from './applications';
import { db } from '../client';
import { companies } from './companies';
import { jobs } from './jobs';
import { ratings } from './ratings';
import { shifts } from './shifts';
import { skillCategories } from './skill-categories';
import { users } from './users';
import { workerProfiles } from './worker-profiles';

// Fixtures únicas entre arquivos de teste (ver README).
const COMPANY_OWNER_PHONE = '+5511933330000';
const WORKER_PHONE = '+5511933330001';
const TEST_CNPJ = '33344455000166';
const TEST_CATEGORY_NAME = 'Categoria de teste — ratings';
const TEST_ADDRESS_LABEL = 'Moema, São Paulo';

async function createTestShift() {
  const [owner] = await db.insert(users).values({ phone: COMPANY_OWNER_PHONE }).returning();
  const [company] = await db
    .insert(companies)
    .values({
      ownerUserId: owner.id,
      legalName: 'Restaurante Moema Ltda',
      tradeName: 'Restaurante Moema',
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
      description: 'Cozinheiro para jantar de confraternização.',
      addressLabel: TEST_ADDRESS_LABEL,
      locationLat: -23.598,
      locationLng: -46.665,
      positionsTotal: 1,
      payAmount: '150.00',
      startsAt: new Date('2026-08-07T18:00:00-03:00'),
      endsAt: new Date('2026-08-07T23:00:00-03:00'),
    })
    .returning();
  const [workerUser] = await db.insert(users).values({ phone: WORKER_PHONE }).returning();
  const [workerProfile] = await db
    .insert(workerProfiles)
    .values({ userId: workerUser.id, fullName: 'Marina Costa' })
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

describe('tabela ratings', () => {
  afterEach(async () => {
    const testJobs = await db.query.jobs.findMany({
      where: eq(jobs.addressLabel, TEST_ADDRESS_LABEL),
    });
    for (const job of testJobs) {
      const jobShifts = await db.query.shifts.findMany({ where: eq(shifts.jobId, job.id) });
      for (const shift of jobShifts) {
        await db.delete(ratings).where(eq(ratings.shiftId, shift.id));
      }
      await db.delete(shifts).where(eq(shifts.jobId, job.id));
      await db.delete(applications).where(eq(applications.jobId, job.id));
    }
    await db.delete(jobs).where(eq(jobs.addressLabel, TEST_ADDRESS_LABEL));
    await db.delete(skillCategories).where(eq(skillCategories.name, TEST_CATEGORY_NAME));
    await db.delete(users).where(eq(users.phone, COMPANY_OWNER_PHONE));
    await db.delete(users).where(eq(users.phone, WORKER_PHONE));
  });

  it('permite os dois lados avaliarem o mesmo shift', async () => {
    const shift = await createTestShift();

    await db.insert(ratings).values({ shiftId: shift.id, raterRole: 'worker', score: 5 });
    await db.insert(ratings).values({ shiftId: shift.id, raterRole: 'company', score: 4 });

    const result = await db.query.ratings.findMany({ where: eq(ratings.shiftId, shift.id) });
    expect(result).toHaveLength(2);
  });

  it('rejeita nota fora do intervalo de 1 a 5', async () => {
    const shift = await createTestShift();

    await expect(
      db.insert(ratings).values({ shiftId: shift.id, raterRole: 'worker', score: 6 }),
    ).rejects.toThrow();
  });

  it('não permite o mesmo lado avaliar duas vezes o mesmo shift', async () => {
    const shift = await createTestShift();
    await db.insert(ratings).values({ shiftId: shift.id, raterRole: 'worker', score: 5 });

    await expect(
      db.insert(ratings).values({ shiftId: shift.id, raterRole: 'worker', score: 3 }),
    ).rejects.toThrow();
  });
});
