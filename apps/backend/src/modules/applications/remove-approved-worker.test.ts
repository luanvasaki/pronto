import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../../db/client';
import { applications, companies, jobs, shifts, skillCategories, users, workerProfiles } from '../../db/schema';
import { createApplication } from './create-application';
import { removeApprovedWorker } from './remove-approved-worker';
import { updateApplicationStatus } from './update-application-status';

// Fixtures únicas entre arquivos de teste (ver README).
const WORKER_PHONE = '+5511966660086';
const OTHER_WORKER_PHONE = '+5511966660087';
const OWNER_PHONE = '+5511966660088';
const OTHER_OWNER_PHONE = '+5511966660089';
const TEST_CNPJ = '11222333000250';

const TOMORROW = new Date(Date.now() + 24 * 60 * 60 * 1000);
const TOMORROW_PLUS_5H = new Date(TOMORROW.getTime() + 5 * 60 * 60 * 1000);

async function setup(positionsTotal = 2) {
  const [worker] = await db.insert(users).values({ phone: WORKER_PHONE }).returning();
  await db.insert(workerProfiles).values({ kycStatus: 'approved', userId: worker.id, fullName: 'Ana Souza' });
  const [owner] = await db.insert(users).values({ phone: OWNER_PHONE }).returning();
  const [company] = await db
    .insert(companies)
    .values({ ownerUserId: owner.id, legalName: 'Buffet Aurora Ltda', tradeName: 'Buffet Aurora', cnpj: TEST_CNPJ })
    .returning();
  const [category] = await db.insert(skillCategories).values({ name: 'Categoria de teste — remove-approved' }).returning();
  const [job] = await db
    .insert(jobs)
    .values({
      companyId: company.id,
      categoryId: category.id,
      description: 'Vaga de teste com descrição detalhada o suficiente.',
      addressLabel: 'Endereço de teste',
      locationLat: -23.55,
      locationLng: -46.63,
      positionsTotal,
      payAmount: '100.00',
      startsAt: TOMORROW,
      endsAt: TOMORROW_PLUS_5H,
    })
    .returning();
  const application = await createApplication(worker.id, job.id, true);
  return { worker, owner, job, application };
}

describe('removeApprovedWorker', () => {
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
    await db.delete(users).where(eq(users.phone, OTHER_OWNER_PHONE));
    await db.delete(skillCategories).where(eq(skillCategories.name, 'Categoria de teste — remove-approved'));
  });

  it('rejeita candidatura inexistente', async () => {
    const { owner } = await setup();

    await expect(
      removeApprovedWorker(owner.id, '00000000-0000-0000-0000-000000000000'),
    ).rejects.toThrow('Candidatura não encontrada');
  });

  it('rejeita quem não é dono da empresa', async () => {
    const { owner, application } = await setup();
    await updateApplicationStatus(owner.id, application.id, 'approved');
    const [otherOwner] = await db.insert(users).values({ phone: OTHER_OWNER_PHONE }).returning();

    await expect(removeApprovedWorker(otherOwner.id, application.id)).rejects.toThrow('não tem acesso');
  });

  it('rejeita remover candidatura que ainda não foi aprovada', async () => {
    const { owner, application } = await setup();

    await expect(removeApprovedWorker(owner.id, application.id)).rejects.toThrow(
      'Só é possível remover uma candidatura aprovada',
    );
  });

  it('remove um candidato aprovado: volta o status, cancela o turno e reabre a vaga', async () => {
    const { owner, job, application } = await setup(1);
    await updateApplicationStatus(owner.id, application.id, 'approved');

    const result = await removeApprovedWorker(owner.id, application.id);

    expect(result.status).toBe('rejected');
    expect(result.removedAt).not.toBeNull();

    const updatedJob = await db.query.jobs.findFirst({ where: eq(jobs.id, job.id) });
    expect(updatedJob?.positionsFilled).toBe(0);
    expect(updatedJob?.status).toBe('open');

    const shift = await db.query.shifts.findFirst({ where: eq(shifts.applicationId, application.id) });
    expect(shift?.status).toBe('cancelled');
  });

  it('rejeita remover a mesma candidatura duas vezes', async () => {
    const { owner, application } = await setup(2);
    await updateApplicationStatus(owner.id, application.id, 'approved');
    await removeApprovedWorker(owner.id, application.id);

    await expect(removeApprovedWorker(owner.id, application.id)).rejects.toThrow(
      'Só é possível remover uma candidatura aprovada',
    );
  });

  it('reabre a vaga que estava "filled" ao remover o único candidato aprovado', async () => {
    const { owner, job, application } = await setup(1);
    await updateApplicationStatus(owner.id, application.id, 'approved');
    const filledJob = await db.query.jobs.findFirst({ where: eq(jobs.id, job.id) });
    expect(filledJob?.status).toBe('filled');

    await removeApprovedWorker(owner.id, application.id);

    const reopenedJob = await db.query.jobs.findFirst({ where: eq(jobs.id, job.id) });
    expect(reopenedJob?.status).toBe('open');
    expect(reopenedJob?.positionsFilled).toBe(0);
  });

  it('rejeita remover quando o turno já teve check-in', async () => {
    const { owner, job, application } = await setup(1);
    await updateApplicationStatus(owner.id, application.id, 'approved');
    const shift = await db.query.shifts.findFirst({ where: eq(shifts.applicationId, application.id) });
    await db.update(shifts).set({ status: 'checked_in' }).where(eq(shifts.id, shift!.id));

    await expect(removeApprovedWorker(owner.id, application.id)).rejects.toThrow(
      'já começou ou foi concluído',
    );

    const updatedJob = await db.query.jobs.findFirst({ where: eq(jobs.id, job.id) });
    expect(updatedJob?.positionsFilled).toBe(1);
  });

  it('decrementa positionsFilled corretamente mesmo removendo 2 candidatos aprovados em corrida (duas chamadas simultâneas)', async () => {
    const { owner, job, application } = await setup(2);
    await updateApplicationStatus(owner.id, application.id, 'approved');
    const [otherWorker] = await db.insert(users).values({ phone: OTHER_WORKER_PHONE }).returning();
    await db.insert(workerProfiles).values({ kycStatus: 'approved', userId: otherWorker.id, fullName: 'Beatriz Lima' });
    const otherApplication = await createApplication(otherWorker.id, job.id, true);
    await updateApplicationStatus(owner.id, otherApplication.id, 'approved');
    const filledJob = await db.query.jobs.findFirst({ where: eq(jobs.id, job.id) });
    expect(filledJob?.positionsFilled).toBe(2);

    const results = await Promise.allSettled([
      removeApprovedWorker(owner.id, application.id),
      removeApprovedWorker(owner.id, otherApplication.id),
    ]);

    expect(results.every((result) => result.status === 'fulfilled')).toBe(true);

    // O ponto da corrida: sem UPDATE atômico, as duas remoções liam o
    // mesmo positionsFilled=2 e as duas escreviam 1 — perdendo um dos
    // decrementos. Com a expressão SQL, o resultado tem que ser 0.
    const finalJob = await db.query.jobs.findFirst({ where: eq(jobs.id, job.id) });
    expect(finalJob?.positionsFilled).toBe(0);
    expect(finalJob?.status).toBe('open');
  });
});
