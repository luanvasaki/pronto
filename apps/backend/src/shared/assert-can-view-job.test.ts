import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { assertCanViewJob } from './assert-can-view-job';
import { db } from '../db/client';
import { applications, companies, jobs, skillCategories, users, workerProfiles } from '../db/schema';

const OWNER_PHONE = '+5511966660097';
const APPLICANT_PHONE = '+5511966660098';
const OUTSIDER_PHONE = '+5511966660099';
const TEST_CNPJ = '11222333000299';
const TEST_CATEGORY_NAME = 'Categoria de teste — assert-can-view-job';

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

describe('assertCanViewJob', () => {
  afterEach(async () => {
    const owner = await db.query.users.findFirst({ where: eq(users.phone, OWNER_PHONE) });
    if (owner) {
      const [company] = await db.query.companies.findMany({ where: eq(companies.ownerUserId, owner.id) });
      if (company) {
        const companyJobs = await db.query.jobs.findMany({ where: eq(jobs.companyId, company.id) });
        for (const job of companyJobs) {
          await db.delete(applications).where(eq(applications.jobId, job.id));
        }
        await db.delete(jobs).where(eq(jobs.companyId, company.id));
      }
    }
    await db.delete(users).where(eq(users.phone, APPLICANT_PHONE));
    await db.delete(users).where(eq(users.phone, OUTSIDER_PHONE));
    await db.delete(users).where(eq(users.phone, OWNER_PHONE));
    await db.delete(skillCategories).where(eq(skillCategories.name, TEST_CATEGORY_NAME));
  });

  it('não lança nada pro dono da empresa', async () => {
    const { owner, job } = await setup();
    await expect(assertCanViewJob(owner.id, job.id, job.companyId)).resolves.toBeUndefined();
  });

  it('não lança nada pra quem tem candidatura (mesmo rejeitada)', async () => {
    const { job } = await setup();
    const [applicant] = await db.insert(users).values({ phone: APPLICANT_PHONE }).returning();
    await db.insert(workerProfiles).values({ userId: applicant.id, fullName: 'Ana Souza', kycStatus: 'approved' });
    await db.insert(applications).values({ jobId: job.id, workerId: applicant.id, status: 'rejected' });

    await expect(assertCanViewJob(applicant.id, job.id, job.companyId)).resolves.toBeUndefined();
  });

  it('lança pra quem não é dono nem tem candidatura', async () => {
    const { job } = await setup();
    const [outsider] = await db.insert(users).values({ phone: OUTSIDER_PHONE }).returning();

    await expect(assertCanViewJob(outsider.id, job.id, job.companyId)).rejects.toThrow('não tem acesso');
  });
});
