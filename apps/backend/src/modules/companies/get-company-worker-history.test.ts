import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../../db/client';
import { applications, companies, jobs, ratings, shifts, skillCategories, users, workerProfiles } from '../../db/schema';
import { createRating } from '../ratings/create-rating';
import { getCompanyWorkerHistory } from './get-company-worker-history';

// Fixtures únicas entre arquivos de teste (ver README).
const OWNER_PHONE = '+5511966660102';
const WORKER_A_PHONE = '+5511966660103';
const WORKER_B_PHONE = '+5511966660104';
const TEST_CNPJ = '11222333000343';
const TEST_CATEGORY_NAME = 'Categoria de teste — get-company-worker-history';

async function setup() {
  const [owner] = await db.insert(users).values({ phone: OWNER_PHONE }).returning();
  const [company] = await db
    .insert(companies)
    .values({ ownerUserId: owner.id, legalName: 'Buffet Aurora Ltda', tradeName: 'Buffet Aurora', cnpj: TEST_CNPJ })
    .returning();
  const [category] = await db.insert(skillCategories).values({ name: TEST_CATEGORY_NAME }).returning();
  return { owner, company, category };
}

async function createWorker(phone: string, fullName: string) {
  const [worker] = await db.insert(users).values({ phone }).returning();
  await db.insert(workerProfiles).values({ kycStatus: 'approved', userId: worker.id, fullName });
  return worker;
}

async function createJobRow(companyId: string, categoryId: string, startsAt: Date) {
  const [job] = await db
    .insert(jobs)
    .values({
      companyId,
      categoryId,
      description: 'Vaga de teste com descrição detalhada o suficiente.',
      addressLabel: 'Endereço de teste',
      locationLat: -23.55,
      locationLng: -46.63,
      positionsTotal: 1,
      payAmount: '120.00',
      startsAt,
      endsAt: new Date(startsAt.getTime() + 4 * 60 * 60 * 1000),
    })
    .returning();
  return job;
}

async function createShiftRow(
  jobId: string,
  workerId: string,
  overrides: { status: 'scheduled' | 'checked_in' | 'completed' | 'no_show' | 'cancelled'; checkOutAt?: Date },
) {
  const [application] = await db.insert(applications).values({ jobId, workerId, status: 'approved' }).returning();
  const [shift] = await db
    .insert(shifts)
    .values({
      applicationId: application.id,
      jobId,
      workerId,
      payAmountSnapshot: '120.00',
      status: overrides.status,
      checkOutAt: overrides.checkOutAt,
    })
    .returning();
  return shift;
}

