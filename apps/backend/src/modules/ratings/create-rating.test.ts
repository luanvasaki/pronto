import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { updateApplicationStatus } from '../applications/update-application-status';
import { db } from '../../db/client';
import {
  applications,
  companies,
  jobs,
  ratings,
  shifts,
  skillCategories,
  users,
  workerProfiles,
} from '../../db/schema';
import { createApplication } from '../applications/create-application';
import { checkIn } from '../shifts/check-in';
import { checkOut } from '../shifts/check-out';
import { createRating } from './create-rating';

// Fixtures únicas entre arquivos de teste (ver README).
const WORKER_PHONE = '+5511966660027';
const OTHER_WORKER_PHONE = '+5511966660028';
const OWNER_PHONE = '+5511966660029';
const TEST_CNPJ = '11222333000244';
const TEST_CATEGORY_NAME = 'Categoria de teste — rating';

const TOMORROW = new Date(Date.now() + 24 * 60 * 60 * 1000);
const TOMORROW_PLUS_5H = new Date(TOMORROW.getTime() + 5 * 60 * 60 * 1000);

async function setupCompletedShift() {
  const [worker] = await db.insert(users).values({ phone: WORKER_PHONE }).returning();
  await db.insert(workerProfiles).values({ userId: worker.id, fullName: 'Ana Souza' });
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
  await updateApplicationStatus(owner.id, application.id, 'approved');
  const shift = await db.query.shifts.findFirst({ where: eq(shifts.applicationId, application.id) });
  if (!shift) {
    throw new Error('Turno não foi criado no setup do teste.');
  }
  await checkIn(worker.id, shift.id, { lat: -23.55, lng: -46.63 });
  await checkOut(worker.id, shift.id, { lat: -23.55, lng: -46.63 });
  return { worker, owner, company, shift };
}

describe('createRating', () => {
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

  it('rejeita nota inválida', async () => {
    const { worker, shift } = await setupCompletedShift();

    await expect(createRating(worker.id, shift.id, { score: 6, comment: undefined })).rejects.toThrow(
      'Nota inválida',
    );
  });

  it('rejeita avaliar turno que ainda não foi concluído', async () => {
    const [worker] = await db.insert(users).values({ phone: WORKER_PHONE }).returning();
    await db.insert(workerProfiles).values({ userId: worker.id, fullName: 'Ana Souza' });
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
    await updateApplicationStatus(owner.id, application.id, 'approved');
    const shift = await db.query.shifts.findFirst({ where: eq(shifts.applicationId, application.id) });

    await expect(createRating(worker.id, shift!.id, { score: 5, comment: undefined })).rejects.toThrow(
      'turnos concluídos',
    );
  });

  it('rejeita quem não tem relação com o turno', async () => {
    const { shift } = await setupCompletedShift();
    const [otherWorker] = await db.insert(users).values({ phone: OTHER_WORKER_PHONE }).returning();

    await expect(createRating(otherWorker.id, shift.id, { score: 5, comment: undefined })).rejects.toThrow(
      'não tem acesso',
    );
  });

  it('trabalhador avalia a empresa e atualiza a média da empresa', async () => {
    const { worker, company, shift } = await setupCompletedShift();

    const result = await createRating(worker.id, shift.id, { score: 4, comment: 'Ambiente organizado.' });

    expect(result.raterRole).toBe('worker');
    expect(result.score).toBe(4);

    const updatedCompany = await db.query.companies.findFirst({ where: eq(companies.id, company.id) });
    expect(updatedCompany?.avgRating).toBe('4.0');
  });

  it('empresa avalia o trabalhador e atualiza a média do trabalhador', async () => {
    const { owner, worker, shift } = await setupCompletedShift();

    const result = await createRating(owner.id, shift.id, { score: 5, comment: undefined });

    expect(result.raterRole).toBe('company');

    const updatedWorker = await db.query.workerProfiles.findFirst({
      where: eq(workerProfiles.userId, worker.id),
    });
    expect(updatedWorker?.avgRating).toBe('5.0');
  });

  it('rejeita segunda avaliação do mesmo papel pro mesmo turno', async () => {
    const { worker, shift } = await setupCompletedShift();
    await createRating(worker.id, shift.id, { score: 4, comment: undefined });

    await expect(createRating(worker.id, shift.id, { score: 5, comment: undefined })).rejects.toThrow(
      'já avaliou',
    );
  });
});
