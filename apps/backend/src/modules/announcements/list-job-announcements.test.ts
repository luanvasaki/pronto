import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../../db/client';
import { applications, companies, jobAnnouncements, jobs, skillCategories, users, workerProfiles } from '../../db/schema';
import { listJobAnnouncements } from './list-job-announcements';

const OWNER_PHONE = '+5511966660022';
const WORKER_PHONE = '+5511966660023';
const OUTSIDER_PHONE = '+5511966660024';
const TEST_CNPJ = '11222333000200';
const TEST_CATEGORY_NAME = 'Categoria de teste — list-job-announcements';

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
  const now = new Date();
  await db.insert(jobAnnouncements).values([
    { jobId: job.id, message: 'Primeiro aviso', createdAt: new Date(now.getTime() - 1000) },
    { jobId: job.id, message: 'Segundo aviso', createdAt: now },
  ]);
  return { owner, job };
}

describe('listJobAnnouncements', () => {
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
    await db.delete(users).where(eq(users.phone, OUTSIDER_PHONE));
    await db.delete(users).where(eq(users.phone, OWNER_PHONE));
    await db.delete(skillCategories).where(eq(skillCategories.name, TEST_CATEGORY_NAME));
  });

  it('rejeita vaga inexistente', async () => {
    const { owner } = await setup();
    await expect(
      listJobAnnouncements(owner.id, '00000000-0000-0000-0000-000000000000'),
    ).rejects.toThrow('Vaga não encontrada');
  });

  it('deixa o dono da empresa ver os avisos', async () => {
    const { owner, job } = await setup();
    const result = await listJobAnnouncements(owner.id, job.id);
    expect(result).toHaveLength(2);
  });

  it('deixa um inscrito (mesmo rejeitado) ver os avisos', async () => {
    const { job } = await setup();
    const [worker] = await db.insert(users).values({ phone: WORKER_PHONE }).returning();
    await db.insert(workerProfiles).values({ userId: worker.id, fullName: 'Ana Souza', kycStatus: 'approved' });
    await db.insert(applications).values({ jobId: job.id, workerId: worker.id, status: 'rejected' });

    const result = await listJobAnnouncements(worker.id, job.id);
    expect(result).toHaveLength(2);
  });

  it('rejeita quem não é dono nem inscrito', async () => {
    const { job } = await setup();
    const [outsider] = await db.insert(users).values({ phone: OUTSIDER_PHONE }).returning();

    await expect(listJobAnnouncements(outsider.id, job.id)).rejects.toThrow('Você não tem acesso');
  });

  it('ordena do mais recente pro mais antigo', async () => {
    const { owner, job } = await setup();
    const result = await listJobAnnouncements(owner.id, job.id);
    expect(result[0].message).toBe('Segundo aviso');
    expect(result[1].message).toBe('Primeiro aviso');
  });
});
