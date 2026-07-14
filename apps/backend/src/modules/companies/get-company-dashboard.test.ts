import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../../db/client';
import { applications, companies, jobs, shifts, skillCategories, users, workerProfiles } from '../../db/schema';
import { createApplication } from '../applications/create-application';
import { updateApplicationStatus } from '../applications/update-application-status';
import { getCompanyDashboard } from './get-company-dashboard';

// Fixtures únicas entre arquivos de teste (ver README).
const WORKER_PHONE = '+5511966660093';
const OWNER_PHONE = '+5511966660094';
const TEST_CNPJ = '11222333000241';
const TEST_CATEGORY_NAME = 'Categoria de teste — get-company-dashboard';

const IN_10H = new Date(Date.now() + 10 * 60 * 60 * 1000);
const IN_15H = new Date(Date.now() + 15 * 60 * 60 * 1000);
const IN_10D = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
const IN_10D_PLUS_5H = new Date(IN_10D.getTime() + 5 * 60 * 60 * 1000);

async function setup() {
  const [owner] = await db.insert(users).values({ phone: OWNER_PHONE }).returning();
  const [company] = await db
    .insert(companies)
    .values({ ownerUserId: owner.id, legalName: 'Buffet Aurora Ltda', tradeName: 'Buffet Aurora', cnpj: TEST_CNPJ })
    .returning();
  const [category] = await db.insert(skillCategories).values({ name: TEST_CATEGORY_NAME }).returning();
  return { owner, company, category };
}

async function createJob(
  companyId: string,
  categoryId: string,
  overrides: { startsAt: Date; endsAt: Date; positionsTotal: number },
) {
  const [job] = await db
    .insert(jobs)
    .values({
      companyId,
      categoryId,
      description: 'Vaga de teste com descrição detalhada o suficiente.',
      addressLabel: 'Endereço de teste',
      locationLat: -23.55,
      locationLng: -46.63,
      payAmount: '100.00',
      ...overrides,
    })
    .returning();
  return job;
}

async function createWorker(phone: string, fullName: string) {
  const [worker] = await db.insert(users).values({ phone }).returning();
  await db.insert(workerProfiles).values({ kycStatus: 'approved', userId: worker.id, fullName });
  return worker;
}

describe('getCompanyDashboard', () => {
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
    await db.delete(users).where(eq(users.phone, OWNER_PHONE));
    await db.delete(skillCategories).where(eq(skillCategories.name, TEST_CATEGORY_NAME));
  });

  it('rejeita quando o perfil da empresa ainda não existe', async () => {
    const [owner] = await db.insert(users).values({ phone: OWNER_PHONE }).returning();

    await expect(getCompanyDashboard(owner.id)).rejects.toThrow('Complete o cadastro');
  });

  it('mostra cobertura nula quando não há vaga nas próximas 48h', async () => {
    const { owner } = await setup();

    const result = await getCompanyDashboard(owner.id);

    expect(result.coverage).toEqual({ windowHours: 48, totalPositions: 0, filledPositions: 0, percentage: null });
    expect(result.openPositionJobs).toEqual([]);
  });

  it('calcula cobertura só com vagas que começam dentro da janela de 48h', async () => {
    const { owner, company, category } = await setup();
    const worker = await createWorker(WORKER_PHONE, 'Ana Souza');

    const nearJob = await createJob(company.id, category.id, {
      startsAt: IN_10H,
      endsAt: IN_15H,
      positionsTotal: 2,
    });
    const application = await createApplication(worker.id, nearJob.id, true);
    await updateApplicationStatus(owner.id, application.id, 'approved');

    // Fora da janela de 48h — não deve entrar na conta de cobertura.
    await createJob(company.id, category.id, {
      startsAt: IN_10D,
      endsAt: IN_10D_PLUS_5H,
      positionsTotal: 3,
    });

    const result = await getCompanyDashboard(owner.id);

    expect(result.coverage).toEqual({ windowHours: 48, totalPositions: 2, filledPositions: 1, percentage: 50 });
  });

  it('lista vagas futuras e abertas com posição vaga, ordenadas por data, com a categoria', async () => {
    const { owner, company, category } = await setup();

    const soonJob = await createJob(company.id, category.id, {
      startsAt: IN_10H,
      endsAt: IN_15H,
      positionsTotal: 2,
    });
    const laterJob = await createJob(company.id, category.id, {
      startsAt: IN_10D,
      endsAt: IN_10D_PLUS_5H,
      positionsTotal: 1,
    });

    const result = await getCompanyDashboard(owner.id);

    expect(result.openPositionJobs).toHaveLength(2);
    expect(result.openPositionJobs[0]).toMatchObject({
      jobId: soonJob.id,
      categoryName: TEST_CATEGORY_NAME,
      positionsTotal: 2,
      positionsFilled: 0,
      openPositions: 2,
    });
    expect(result.openPositionJobs[1]).toMatchObject({ jobId: laterJob.id, openPositions: 1 });
  });

  it('não lista vaga totalmente preenchida', async () => {
    const { owner, company, category } = await setup();
    const worker = await createWorker(WORKER_PHONE, 'Ana Souza');

    const job = await createJob(company.id, category.id, {
      startsAt: IN_10H,
      endsAt: IN_15H,
      positionsTotal: 1,
    });
    const application = await createApplication(worker.id, job.id, true);
    await updateApplicationStatus(owner.id, application.id, 'approved');

    const result = await getCompanyDashboard(owner.id);

    expect(result.openPositionJobs).toEqual([]);
  });

  it('inclui as notificações da empresa (candidaturas pendentes) no mesmo retorno', async () => {
    const { owner, company, category } = await setup();
    const worker = await createWorker(WORKER_PHONE, 'Ana Souza');
    const job = await createJob(company.id, category.id, {
      startsAt: IN_10H,
      endsAt: IN_15H,
      positionsTotal: 1,
    });
    await createApplication(worker.id, job.id, true);

    const result = await getCompanyDashboard(owner.id);

    expect(result.notifications.pendingApplicationsCount).toBe(1);
    expect(result.notifications.pendingApplications[0].workerName).toBe('Ana Souza');
  });
});
