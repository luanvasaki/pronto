import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { updateApplicationStatus } from '../applications/update-application-status';
import { db } from '../../db/client';
import { applications, companies, jobs, shifts, skillCategories, users, workerProfiles } from '../../db/schema';
import { createApplication } from '../applications/create-application';
import { createJob } from './create-job';
import { updateJob } from './update-job';

// Fixtures únicas entre arquivos de teste (ver README).
const OWNER_PHONE = '+5511966660050';
const OTHER_OWNER_PHONE = '+5511966660051';
const WORKER_PHONE = '+5511966660052';
const SECOND_WORKER_PHONE = '+5511966660053';
const TEST_CNPJ = '11222333000311';
const TEST_CATEGORY_NAME = 'Categoria de teste — update-job';
const OTHER_CATEGORY_NAME = 'Categoria de teste — update-job B';

const TOMORROW = new Date(Date.now() + 24 * 60 * 60 * 1000);
const TOMORROW_PLUS_5H = new Date(TOMORROW.getTime() + 5 * 60 * 60 * 1000);
const IN_TWO_DAYS = new Date(Date.now() + 48 * 60 * 60 * 1000);
const IN_TWO_DAYS_PLUS_5H = new Date(IN_TWO_DAYS.getTime() + 5 * 60 * 60 * 1000);

function baseInput(categoryId: string) {
  return {
    categoryId,
    description: 'Uniforme preto próprio, experiência em eventos.',
    requiresExperience: false,
    addressLabel: 'Vila Madalena, São Paulo',
    locationLat: -23.546,
    locationLng: -46.69,
    positionsTotal: 2,
    payAmount: '130.00',
    startsAt: TOMORROW.toISOString(),
    endsAt: TOMORROW_PLUS_5H.toISOString(),
  };
}

async function setup() {
  const [owner] = await db.insert(users).values({ phone: OWNER_PHONE }).returning();
  await db
    .insert(companies)
    .values({ verificationStatus: 'approved', ownerUserId: owner.id, legalName: 'Buffet Aurora Ltda', tradeName: 'Buffet Aurora', cnpj: TEST_CNPJ });
  const [category] = await db.insert(skillCategories).values({ name: TEST_CATEGORY_NAME }).returning();
  const job = await createJob(owner.id, baseInput(category.id), true);
  return { owner, category, job };
}

