import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../../db/client';
import { applications, companies, jobQuestions, jobs, skillCategories, users, workerProfiles } from '../../db/schema';
import { answerQuestion } from './answer-question';

const OWNER_PHONE = '+5511966660040';
const WORKER_PHONE = '+5511966660041';
const OUTSIDER_PHONE = '+5511966660042';
const TEST_CNPJ = '11222333000222';
const TEST_CATEGORY_NAME = 'Categoria de teste — answer-question';

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
  await db.insert(applications).values({ jobId: job.id, workerId: worker.id });
  const [question] = await db
    .insert(jobQuestions)
    .values({ jobId: job.id, workerId: worker.id, question: 'Tem vestiário no local?' })
    .returning();
  return { owner, question };
}

describe('answerQuestion', () => {
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

  it('rejeita pergunta inexistente', async () => {
    const { owner } = await setup();
    await expect(
      answerQuestion(owner.id, '00000000-0000-0000-0000-000000000000', 'Sim, temos vestiário.'),
    ).rejects.toThrow('Pergunta não encontrada');
  });

  it('rejeita quem não é dono da empresa', async () => {
    const { question } = await setup();
    const [outsider] = await db.insert(users).values({ phone: OUTSIDER_PHONE }).returning();

    await expect(answerQuestion(outsider.id, question.id, 'Sim, temos vestiário.')).rejects.toThrow(
      'Você não tem acesso',
    );
  });

  it('rejeita resposta vazia', async () => {
    const { owner, question } = await setup();
    await expect(answerQuestion(owner.id, question.id, '   ')).rejects.toThrow('Escreva a resposta');
  });

  it('rejeita resposta com telefone', async () => {
    const { owner, question } = await setup();
    await expect(answerQuestion(owner.id, question.id, 'me chama no 11912345678')).rejects.toThrow(
      'Não é permitido compartilhar telefone',
    );
  });

  it('responde a pergunta e marca answeredAt', async () => {
    const { owner, question } = await setup();
    const before = new Date();

    const result = await answerQuestion(owner.id, question.id, 'Sim, temos vestiário.');

    expect(result.answer).toBe('Sim, temos vestiário.');
    expect(result.answeredAt).not.toBeNull();
    expect(result.answeredAt!.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(result.worker.fullName).toBe('Ana Souza');
  });
});
