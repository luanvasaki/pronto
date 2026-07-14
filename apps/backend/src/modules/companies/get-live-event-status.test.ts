import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../db/client';
import { applications, companies, jobs, shifts, skillCategories, users, workerProfiles } from '../../db/schema';
import { getLiveEventStatus } from './get-live-event-status';

// Fixtures únicas entre arquivos de teste (ver README).
const OWNER_PHONE = '+5511966660501';
const TEST_CNPJ = '11222333000513';
const TEST_CATEGORY_NAME = 'Categoria de teste — get-live-event-status';

function startOfToday(): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfToday(): Date {
  const date = startOfToday();
  date.setDate(date.getDate() + 1);
  return date;
}

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

async function createJobToday(companyId: string, categoryId: string, startsAt: Date, positionsTotal = 1) {
  const [job] = await db
    .insert(jobs)
    .values({
      companyId,
      categoryId,
      description: 'Vaga de teste com descrição detalhada o suficiente.',
      addressLabel: 'Endereço de teste',
      locationLat: -23.55,
      locationLng: -46.63,
      positionsTotal,
      payAmount: '120.00',
      startsAt,
      endsAt: new Date(startsAt.getTime() + 4 * 60 * 60 * 1000),
    })
    .returning();
  return job;
}

async function createShift(
  jobId: string,
  workerId: string,
  status: 'scheduled' | 'checked_in' | 'completed' | 'cancelled',
  overrides: { checkInAt?: Date; checkOutAt?: Date } = {},
) {
  const [application] = await db.insert(applications).values({ jobId, workerId, status: 'approved' }).returning();
  const [shift] = await db
    .insert(shifts)
    .values({ applicationId: application.id, jobId, workerId, payAmountSnapshot: '120.00', status, ...overrides })
    .returning();
  return shift;
}