describe('updateJob', () => {
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
    await db.delete(users).where(eq(users.phone, OWNER_PHONE));
    await db.delete(users).where(eq(users.phone, OTHER_OWNER_PHONE));
    await db.delete(users).where(eq(users.phone, WORKER_PHONE));
    await db.delete(users).where(eq(users.phone, SECOND_WORKER_PHONE));
    await db.delete(skillCategories).where(eq(skillCategories.name, TEST_CATEGORY_NAME));
    await db.delete(skillCategories).where(eq(skillCategories.name, OTHER_CATEGORY_NAME));
  });

  it('rejeita quem não é dono da empresa', async () => {
    const { category, job } = await setup();
    const [otherOwner] = await db.insert(users).values({ phone: OTHER_OWNER_PHONE }).returning();

    await expect(updateJob(otherOwner.id, job.id, baseInput(category.id))).rejects.toThrow(
      'não tem acesso',
    );
  });

  it('rejeita vaga inexistente', async () => {
    const { category } = await setup();
    const [owner] = await db.query.users.findMany({ where: eq(users.phone, OWNER_PHONE) });

    await expect(
      updateJob(owner.id, '00000000-0000-0000-0000-000000000000', baseInput(category.id)),
    ).rejects.toThrow('não encontrada');
  });

  it('rejeita editar vaga que não está mais aberta', async () => {
    const { owner, category, job } = await setup();
    const [worker] = await db.insert(users).values({ phone: WORKER_PHONE }).returning();
    await db.insert(workerProfiles).values({ kycStatus: 'approved', userId: worker.id, fullName: 'Ana Souza' });
    const application = await createApplication(worker.id, job.id, true);
    await updateApplicationStatus(owner.id, application.id, 'approved');
    // baseInput usa positionsTotal 2 — preenche a segunda posição também pra fechar a vaga.
    const [secondWorkerUser] = await db
      .insert(users)
      .values({ phone: SECOND_WORKER_PHONE })
      .returning();
    await db.insert(workerProfiles).values({ kycStatus: 'approved', userId: secondWorkerUser.id, fullName: 'Beatriz Lima' });
    const secondApplication = await createApplication(secondWorkerUser.id, job.id, true);
    await updateApplicationStatus(owner.id, secondApplication.id, 'approved');

    await expect(updateJob(owner.id, job.id, baseInput(category.id))).rejects.toThrow(
      'Só é possível editar vagas abertas',
    );
  });

  it('nunca deixa uma edição escrever silenciosamente numa vaga preenchida por uma aprovação simultânea (duas chamadas simultâneas)', async () => {
    const { owner, category, job } = await setup();
    const [worker] = await db.insert(users).values({ phone: WORKER_PHONE }).returning();
    await db.insert(workerProfiles).values({ kycStatus: 'approved', userId: worker.id, fullName: 'Ana Souza' });
    const application = await createApplication(worker.id, job.id, true);
    await updateApplicationStatus(owner.id, application.id, 'approved');

    const [secondWorkerUser] = await db.insert(users).values({ phone: SECOND_WORKER_PHONE }).returning();
    await db.insert(workerProfiles).values({ kycStatus: 'approved', userId: secondWorkerUser.id, fullName: 'Beatriz Lima' });
    const secondApplication = await createApplication(secondWorkerUser.id, job.id, true);

    // A docstring de updateJob promete fechar "a corrida de editar bem
    // no instante em que uma candidatura é aprovada" — isso é
    // literalmente essa aprovação (a 2ª de 2 posições, que preenche a
    // vaga) rodando ao mesmo tempo que uma edição.
    const results = await Promise.allSettled([
      updateJob(owner.id, job.id, { ...baseInput(category.id), description: 'Descrição editada durante a corrida.' }),
      updateApplicationStatus(owner.id, secondApplication.id, 'approved'),
    ]);

    const [updateJobResult] = results;
    if (updateJobResult.status === 'rejected') {
      expect(updateJobResult.reason.message).toContain('Só é possível editar vagas abertas');
    }

    const finalJob = await db.query.jobs.findFirst({ where: eq(jobs.id, job.id) });
    // A aprovação sempre devia ter conseguido preencher a vaga, não
    // importa a ordem — nenhum turno "sumiu" por causa da corrida.
    expect(finalJob?.status).toBe('filled');
    expect(finalJob?.positionsFilled).toBe(2);
  });

  it('rejeita reduzir positionsTotal abaixo do já aprovado', async () => {
    const { owner, category, job } = await setup();
    const [worker] = await db.insert(users).values({ phone: WORKER_PHONE }).returning();
    await db.insert(workerProfiles).values({ kycStatus: 'approved', userId: worker.id, fullName: 'Ana Souza' });
    const application = await createApplication(worker.id, job.id, true);
    await updateApplicationStatus(owner.id, application.id, 'approved');

    await expect(
      updateJob(owner.id, job.id, { ...baseInput(category.id), positionsTotal: 0 }),
    ).rejects.toThrow('Número de vagas precisa ser pelo menos 1');
  });

  it('rejeita categoria inválida', async () => {
    const { owner, job } = await setup();

    await expect(
      updateJob(owner.id, job.id, baseInput('00000000-0000-0000-0000-000000000000')),
    ).rejects.toThrow('Categoria inválida');
  });

  it('atualiza os dados da vaga', async () => {
    const { owner, job } = await setup();
    const [otherCategory] = await db.insert(skillCategories).values({ name: OTHER_CATEGORY_NAME }).returning();

    const result = await updateJob(owner.id, job.id, {
      categoryId: otherCategory.id,
      description: 'Descrição atualizada com detalhes suficientes.',
      requiresExperience: true,
      addressLabel: 'Pinheiros, São Paulo',
      locationLat: -23.56,
      locationLng: -46.7,
      positionsTotal: 3,
      payAmount: '150.00',
      startsAt: IN_TWO_DAYS.toISOString(),
      endsAt: IN_TWO_DAYS_PLUS_5H.toISOString(),
    });

    expect(result.categoryId).toBe(otherCategory.id);
    expect(result.requiresExperience).toBe(true);
    expect(result.addressLabel).toBe('Pinheiros, São Paulo');
    expect(result.payAmount).toBe('150.00');
    expect(result.positionsTotal).toBe(3);
  });
});
