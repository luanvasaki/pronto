import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../../db/client';
import { applications, companies, jobQuestions, jobs, skillCategories, users, workerProfiles } from '../../db/schema';
import { createQuestion } from './create-question';

const OWNER_PHONE = '+5511966660030';
const WORKER_PHONE = '+5511966660031';
const OUTSIDER_PHONE = '+5511966660032';
const TEST_CNPJ = '11112223340936';
const TEST_CATEGORY_NAME = 'Categoria de teste — create-question';

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
  const [worker] = await db.insert(users).values({ phone: WORKER_PHONE }).returning();
  await db.insert(workerProfiles).values({ userId: worker.id, fullName: 'Ana Souza', kycStatus: 'approved' });
  return { job, worker };
}

describe('createQuestion', () => {
  afterEach(async () => {
    const owner = await db.query.users.findFirst({ where: eq(users.phone, OWNER_PHONE) });
    if (owner) {
      const [company] = await db.query.companies.findMany({ where: eq(companies.ownerUserId, owner.id) });
      if (company) {
        const companyJobs = await db.query.jobs.findMany({ where: eq(jobs.companyId, company.id) });
        for (const job of companyJobs) {
          await db.delete(jobQuestions).where(eq(jobQuestions.jobId, job.id));
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

  it('rejeita vaga inexistente', async () => {
    const { worker } = await setup();
    await expect(
      createQuestion(worker.id, '00000000-0000-0000-0000-000000000000', 'Pergunta qualquer'),
    ).rejects.toThrow('Vaga não encontrada');
  });

  it('rejeita quem não se candidatou', async () => {
    const { job } = await setup();
    const [outsider] = await db.insert(users).values({ phone: OUTSIDER_PHONE }).returning();

    await expect(createQuestion(outsider.id, job.id, 'Tem vestiário no local?')).rejects.toThrow(
      'precisa ter se candidatado',
    );
  });

  it('rejeita pergunta vazia', async () => {
    const { job, worker } = await setup();
    await db.insert(applications).values({ jobId: job.id, workerId: worker.id });

    await expect(createQuestion(worker.id, job.id, '   ')).rejects.toThrow('Escreva a pergunta');
  });

  it('rejeita pergunta com telefone', async () => {
    const { job, worker } = await setup();
    await db.insert(applications).values({ jobId: job.id, workerId: worker.id });

    await expect(createQuestion(worker.id, job.id, 'me chama no 11912345678')).rejects.toThrow(
      'Não é permitido compartilhar telefone',
    );
  });

  it('cria a pergunta quando o inscrito é válido', async () => {
    const { job, worker } = await setup();
    await db.insert(applications).values({ jobId: job.id, workerId: worker.id });

    const result = await createQuestion(worker.id, job.id, 'Tem vestiário no local?');

    expect(result.question).toBe('Tem vestiário no local?');
    expect(result.answer).toBeNull();
    expect(result.worker.fullName).toBe('Ana Souza');
  });
});
