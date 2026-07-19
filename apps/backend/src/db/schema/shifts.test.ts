import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { applications } from './applications';
import { db } from '../client';
import { companies } from './companies';
import { jobs } from './jobs';
import { shifts } from './shifts';
import { skillCategories } from './skill-categories';
import { users } from './users';
import { workerProfiles } from './worker-profiles';

// Fixtures únicas entre arquivos de teste (ver README).
const COMPANY_OWNER_PHONE = '+5511944440000';
const WORKER_PHONE = '+5511944440001';
const TEST_CNPJ = '44455566000177';
const TEST_CATEGORY_NAME = 'Categoria de teste — shifts';
const TEST_ADDRESS_LABEL = 'Pinheiros, São Paulo';

async function createApprovedApplication() {
  const [owner] = await db.insert(users).values({ phone: COMPANY_OWNER_PHONE }).returning();
  const [company] = await db
    .insert(companies)
    .values({
      ownerUserId: owner.id,
      legalName: 'Casa de Eventos Pinheiros Ltda',
      tradeName: 'Casa de Eventos Pinheiros',
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
      description: 'Segurança para evento corporativo.',
      addressLabel: TEST_ADDRESS_LABEL,
      locationLat: -23.566,
      locationLng: -46.687,
      positionsTotal: 1,
      payAmount: '160.00',
      startsAt: new Date('2026-08-05T19:00:00-03:00'),
      endsAt: new Date('2026-08-06T01:00:00-03:00'),
    })
    .returning();

  const [workerUser] = await db.insert(users).values({ phone: WORKER_PHONE }).returning();
  const [workerProfile] = await db
    .insert(workerProfiles)
    .values({ userId: workerUser.id, fullName: 'João Pereira' })
    .returning();

  const [application] = await db
    .insert(applications)
    .values({ jobId: job.id, workerId: workerProfile.userId, status: 'approved' })
    .returning();

  return { job, application };
}

describe('tabela shifts', () => {
  afterEach(async () => {
    const testJobs = await db.query.jobs.findMany({
      where: eq(jobs.addressLabel, TEST_ADDRESS_LABEL),
    });
    for (const job of testJobs) {
      await db.delete(shifts).where(eq(shifts.jobId, job.id));
      await db.delete(applications).where(eq(applications.jobId, job.id));
    }
    await db.delete(jobs).where(eq(jobs.addressLabel, TEST_ADDRESS_LABEL));
    await db.delete(skillCategories).where(eq(skillCategories.name, TEST_CATEGORY_NAME));
    await db.delete(users).where(eq(users.phone, COMPANY_OWNER_PHONE));
    await db.delete(users).where(eq(users.phone, WORKER_PHONE));
  });

  it('cria um shift com status "scheduled" e o valor da vaga congelado', async () => {
    const { job, application } = await createApprovedApplication();

    const [shift] = await db
      .insert(shifts)
      .values({
        applicationId: application.id,
        jobId: job.id,
        workerId: application.workerId,
        payAmountSnapshot: job.payAmount,
      })
      .returning();

    expect(shift.status).toBe('scheduled');
    expect(shift.payAmountSnapshot).toBe(job.payAmount);
    expect(shift.checkInAt).toBeNull();
  });

  it('não permite dois shifts pra mesma candidatura', async () => {
    const { job, application } = await createApprovedApplication();
    await db.insert(shifts).values({
      applicationId: application.id,
      jobId: job.id,
      workerId: application.workerId,
      payAmountSnapshot: job.payAmount,
    });

    await expect(
      db.insert(shifts).values({
        applicationId: application.id,
        jobId: job.id,
        workerId: application.workerId,
        payAmountSnapshot: job.payAmount,
      }),
    ).rejects.toThrow();
  });

  it('registra check-in e muda o status', async () => {
    const { job, application } = await createApprovedApplication();
    const [shift] = await db
      .insert(shifts)
      .values({
        applicationId: application.id,
        jobId: job.id,
        workerId: application.workerId,
        payAmountSnapshot: job.payAmount,
      })
      .returning();

    const [updated] = await db
      .update(shifts)
      .set({ status: 'checked_in', checkInAt: new Date() })
      .where(eq(shifts.id, shift.id))
      .returning();

    expect(updated.status).toBe('checked_in');
    expect(updated.checkInAt).not.toBeNull();
  });
});
