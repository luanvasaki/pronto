import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../../db/client';
import { applications, companies, jobs, payments, shifts, skillCategories, users, workerProfiles } from '../../db/schema';
import { createApplication } from '../applications/create-application';
import { updateApplicationStatus } from '../applications/update-application-status';
import { PaymentGateway } from '../payments/payment-gateway';
import { checkIn } from '../shifts/check-in';
import { checkOut } from '../shifts/check-out';
import { confirmCheckOut } from '../shifts/confirm-check-out';
import { getCompanyGrowthMetrics } from './get-company-growth-metrics';

const SUCCESS_GATEWAY: PaymentGateway = {
  charge: async () => ({ pspChargeId: 'psp_get-company-growth-metrics' }),
  release: async () => {},
};

// Fixtures únicas entre arquivos de teste (ver README).
const WORKER_PHONE = '+5511966663300';
const OWNER_PHONE = '+5511966663301';
const OTHER_OWNER_PHONE = '+5511966663302';
const TEST_CNPJ = '11222333003300';
const OTHER_CNPJ = '11222333003301';
const TEST_CATEGORY_NAME = 'Categoria de teste — get-company-growth-metrics';

const TOMORROW = new Date(Date.now() + 24 * 60 * 60 * 1000);
const TOMORROW_PLUS_5H = new Date(TOMORROW.getTime() + 5 * 60 * 60 * 1000);

async function cleanupCompanyByOwnerPhone(phone: string): Promise<void> {
  const owner = await db.query.users.findFirst({ where: eq(users.phone, phone) });
  if (!owner) return;

  const company = await db.query.companies.findFirst({ where: eq(companies.ownerUserId, owner.id) });
  if (company) {
    const companyJobs = await db.query.jobs.findMany({ where: eq(jobs.companyId, company.id) });
    for (const job of companyJobs) {
      const jobShifts = await db.query.shifts.findMany({ where: eq(shifts.jobId, job.id) });
      for (const shift of jobShifts) {
        await db.delete(payments).where(eq(payments.shiftId, shift.id));
      }
      await db.delete(shifts).where(eq(shifts.jobId, job.id));
      await db.delete(applications).where(eq(applications.jobId, job.id));
    }
    await db.delete(jobs).where(eq(jobs.companyId, company.id));
    await db.delete(companies).where(eq(companies.ownerUserId, owner.id));
  }
  await db.delete(users).where(eq(users.phone, phone));
}

