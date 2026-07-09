import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../../db/client';
import { applications, companies, jobs, shifts, skillCategories, users, workerProfiles, workerSkills } from '../../db/schema';
import { createApplication } from './create-application';
import { listJobApplications } from './list-job-applications';
import { updateApplicationStatus } from './update-application-status';

// Fixtures únicas entre arquivos de teste (ver README).
const WORKER_PHONE = '+5511966660014';
const OWNER_PHONE = '+5511966660015';
const OTHER_OWNER_PHONE = '+5511966660016';
const TEST_CNPJ = '11222333000200';
const TEST_CATEGORY_NAME = 'Categoria de teste — list-job-applications';

const TOMORROW = new Date(Date.now() + 24 * 60 * 60 * 1000);
const TOMORROW_PLUS_5H = new Date(TOMORROW.getTime() + 5 * 60 * 60 * 1000);

async function setup(requiresExperience = false) {
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
      requiresExperience,
      addressLabel: 'Endereço de teste',
      locationLat: -23.55,
      locationLng: -46.63,
      positionsTotal: 2,
      payAmount: '100.00',
      startsAt: TOMORROW,
      endsAt: TOMORROW_PLUS_5H,
    })
    .returning();
  return { worker, owner, job };
}

describe('listJobApplications', () => {
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
    await db.delete(users).where(eq(users.phone, OTHER_OWNER_PHONE));
    await db.delete(skillCategories).where(eq(skillCategories.name, TEST_CATEGORY_NAME));
  });

  it('rejeita vaga inexistente', async () => {
    const { owner } = await setup();

    await expect(
      listJobApplications(owner.id, '00000000-0000-0000-0000-000000000000'),
    ).rejects.toThrow('Vaga não encontrada');
  });

  it('rejeita quem não é dono da empresa da vaga', async () => {
    const { job } = await setup();
    const [otherOwner] = await db.insert(users).values({ phone: OTHER_OWNER_PHONE }).returning();

    await expect(listJobApplications(otherOwner.id, job.id)).rejects.toThrow('não tem acesso');
  });

  it('lista os candidatos com nome do worker, sinalizando que ele não tem a especialidade da vaga', async () => {
    const { worker, owner, job } = await setup();
    await createApplication(worker.id, job.id);

    const result = await listJobApplications(owner.id, job.id);

    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('pending');
    expect(result[0].worker.fullName).toBe('Ana Souza');
    expect(result[0].worker.matchesSkills).toBe(false);
    expect(result[0].shift).toBeNull();
  });

  it('sinaliza quando o worker tem a especialidade da vaga', async () => {
    const { worker, owner, job } = await setup();
    await db.insert(workerSkills).values({ workerId: worker.id, categoryId: job.categoryId });
    await createApplication(worker.id, job.id);

    const result = await listJobApplications(owner.id, job.id);

    expect(result[0].worker.matchesSkills).toBe(true);
  });

  it('sinaliza experienceMismatch quando a vaga exige experiência e o worker não declarou ter', async () => {
    const { worker, owner, job } = await setup(true);
    await db.insert(workerSkills).values({ workerId: worker.id, categoryId: job.categoryId, hasExperience: false });
    await createApplication(worker.id, job.id);

    const result = await listJobApplications(owner.id, job.id);

    expect(result[0].experienceMismatch).toBe(true);
  });

  it('não sinaliza experienceMismatch quando o worker declarou experiência', async () => {
    const { worker, owner, job } = await setup(true);
    await db.insert(workerSkills).values({ workerId: worker.id, categoryId: job.categoryId, hasExperience: true });
    await createApplication(worker.id, job.id);

    const result = await listJobApplications(owner.id, job.id);

    expect(result[0].experienceMismatch).toBe(false);
  });

  it('não sinaliza experienceMismatch quando a vaga não exige experiência', async () => {
    const { worker, owner, job } = await setup(false);
    await createApplication(worker.id, job.id);

    const result = await listJobApplications(owner.id, job.id);

    expect(result[0].experienceMismatch).toBe(false);
  });

  it('conta turnos concluídos anteriores com a mesma empresa como previousShiftsWithCompany', async () => {
    const { worker, owner, job } = await setup();
    const [category] = await db.query.skillCategories.findMany({ where: eq(skillCategories.name, TEST_CATEGORY_NAME) });
    const [previousJob] = await db
      .insert(jobs)
      .values({
        companyId: job.companyId,
        categoryId: category.id,
        description: 'Vaga anterior, já concluída, com descrição detalhada.',
        addressLabel: 'Endereço de teste',
        locationLat: -23.55,
        locationLng: -46.63,
        positionsTotal: 1,
        payAmount: '100.00',
        startsAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
        endsAt: new Date(Date.now() - 40 * 60 * 60 * 1000),
      })
      .returning();
    const previousApplication = await createApplication(worker.id, previousJob.id);
    await updateApplicationStatus(owner.id, previousApplication.id, 'approved');
    const previousShift = await db.query.shifts.findFirst({
      where: eq(shifts.applicationId, previousApplication.id),
    });
    await db.update(shifts).set({ status: 'completed' }).where(eq(shifts.id, previousShift!.id));

    await createApplication(worker.id, job.id);
    const result = await listJobApplications(owner.id, job.id);

    expect(result[0].worker.previousShiftsWithCompany).toBe(1);
  });

  it('não conta turno anterior que não foi concluído (ex: apenas agendado)', async () => {
    const { worker, owner, job } = await setup();
    const [category] = await db.query.skillCategories.findMany({ where: eq(skillCategories.name, TEST_CATEGORY_NAME) });
    const [previousJob] = await db
      .insert(jobs)
      .values({
        companyId: job.companyId,
        categoryId: category.id,
        description: 'Vaga anterior, ainda agendada, com descrição detalhada.',
        addressLabel: 'Endereço de teste',
        locationLat: -23.55,
        locationLng: -46.63,
        positionsTotal: 1,
        payAmount: '100.00',
        startsAt: TOMORROW,
        endsAt: TOMORROW_PLUS_5H,
      })
      .returning();
    const previousApplication = await createApplication(worker.id, previousJob.id);
    await updateApplicationStatus(owner.id, previousApplication.id, 'approved');

    await createApplication(worker.id, job.id);
    const result = await listJobApplications(owner.id, job.id);

    expect(result[0].worker.previousShiftsWithCompany).toBe(0);
  });

  it('inclui o turno quando a candidatura já foi aprovada', async () => {
    const { worker, owner, job } = await setup();
    const application = await createApplication(worker.id, job.id);
    await updateApplicationStatus(owner.id, application.id, 'approved');

    const result = await listJobApplications(owner.id, job.id);

    expect(result[0].status).toBe('approved');
    expect(result[0].shift?.status).toBe('scheduled');
    expect(result[0].shift?.checkInAt).toBeNull();
  });
});