describe('getCompanyWorkerHistory', () => {
  afterEach(async () => {
    const owner = await db.query.users.findFirst({ where: eq(users.phone, OWNER_PHONE) });
    if (owner) {
      const [company] = await db.query.companies.findMany({ where: eq(companies.ownerUserId, owner.id) });
      if (company) {
        const companyJobs = await db.query.jobs.findMany({ where: eq(jobs.companyId, company.id) });
        for (const job of companyJobs) {
          const jobShifts = await db.query.shifts.findMany({ where: eq(shifts.jobId, job.id) });
          for (const shift of jobShifts) {
            await db.delete(ratings).where(eq(ratings.shiftId, shift.id));
          }
          await db.delete(shifts).where(eq(shifts.jobId, job.id));
          await db.delete(applications).where(eq(applications.jobId, job.id));
        }
        await db.delete(jobs).where(eq(jobs.companyId, company.id));
      }
    }
    await db.delete(users).where(eq(users.phone, WORKER_A_PHONE));
    await db.delete(users).where(eq(users.phone, WORKER_B_PHONE));
    await db.delete(users).where(eq(users.phone, OWNER_PHONE));
    await db.delete(skillCategories).where(eq(skillCategories.name, TEST_CATEGORY_NAME));
  });

  it('retorna lista vazia quando a empresa não tem turnos', async () => {
    const { owner } = await setup();

    const result = await getCompanyWorkerHistory(owner.id);

    expect(result).toEqual([]);
  });

  it('inclui trabalhador com turno concluído, com 100% de comparecimento e sem nota se não avaliado', async () => {
    const { owner, company, category } = await setup();
    const worker = await createWorker(WORKER_A_PHONE, 'Ana Souza');
    const job = await createJobRow(company.id, category.id, new Date(Date.now() - 24 * 60 * 60 * 1000));
    const checkOutAt = new Date(Date.now() - 20 * 60 * 60 * 1000);
    await createShiftRow(job.id, worker.id, { status: 'completed', checkOutAt });

    const result = await getCompanyWorkerHistory(owner.id);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      workerId: worker.id,
      fullName: 'Ana Souza',
      shiftsCompleted: 1,
      noShowCount: 0,
      attendanceRate: 100,
      avgRatingGiven: null,
    });
    expect(result[0].lastWorkedAt?.getTime()).toBe(checkOutAt.getTime());
  });

  it('conta falta (no_show) na taxa de comparecimento', async () => {
    const { owner, company, category } = await setup();
    const worker = await createWorker(WORKER_A_PHONE, 'Ana Souza');
    const jobDone = await createJobRow(company.id, category.id, new Date(Date.now() - 48 * 60 * 60 * 1000));
    await createShiftRow(jobDone.id, worker.id, { status: 'completed', checkOutAt: new Date() });
    const jobNoShow = await createJobRow(company.id, category.id, new Date(Date.now() - 24 * 60 * 60 * 1000));
    await createShiftRow(jobNoShow.id, worker.id, { status: 'no_show' });

    const result = await getCompanyWorkerHistory(owner.id);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ shiftsCompleted: 1, noShowCount: 1, attendanceRate: 50 });
  });

  it('não inclui trabalhador só com turno agendado ou cancelado (sem resolução)', async () => {
    const { owner, company, category } = await setup();
    const worker = await createWorker(WORKER_A_PHONE, 'Ana Souza');
    const job = await createJobRow(company.id, category.id, new Date(Date.now() + 24 * 60 * 60 * 1000));
    await createShiftRow(job.id, worker.id, { status: 'scheduled' });

    const result = await getCompanyWorkerHistory(owner.id);

    expect(result).toEqual([]);
  });

  it('calcula a média das notas (já arredondadas por turno) que a empresa deu a esse trabalhador', async () => {
    const { owner, company, category } = await setup();
    const worker = await createWorker(WORKER_A_PHONE, 'Ana Souza');
    // Duas notas gerais diferentes (5 e 4, cada uma já é a média arredondada
    // das categorias daquele turno — ver create-rating.ts) pra confirmar que
    // o serviço tira a média entre turnos, não só repete uma nota só.
    const jobHigh = await createJobRow(company.id, category.id, new Date(Date.now() - 48 * 60 * 60 * 1000));
    const shiftHigh = await createShiftRow(jobHigh.id, worker.id, { status: 'completed', checkOutAt: new Date() });
    await createRating(owner.id, shiftHigh.id, {
      categoryScores: { pontualidade: 5, educacao: 5, proatividade: 5, comunicacao: 5, qualidade: 5 },
      comment: undefined,
    });

    const jobLow = await createJobRow(company.id, category.id, new Date(Date.now() - 24 * 60 * 60 * 1000));
    const shiftLow = await createShiftRow(jobLow.id, worker.id, { status: 'completed', checkOutAt: new Date() });
    await createRating(owner.id, shiftLow.id, {
      categoryScores: { pontualidade: 4, educacao: 4, proatividade: 4, comunicacao: 4, qualidade: 4 },
      comment: undefined,
    });

    const result = await getCompanyWorkerHistory(owner.id);

    expect(result[0].avgRatingGiven).toBe('4.5');
  });

  it('ordena por taxa de comparecimento e depois por volume de turnos', async () => {
    const { owner, company, category } = await setup();
    const reliableWorker = await createWorker(WORKER_A_PHONE, 'Ana Confiável');
    const unreliableWorker = await createWorker(WORKER_B_PHONE, 'Beatriz Faltosa');

    const jobA1 = await createJobRow(company.id, category.id, new Date(Date.now() - 72 * 60 * 60 * 1000));
    await createShiftRow(jobA1.id, reliableWorker.id, { status: 'completed', checkOutAt: new Date() });
    const jobA2 = await createJobRow(company.id, category.id, new Date(Date.now() - 48 * 60 * 60 * 1000));
    await createShiftRow(jobA2.id, reliableWorker.id, { status: 'completed', checkOutAt: new Date() });

    const jobB1 = await createJobRow(company.id, category.id, new Date(Date.now() - 24 * 60 * 60 * 1000));
    await createShiftRow(jobB1.id, unreliableWorker.id, { status: 'no_show' });

    const result = await getCompanyWorkerHistory(owner.id);

    expect(result.map((entry) => entry.fullName)).toEqual(['Ana Confiável', 'Beatriz Faltosa']);
  });
});