describe('getCompanyGrowthMetrics', () => {
  afterEach(async () => {
    await cleanupCompanyByOwnerPhone(OWNER_PHONE);
    await cleanupCompanyByOwnerPhone(OTHER_OWNER_PHONE);
    await db.delete(users).where(eq(users.phone, WORKER_PHONE));
    await db.delete(skillCategories).where(eq(skillCategories.name, TEST_CATEGORY_NAME));
  });

  it('rejeita quando a empresa ainda não existe', async () => {
    const [owner] = await db.insert(users).values({ phone: OWNER_PHONE }).returning();

    await expect(getCompanyGrowthMetrics(owner.id)).rejects.toThrow('Complete o cadastro da empresa');
  });

  it('retorna 8 semanas, mais antiga primeiro, com semanas vazias zeradas', async () => {
    const [owner] = await db.insert(users).values({ phone: OWNER_PHONE }).returning();
    await db.insert(companies).values({
      ownerUserId: owner.id,
      legalName: 'Espaço de Eventos Alfa Ltda',
      tradeName: 'Espaço Alfa',
      cnpj: TEST_CNPJ,
      verificationStatus: 'approved',
    });

    const metrics = await getCompanyGrowthMetrics(owner.id);

    expect(metrics.jobsPosted).toHaveLength(8);
    expect(metrics.workersHired).toHaveLength(8);
    expect(metrics.shiftsCompleted).toHaveLength(8);
    const weekStarts = metrics.jobsPosted.map((w) => w.weekStart);
    expect(weekStarts).toEqual([...weekStarts].sort());
    for (const week of [...metrics.jobsPosted, ...metrics.workersHired, ...metrics.shiftsCompleted]) {
      expect(typeof week.count).toBe('number');
      expect(Number.isInteger(week.count)).toBe(true);
      expect(week.count).toBeGreaterThanOrEqual(0);
    }
  });

  it('conta vaga publicada, trabalhador contratado e escala concluída só da empresa dona', async () => {
    const [worker] = await db.insert(users).values({ phone: WORKER_PHONE }).returning();
    await db.insert(workerProfiles).values({ userId: worker.id, fullName: 'Camila Souza', kycStatus: 'approved' });
    const [owner] = await db.insert(users).values({ phone: OWNER_PHONE }).returning();
    const [company] = await db
      .insert(companies)
      .values({
        ownerUserId: owner.id,
        legalName: 'Espaço de Eventos Alfa Ltda',
        tradeName: 'Espaço Alfa',
        cnpj: TEST_CNPJ,
        verificationStatus: 'approved',
      })
      .returning();

    const [otherOwner] = await db.insert(users).values({ phone: OTHER_OWNER_PHONE }).returning();
    await db.insert(companies).values({
      ownerUserId: otherOwner.id,
      legalName: 'Espaço de Eventos Beta Ltda',
      tradeName: 'Espaço Beta',
      cnpj: OTHER_CNPJ,
      verificationStatus: 'approved',
    });

    const [category] = await db.insert(skillCategories).values({ name: TEST_CATEGORY_NAME }).returning();

    const before = await getCompanyGrowthMetrics(owner.id);
    const beforeOtherCompany = await getCompanyGrowthMetrics(otherOwner.id);
    const beforeJobsPosted = before.jobsPosted[before.jobsPosted.length - 1].count;
    const beforeWorkersHired = before.workersHired[before.workersHired.length - 1].count;
    const beforeShiftsCompleted = before.shiftsCompleted[before.shiftsCompleted.length - 1].count;
    const beforeOtherJobsPosted = beforeOtherCompany.jobsPosted[beforeOtherCompany.jobsPosted.length - 1].count;

    const [job] = await db
      .insert(jobs)
      .values({
        companyId: company.id,
        categoryId: category.id,
        description: 'Vaga de teste com descrição detalhada o suficiente.',
        addressLabel: 'Endereço de teste',
        locationLat: -23.55,
        locationLng: -46.63,
        positionsTotal: 1,
        payAmount: '150.00',
        startsAt: TOMORROW,
        endsAt: TOMORROW_PLUS_5H,
      })
      .returning();
    const application = await createApplication(worker.id, job.id, true);
    await updateApplicationStatus(owner.id, application.id, 'approved');
    const shift = await db.query.shifts.findFirst({ where: eq(shifts.applicationId, application.id) });
    if (!shift) throw new Error('Turno não foi criado no setup do teste.');
    await checkIn(worker.id, shift.id);
    await checkOut(worker.id, shift.id);
    await confirmCheckOut(SUCCESS_GATEWAY, owner.id, shift.id);

    const after = await getCompanyGrowthMetrics(owner.id);
    const afterOtherCompany = await getCompanyGrowthMetrics(otherOwner.id);

    expect(after.jobsPosted[after.jobsPosted.length - 1].count).toBe(beforeJobsPosted + 1);
    expect(after.workersHired[after.workersHired.length - 1].count).toBe(beforeWorkersHired + 1);
    expect(after.shiftsCompleted[after.shiftsCompleted.length - 1].count).toBe(beforeShiftsCompleted + 1);
    // A outra empresa não teve nenhuma vaga/turno criado — suas métricas ficam intocadas.
    expect(afterOtherCompany.jobsPosted[afterOtherCompany.jobsPosted.length - 1].count).toBe(beforeOtherJobsPosted);
  });
});
