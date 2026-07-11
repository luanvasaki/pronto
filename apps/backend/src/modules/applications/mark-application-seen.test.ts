import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../../db/client';
import { applications, companies, jobs, shifts, skillCategories, users, workerProfiles } from '../../db/schema';
import { createApplication } from './create-application';
import { markApplicationSeen } from './mark-application-seen';

// Fixtures únicas entre arquivos de teste (ver README).
const WORKER_PHONE = '+5511966660080';
const OTHER_WORKER_PHONE = '+5511966660081';
const OWNER_PHONE = '+5511966660082';
const TEST_CNPJ = '11222333000230';
const TEST_CATEGORY_NAME = 'Categoria de teste — mark-application-seen';

const TOMORROW = new Date(Date.now() + 24 * 60 * 60 * 1000);
const TOMORROW_PLUS_5H = new Date(TOMORROW.getTime() + 5 * 60 * 60 * 1000);

async function setup() {
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
      payAmount: '100.00',
      startsAt: TOMORROW,
      endsAt: TOMORROW_PLUS_5H,
    })
    .returning();
  const application = await createApplication(worker.id, job.id);
  return { worker, owner, job, application };
}

describe('markApplicationSeen', () => {
  afterEach(async () => {
    const owner = await db.query.users.findFirst({ where: eq(users.phone, OWNER_PHONE) });
    if (owner) {
      const [company] = await db.query.companies.findMany({ where: eq(companies.ownerUserId, owner.id) });
      if (company) {
        const companyJobs = await db.query.jobs.findMany({ where: eq(jobs.companyId, company.id) });
        for (const job of companyJobs) {
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

  it('rejeita candidatura inexistente', async () => {
    const { worker } = await setup();

    await expect(
      markApplicationSeen(worker.id, '00000000-0000-0000-0000-000000000000'),
    ).rejects.toThrow('Candidatura não encontrada');
  });

  it('rejeita quem não é o trabalhador dono da candidatura', async () => {
    const { application } = await setup();
    const [otherWorker] = await db.insert(users).values({ phone: OTHER_WORKER_PHONE }).returning();

    await expect(markApplicationSeen(otherWorker.id, application.id)).rejects.toThrow('não tem acesso');
  });

  it('marca a candidatura como vista', async () => {
    const { worker, application } = await setup();

    const result = await markApplicationSeen(worker.id, application.id);

    expect(result.workerSeenAt).not.toBeNull();
    const refreshed = await db.query.applications.findFirst({ where: eq(applications.id, application.id) });
    expect(refreshed?.workerSeenAt).not.toBeNull();
  });

  it('é idempotente — marcar de novo não muda o timestamp já salvo', async () => {
    const { worker, application } = await setup();

    const first = await markApplicationSeen(worker.id, application.id);
    const second = await markApplicationSeen(worker.id, application.id);

    expect(second.workerSeenAt?.getTime()).toBe(first.workerSeenAt?.getTime());
  });
});
