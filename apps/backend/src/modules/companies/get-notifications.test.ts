import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../../db/client';
import { applications, companies, jobs, shifts, skillCategories, users, workerProfiles } from '../../db/schema';
import { createApplication } from '../applications/create-application';
import { updateApplicationStatus } from '../applications/update-application-status';
import { getCompanyNotifications } from './get-notifications';

// Fixtures únicas entre arquivos de teste (ver README).
const WORKER_PHONE = '+5511966660083';
const OTHER_WORKER_PHONE = '+5511966660084';
const OWNER_PHONE = '+5511966660085';
const TEST_CNPJ = '11222333000240';
const TEST_CATEGORY_NAME = 'Categoria de teste — get-notifications';

const TOMORROW = new Date(Date.now() + 24 * 60 * 60 * 1000);
const TOMORROW_PLUS_5H = new Date(TOMORROW.getTime() + 5 * 60 * 60 * 1000);

async function setup() {
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
  return { owner, job };
}

async function createWorker(phone: string, fullName: string) {
  const [worker] = await db.insert(users).values({ phone }).returning();
  await db.insert(workerProfiles).values({ userId: worker.id, fullName });
  return worker;
}

describe('getCompanyNotifications', () => {
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

  it('rejeita quando o perfil da empresa ainda não existe', async () => {
    const [owner] = await db.insert(users).values({ phone: OWNER_PHONE }).returning();

    await expect(getCompanyNotifications(owner.id)).rejects.toThrow('Complete o cadastro');
  });

  it('conta zero quando não há candidaturas', async () => {
    const { owner } = await setup();

    const result = await getCompanyNotifications(owner.id);

    expect(result.pendingApplicationsCount).toBe(0);
  });

  it('conta candidaturas pendentes de todas as vagas da empresa', async () => {
    const { owner, job } = await setup();
    const worker = await createWorker(WORKER_PHONE, 'Ana Souza');
    const otherWorker = await createWorker(OTHER_WORKER_PHONE, 'Beatriz Lima');
    await createApplication(worker.id, job.id);
    await createApplication(otherWorker.id, job.id);

    const result = await getCompanyNotifications(owner.id);

    expect(result.pendingApplicationsCount).toBe(2);
  });

  it('não conta candidaturas já aprovadas ou rejeitadas', async () => {
    const { owner, job } = await setup();
    const worker = await createWorker(WORKER_PHONE, 'Ana Souza');
    const otherWorker = await createWorker(OTHER_WORKER_PHONE, 'Beatriz Lima');
    const application = await createApplication(worker.id, job.id);
    await createApplication(otherWorker.id, job.id);
    await updateApplicationStatus(owner.id, application.id, 'approved');

    const result = await getCompanyNotifications(owner.id);

    expect(result.pendingApplicationsCount).toBe(1);
  });
});