describe('getLiveEventStatus', () => {
  const workerPhones = [
    '+5511966660502',
    '+5511966660503',
    '+5511966660504',
    '+5511966660505',
    '+5511966660506',
  ];

  // Fixado à tarde (não perto da meia-noite) — os testes usam offsets de
  // até 3h antes de "agora" (ex.: turno concluído) pra montar cenários,
  // e um "agora" real perto da meia-noite empurraria esse startsAt pro
  // dia anterior, saindo do intervalo [startOfToday, endOfToday) e
  // quebrando o teste de forma dependente só do horário em que roda.
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-07-14T15:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

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
      await db.delete(companies).where(eq(companies.ownerUserId, owner.id));
    }
    await db.delete(users).where(eq(users.phone, OWNER_PHONE));
    for (const phone of workerPhones) {
      await db.delete(users).where(eq(users.phone, phone));
    }
    await db.delete(skillCategories).where(eq(skillCategories.name, TEST_CATEGORY_NAME));
  });

  it('rejeita quando o perfil da empresa ainda não existe', async () => {
    const [owner] = await db.insert(users).values({ phone: OWNER_PHONE }).returning();

    await expect(getLiveEventStatus(owner.id, startOfToday(), endOfToday())).rejects.toThrow('Complete o cadastro');
  });

  it('retorna lista vazia quando não há vaga no intervalo', async () => {
    const { owner } = await setup();

    const result = await getLiveEventStatus(owner.id, startOfToday(), endOfToday());

    expect(result.jobs).toEqual([]);
  });

  it('não inclui vaga fora do intervalo do dia', async () => {
    const { owner, company, category } = await setup();
    const tomorrow = new Date(endOfToday().getTime() + 5 * 60 * 60 * 1000);
    await createJobToday(company.id, category.id, tomorrow);

    const result = await getLiveEventStatus(owner.id, startOfToday(), endOfToday());

    expect(result.jobs).toEqual([]);
  });

  it('status "aguardando": turno agendado dentro da tolerância de 15min', async () => {
    const { owner, company, category } = await setup();
    const worker = await createWorker(workerPhones[0], 'Ana Souza');
    const job = await createJobToday(company.id, category.id, new Date(Date.now() + 5 * 60 * 1000));
    await createShift(job.id, worker.id, 'scheduled');

    const result = await getLiveEventStatus(owner.id, startOfToday(), endOfToday());

    expect(result.jobs).toHaveLength(1);
    expect(result.jobs[0].shifts[0]).toMatchObject({ status: 'aguardando', minutesLate: null, workerName: 'Ana Souza' });
  });

  it('status "atrasado": turno agendado além da tolerância, sem check-in', async () => {
    const { owner, company, category } = await setup();
    const worker = await createWorker(workerPhones[0], 'Beatriz Lima');
    const job = await createJobToday(company.id, category.id, new Date(Date.now() - 30 * 60 * 1000));
    await createShift(job.id, worker.id, 'scheduled');

    const result = await getLiveEventStatus(owner.id, startOfToday(), endOfToday());

    const entry = result.jobs[0].shifts[0];
    expect(entry.status).toBe('atrasado');
    expect(entry.minutesLate).toBeGreaterThanOrEqual(29);
    expect(entry.minutesLate).toBeLessThanOrEqual(31);
  });

  it('status "chegou": turno com check-in feito', async () => {
    const { owner, company, category } = await setup();
    const worker = await createWorker(workerPhones[0], 'Carlos Mendes');
    const job = await createJobToday(company.id, category.id, new Date(Date.now() - 30 * 60 * 1000));
    const checkInAt = new Date();
    await createShift(job.id, worker.id, 'checked_in', { checkInAt });

    const result = await getLiveEventStatus(owner.id, startOfToday(), endOfToday());

    expect(result.jobs[0].shifts[0]).toMatchObject({ status: 'chegou', minutesLate: null });
    expect(result.jobs[0].shifts[0].checkInAt?.getTime()).toBe(checkInAt.getTime());
  });

  it('status "concluido": turno concluído', async () => {
    const { owner, company, category } = await setup();
    const worker = await createWorker(workerPhones[0], 'Diego Alves');
    const job = await createJobToday(company.id, category.id, new Date(Date.now() - 3 * 60 * 60 * 1000));
    await createShift(job.id, worker.id, 'completed', { checkInAt: new Date(), checkOutAt: new Date() });

    const result = await getLiveEventStatus(owner.id, startOfToday(), endOfToday());

    expect(result.jobs[0].shifts[0].status).toBe('concluido');
  });

  it('ordena os turnos por urgência: atrasado antes de chegou antes de concluído', async () => {
    const { owner, company, category } = await setup();
    // Mesma vaga pra todo mundo — job.startsAt já passou há 30min (além da
    // tolerância), então qualquer turno ainda "scheduled" vira "atrasado".
    const job = await createJobToday(company.id, category.id, new Date(Date.now() - 30 * 60 * 1000), 3);

    const late = await createWorker(workerPhones[0], 'Zeta Atrasada');
    const arrived = await createWorker(workerPhones[2], 'Beta Chegou');
    const done = await createWorker(workerPhones[3], 'Gama Concluido');

    // Insere fora de ordem de propósito, pra confirmar que a ordenação é
    // por urgência de status, não pela ordem de criação/nome.
    await createShift(job.id, done.id, 'completed', { checkInAt: new Date(), checkOutAt: new Date() });
    await createShift(job.id, arrived.id, 'checked_in', { checkInAt: new Date() });
    await createShift(job.id, late.id, 'scheduled');

    const result = await getLiveEventStatus(owner.id, startOfToday(), endOfToday());

    const statuses = result.jobs[0].shifts.map((entry) => entry.status);
    expect(statuses).toEqual(['atrasado', 'chegou', 'concluido']);
  });

  it('não inclui turno cancelado', async () => {
    const { owner, company, category } = await setup();
    const worker = await createWorker(workerPhones[0], 'Worker Cancelado');
    const job = await createJobToday(company.id, category.id, new Date(Date.now() + 60 * 60 * 1000));
    await createShift(job.id, worker.id, 'cancelled');

    const result = await getLiveEventStatus(owner.id, startOfToday(), endOfToday());

    expect(result.jobs[0].shifts).toEqual([]);
  });
});
