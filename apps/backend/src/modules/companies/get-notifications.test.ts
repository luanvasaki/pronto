import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../../db/client';
import { applications, companies, jobs, ratings, shifts, skillCategories, users, workerProfiles } from '../../db/schema';
import { createApplication } from '../applications/create-application';
import { updateApplicationStatus } from '../applications/update-application-status';
import { createRating } from '../ratings/create-rating';
import { checkIn } from '../shifts/check-in';
import { checkOut } from '../shifts/check-out';
import { markShiftCheckInSeen } from '../shifts/mark-shift-check-in-seen';
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
  await db.insert(workerProfiles).values({ kycStatus: 'approved', userId: worker.id, fullName });
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
    expect(result.pendingApplications).toEqual([]);
  });

  it('conta e lista candidaturas pendentes de todas as vagas da empresa, com nome do worker e categoria', async () => {
    const { owner, job } = await setup();
    const worker = await createWorker(WORKER_PHONE, 'Ana Souza');
    const otherWorker = await createWorker(OTHER_WORKER_PHONE, 'Beatriz Lima');
    await createApplication(worker.id, job.id, true);
    await createApplication(otherWorker.id, job.id, true);

    const result = await getCompanyNotifications(owner.id);

    expect(result.pendingApplicationsCount).toBe(2);
    expect(result.pendingApplications).toHaveLength(2);
    const names = result.pendingApplications.map((n) => n.workerName).sort();
    expect(names).toEqual(['Ana Souza', 'Beatriz Lima']);
    expect(result.pendingApplications[0].categoryName).toBe(TEST_CATEGORY_NAME);
    expect(result.pendingApplications[0].jobId).toBe(job.id);
  });

  it('não conta nem lista candidaturas já aprovadas ou rejeitadas', async () => {
    const { owner, job } = await setup();
    const worker = await createWorker(WORKER_PHONE, 'Ana Souza');
    const otherWorker = await createWorker(OTHER_WORKER_PHONE, 'Beatriz Lima');
    const application = await createApplication(worker.id, job.id, true);
    await createApplication(otherWorker.id, job.id, true);
    await updateApplicationStatus(owner.id, application.id, 'approved');

    const result = await getCompanyNotifications(owner.id);

    expect(result.pendingApplicationsCount).toBe(1);
    expect(result.pendingApplications).toHaveLength(1);
    expect(result.pendingApplications[0].workerName).toBe('Beatriz Lima');
  });

  it('avisa quando um trabalhador faz check-in, e some depois de marcado como visto', async () => {
    const { owner, job } = await setup();
    const worker = await createWorker(WORKER_PHONE, 'Ana Souza');
    const application = await createApplication(worker.id, job.id, true);
    await updateApplicationStatus(owner.id, application.id, 'approved');
    const shift = await db.query.shifts.findFirst({ where: eq(shifts.applicationId, application.id) });
    if (!shift) throw new Error('Turno não foi criado no setup do teste.');
    await checkIn(worker.id, shift.id, { lat: -23.55, lng: -46.63 });

    const beforeSeen = await getCompanyNotifications(owner.id);
    expect(beforeSeen.checkedInCount).toBe(1);
    expect(beforeSeen.checkedInNotifications).toHaveLength(1);
    expect(beforeSeen.checkedInNotifications[0].workerName).toBe('Ana Souza');
    expect(beforeSeen.checkedInNotifications[0].categoryName).toBe(TEST_CATEGORY_NAME);

    await markShiftCheckInSeen(owner.id, shift.id);

    const afterSeen = await getCompanyNotifications(owner.id);
    expect(afterSeen.checkedInCount).toBe(0);
    expect(afterSeen.checkedInNotifications).toEqual([]);
  });

  it('avisa de escala concluída aguardando avaliação da empresa, e some depois que ela avalia', async () => {
    const { owner, job } = await setup();
    const worker = await createWorker(WORKER_PHONE, 'Ana Souza');
    const application = await createApplication(worker.id, job.id, true);
    await updateApplicationStatus(owner.id, application.id, 'approved');
    const shift = await db.query.shifts.findFirst({ where: eq(shifts.applicationId, application.id) });
    if (!shift) throw new Error('Turno não foi criado no setup do teste.');
    await checkIn(worker.id, shift.id, { lat: -23.55, lng: -46.63 });
    await checkOut(worker.id, shift.id, { lat: -23.55, lng: -46.63 });

    const beforeRating = await getCompanyNotifications(owner.id);
    expect(beforeRating.pendingRatingsCount).toBe(1);
    expect(beforeRating.pendingRatingsNotifications).toHaveLength(1);
    expect(beforeRating.pendingRatingsNotifications[0].workerName).toBe('Ana Souza');
    expect(beforeRating.pendingRatingsNotifications[0].categoryName).toBe(TEST_CATEGORY_NAME);
    expect(beforeRating.pendingRatingsNotifications[0].shiftId).toBe(shift.id);

    await createRating(owner.id, shift.id, {
      categoryScores: {
        pontualidade: 5,
        educacao: 5,
        proatividade: 5,
        comunicacao: 5,
        qualidade: 5,
      },
      comment: undefined,
    });

    const afterRating = await getCompanyNotifications(owner.id);
    expect(afterRating.pendingRatingsCount).toBe(0);
    expect(afterRating.pendingRatingsNotifications).toEqual([]);
  });

  it('não conta escala agendada ou em andamento como avaliação pendente', async () => {
    const { owner, job } = await setup();
    const worker = await createWorker(WORKER_PHONE, 'Ana Souza');
    const application = await createApplication(worker.id, job.id, true);
    await updateApplicationStatus(owner.id, application.id, 'approved');

    const result = await getCompanyNotifications(owner.id);

    expect(result.pendingRatingsCount).toBe(0);
    expect(result.pendingRatingsNotifications).toEqual([]);
  });
});
