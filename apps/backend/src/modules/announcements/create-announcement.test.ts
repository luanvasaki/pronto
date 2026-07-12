import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../../db/client';
import { applications, companies, jobAnnouncements, jobs, skillCategories, users } from '../../db/schema';
import { createAnnouncement } from './create-announcement';

const OWNER_PHONE = '+5511966660020';
const WORKER_PHONE = '+5511966660021';
const TEST_CNPJ = '11222333000199';
const TEST_CATEGORY_NAME = 'Categoria de teste — create-announcement';

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

describe('createAnnouncement', () => {
  afterEach(async () => {
    const owner = await db.query.users.findFirst({ where: eq(users.phone, OWNER_PHONE) });
    if (owner) {
      const [company] = await db.query.companies.findMany({ where: eq(companies.ownerUserId, owner.id) });
      if (company) {
        const companyJobs = await db.query.jobs.findMany({ where: eq(jobs.companyId, company.id) });
        for (const job of companyJobs) {
          await db.delete(jobAnnouncements).where(eq(jobAnnouncements.jobId, job.id));
          await db.delete(applications).where(eq(applications.jobId, job.id));
        }
        await db.delete(jobs).where(eq(jobs.companyId, company.id));
      }
    }
    await db.delete(users).where(eq(users.phone, WORKER_PHONE));
    await db.delete(users).where(eq(users.phone, OWNER_PHONE));
    await db.delete(skillCategories).where(eq(skillCategories.name, TEST_CATEGORY_NAME));
  });

  it('rejeita vaga inexistente', async () => {
    const { owner } = await setup();
    await expect(
      createAnnouncement(owner.id, '00000000-0000-0000-0000-000000000000', 'Aviso qualquer'),
    ).rejects.toThrow('Vaga não encontrada');
  });

  it('rejeita quem não é dono da empresa', async () => {
    const { job } = await setup();
    const [outsider] = await db.insert(users).values({ phone: WORKER_PHONE }).returning();

    await expect(createAnnouncement(outsider.id, job.id, 'Aviso qualquer')).rejects.toThrow(
      'Você não tem acesso',
    );
  });

  it('rejeita mensagem vazia', async () => {
    const { owner, job } = await setup();
    await expect(createAnnouncement(owner.id, job.id, '   ')).rejects.toThrow('Escreva o aviso');
  });

  it('rejeita mensagem com telefone', async () => {
    const { owner, job } = await setup();
    await expect(createAnnouncement(owner.id, job.id, 'me chama no 11 91234-5678')).rejects.toThrow(
      'Não é permitido compartilhar telefone',
    );
  });

  it('publica o aviso mesmo com a vaga preenchida', async () => {
    const { owner, job } = await setup();
    await db.update(jobs).set({ status: 'filled' }).where(eq(jobs.id, job.id));

    const result = await createAnnouncement(owner.id, job.id, 'Chegar 15 minutos antes, por favor.');

    expect(result.message).toBe('Chegar 15 minutos antes, por favor.');
    expect(result.jobId).toBe(job.id);
  });
});
