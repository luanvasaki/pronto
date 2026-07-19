import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { updateApplicationStatus } from '../applications/update-application-status';
import { db } from '../../db/client';
import { applications, companies, jobs, shifts, skillCategories, users, workerProfiles } from '../../db/schema';
import { createApplication } from '../applications/create-application';
import { checkIn } from './check-in';
import { checkOut } from './check-out';
import { confirmCheckIn } from './confirm-check-in';

// Fixtures únicas entre arquivos de teste (ver README).
const WORKER_PHONE = '+5511966660070';
const OUTSIDER_PHONE = '+5511966660071';
const OWNER_PHONE = '+5511966660072';
const TEST_CNPJ = '11112223340710';
const TEST_CATEGORY_NAME = 'Categoria de teste — confirm-check-in';

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
  return { worker, owner, shift };
}

describe('confirmCheckIn', () => {
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
    await db.delete(users).where(eq(users.phone, OUTSIDER_PHONE));
    await db.delete(users).where(eq(users.phone, OWNER_PHONE));
    await db.delete(skillCategories).where(eq(skillCategories.name, TEST_CATEGORY_NAME));
  });

  it('rejeita turno inexistente', async () => {
    const { owner } = await setupScheduledShift();

    await expect(confirmCheckIn(owner.id, '00000000-0000-0000-0000-000000000000')).rejects.toThrow(
      'Turno não encontrado',
    );
  });

  it('rejeita quem não é dono da empresa', async () => {
    const { worker, shift } = await setupScheduledShift();
    await checkIn(worker.id, shift.id);
    const [outsider] = await db.insert(users).values({ phone: OUTSIDER_PHONE }).returning();

    await expect(confirmCheckIn(outsider.id, shift.id)).rejects.toThrow('Você não tem acesso');
  });

  it('rejeita turno que ainda não teve check-in', async () => {
    const { owner, shift } = await setupScheduledShift();

    await expect(confirmCheckIn(owner.id, shift.id)).rejects.toThrow('ainda não teve check-in');
  });

  it('confirma o check-in sem mudar o status do turno', async () => {
    const { worker, owner, shift } = await setupScheduledShift();
    await checkIn(worker.id, shift.id);

    const before = new Date();
    const result = await confirmCheckIn(owner.id, shift.id);

    expect(result.status).toBe('checked_in');
    expect(result.checkInConfirmedAt).not.toBeNull();
    expect(result.checkInConfirmedAt!.getTime()).toBeGreaterThanOrEqual(before.getTime());
  });

  it('confirma o check-in mesmo depois do trabalhador já ter feito check-out', async () => {
    const { worker, owner, shift } = await setupScheduledShift();
    await checkIn(worker.id, shift.id);
    await checkOut(worker.id, shift.id);

    const result = await confirmCheckIn(owner.id, shift.id);

    expect(result.status).toBe('checked_out');
    expect(result.checkInConfirmedAt).not.toBeNull();
  });

  it('é idempotente — confirmar duas vezes não muda o carimbo original', async () => {
    const { worker, owner, shift } = await setupScheduledShift();
    await checkIn(worker.id, shift.id);

    const first = await confirmCheckIn(owner.id, shift.id);
    const second = await confirmCheckIn(owner.id, shift.id);

    expect(second.checkInConfirmedAt?.getTime()).toBe(first.checkInConfirmedAt?.getTime());
  });

  it('mesmo em corrida (duas confirmações simultâneas), o carimbo fica igual nas duas', async () => {
    const { worker, owner, shift } = await setupScheduledShift();
    await checkIn(worker.id, shift.id);

    const [first, second] = await Promise.all([confirmCheckIn(owner.id, shift.id), confirmCheckIn(owner.id, shift.id)]);

    expect(first.checkInConfirmedAt?.getTime()).toBe(second.checkInConfirmedAt?.getTime());
  });
});
