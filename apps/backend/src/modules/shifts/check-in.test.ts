import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { updateApplicationStatus } from '../applications/update-application-status';
import { db } from '../../db/client';
import { applications, companies, jobs, shifts, skillCategories, users, workerProfiles } from '../../db/schema';
import { createApplication } from '../applications/create-application';
import { checkIn } from './check-in';

const sendPushToUserMock = vi.fn();
vi.mock('../push/send-push-notification', () => ({
  sendPushToUser: (...args: unknown[]) => sendPushToUserMock(...args),
}));

// Fixtures únicas entre arquivos de teste (ver README).
const WORKER_PHONE = '+5511966660021';
const OTHER_WORKER_PHONE = '+5511966660022';
const OWNER_PHONE = '+5511966660023';
const TEST_CNPJ = '11222333000222';
const TEST_CATEGORY_NAME = 'Categoria de teste — check-in';

const TOMORROW = new Date(Date.now() + 24 * 60 * 60 * 1000);
const TOMORROW_PLUS_5H = new Date(TOMORROW.getTime() + 5 * 60 * 60 * 1000);

async function setupScheduledShift() {
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
  const application = await createApplication(worker.id, job.id, true);
  await updateApplicationStatus(owner.id, application.id, 'approved');
  const shift = await db.query.shifts.findFirst({ where: eq(shifts.applicationId, application.id) });
  if (!shift) {
    throw new Error('Turno não foi criado no setup do teste.');
  }
  return { worker, job, shift };
}

describe('checkIn', () => {
  afterEach(async () => {
    sendPushToUserMock.mockReset();
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

  it('rejeita latitude inválida', async () => {
    const { worker, shift } = await setupScheduledShift();

    await expect(checkIn(worker.id, shift.id, { lat: 200, lng: 0 })).rejects.toThrow('Latitude inválida');
  });

  it('rejeita turno inexistente', async () => {
    const { worker } = await setupScheduledShift();

    await expect(
      checkIn(worker.id, '00000000-0000-0000-0000-000000000000', { lat: -23.55, lng: -46.63 }),
    ).rejects.toThrow('Turno não encontrado');
  });

  it('rejeita quem não é o worker do turno', async () => {
    const { shift } = await setupScheduledShift();
    const [otherWorker] = await db.insert(users).values({ phone: OTHER_WORKER_PHONE }).returning();

    await expect(checkIn(otherWorker.id, shift.id, { lat: -23.55, lng: -46.63 })).rejects.toThrow(
      'não tem acesso',
    );
  });

  it('faz check-in e muda o status pra "checked_in"', async () => {
    const { worker, shift } = await setupScheduledShift();

    const result = await checkIn(worker.id, shift.id, { lat: -23.55, lng: -46.63 });

    expect(result.status).toBe('checked_in');
    expect(result.checkInLat).toBe(-23.55);
    expect(result.checkInAt).not.toBeNull();
  });

  it('aceita check-in dentro do raio de tolerância do local da vaga', async () => {
    const { worker, shift } = await setupScheduledShift();

    // ~11m de distância do local da vaga — bem dentro dos 150m de tolerância.
    const result = await checkIn(worker.id, shift.id, { lat: -23.5501, lng: -46.6301 });

    expect(result.status).toBe('checked_in');
  });

  it('rejeita check-in longe do local da vaga', async () => {
    const { worker, shift } = await setupScheduledShift();

    // ~1.5km de distância do local da vaga (0.0001 vs 0.01 de diferença).
    await expect(checkIn(worker.id, shift.id, { lat: -23.56, lng: -46.64 })).rejects.toThrow(
      'Você precisa estar no local do turno',
    );

    const unchanged = await db.query.shifts.findFirst({ where: eq(shifts.id, shift.id) });
    expect(unchanged?.status).toBe('scheduled');
  });

  it('rejeita segundo check-in do mesmo turno', async () => {
    const { worker, shift } = await setupScheduledShift();
    await checkIn(worker.id, shift.id, { lat: -23.55, lng: -46.63 });

    await expect(checkIn(worker.id, shift.id, { lat: -23.55, lng: -46.63 })).rejects.toThrow(
      'não está esperando check-in',
    );
  });

  it('notifica o dono da empresa por push quando o check-in é feito', async () => {
    const { worker, job, shift } = await setupScheduledShift();

    await checkIn(worker.id, shift.id, { lat: -23.55, lng: -46.63 });

    const company = await db.query.companies.findFirst({ where: eq(companies.id, job.companyId) });
    expect(sendPushToUserMock).toHaveBeenCalledTimes(1);
    expect(sendPushToUserMock).toHaveBeenCalledWith(company?.ownerUserId, {
      title: 'Ana Souza fez check-in',
      body: TEST_CATEGORY_NAME,
      url: '/escala',
    });
  });

  it('o check-in continua valendo mesmo se a notificação por push falhar', async () => {
    sendPushToUserMock.mockRejectedValue(new Error('push service fora do ar'));
    const { worker, shift } = await setupScheduledShift();

    const result = await checkIn(worker.id, shift.id, { lat: -23.55, lng: -46.63 });

    expect(result.status).toBe('checked_in');
  });

  it('só um check-in vence quando duas chamadas chegam juntas', async () => {
    const { worker, shift } = await setupScheduledShift();

    const results = await Promise.allSettled([
      checkIn(worker.id, shift.id, { lat: -23.55, lng: -46.63 }),
      checkIn(worker.id, shift.id, { lat: -23.55, lng: -46.63 }),
    ]);

    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    expect(fulfilled).toHaveLength(1);
  });
});
