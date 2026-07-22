import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../../db/client';
import { applications, companies, jobs, payments, shifts, skillCategories, users, workerProfiles } from '../../db/schema';
import { createApplication } from '../applications/create-application';

const CONSENT = { termsAccepted: true, minorsTermsAccepted: undefined, ipAddress: null, userAgent: null } as const;
import { updateApplicationStatus } from '../applications/update-application-status';
import { PaymentGateway } from '../payments/payment-gateway';
import { checkIn } from '../shifts/check-in';
import { checkOut } from '../shifts/check-out';
import { confirmCheckOut } from '../shifts/confirm-check-out';
import { getAdminGrowthMetrics } from './get-growth-metrics';

const SUCCESS_GATEWAY: PaymentGateway = {
  charge: async () => ({ pspChargeId: 'psp_get-growth-metrics' }),
  release: async () => {},
};

// Fixtures únicas entre arquivos de teste (ver README).
const WORKER_PHONE = '+5511966662200';
const OWNER_PHONE = '+5511966662201';
const TEST_CNPJ = '11222333002200';
const TEST_CATEGORY_NAME = 'Categoria de teste — get-growth-metrics';

const TOMORROW = new Date(Date.now() + 24 * 60 * 60 * 1000);
const TOMORROW_PLUS_5H = new Date(TOMORROW.getTime() + 5 * 60 * 60 * 1000);

describe('getAdminGrowthMetrics', () => {
  afterEach(async () => {
    const owner = await db.query.users.findFirst({ where: eq(users.phone, OWNER_PHONE) });
    if (owner) {
      const [company] = await db.query.companies.findMany({ where: eq(companies.ownerUserId, owner.id) });
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
      }
      await db.delete(companies).where(eq(companies.ownerUserId, owner.id));
    }
    await db.delete(users).where(eq(users.phone, WORKER_PHONE));
    await db.delete(users).where(eq(users.phone, OWNER_PHONE));
    await db.delete(skillCategories).where(eq(skillCategories.name, TEST_CATEGORY_NAME));
  });

  it('retorna 8 semanas, mais antiga primeiro, com semanas vazias zeradas', async () => {
    const metrics = await getAdminGrowthMetrics();

    expect(metrics.companies).toHaveLength(8);
    expect(metrics.workers).toHaveLength(8);
    expect(metrics.dealsClosed).toHaveLength(8);
    const weekStarts = metrics.companies.map((w) => w.weekStart);
    expect(weekStarts).toEqual([...weekStarts].sort());
    for (const week of [...metrics.companies, ...metrics.workers, ...metrics.dealsClosed]) {
      expect(typeof week.count).toBe('number');
      expect(Number.isInteger(week.count)).toBe(true);
      expect(week.count).toBeGreaterThanOrEqual(0);
    }
  });

  it('conta empresa, trabalhador e escala concluída criados agora na semana atual', async () => {
    const before = await getAdminGrowthMetrics();
    const currentWeek = before.companies[before.companies.length - 1].weekStart;
    const beforeCompanyCount = before.companies[before.companies.length - 1].count;
    const beforeWorkerCount = before.workers[before.workers.length - 1].count;
    const beforeDealsCount = before.dealsClosed[before.dealsClosed.length - 1].count;

    const [worker] = await db.insert(users).values({ phone: WORKER_PHONE }).returning();
    await db.insert(workerProfiles).values({ userId: worker.id, fullName: 'Camila Souza', kycStatus: 'approved' });
    const [owner] = await db.insert(users).values({ phone: OWNER_PHONE }).returning();
    const [company] = await db
      .insert(companies)
      .values({
        ownerUserId: owner.id,
        legalName: 'Espaço de Eventos Beta Ltda',
        tradeName: 'Espaço Beta',
        cnpj: TEST_CNPJ,
        verificationStatus: 'approved',
      })
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
        positionsTotal: 1,
        payAmount: '150.00',
        startsAt: TOMORROW,
        endsAt: TOMORROW_PLUS_5H,
      })
      .returning();
    const application = await createApplication(worker.id, job.id, CONSENT);
    await updateApplicationStatus(owner.id, application.id, 'approved');
    const shift = await db.query.shifts.findFirst({ where: eq(shifts.applicationId, application.id) });
    if (!shift) throw new Error('Turno não foi criado no setup do teste.');
    await checkIn(worker.id, shift.id);
    await checkOut(worker.id, shift.id);
    await confirmCheckOut(SUCCESS_GATEWAY, owner.id, shift.id);

    const after = await getAdminGrowthMetrics();

    expect(after.companies[after.companies.length - 1].weekStart).toBe(currentWeek);
    expect(after.companies[after.companies.length - 1].count).toBeGreaterThanOrEqual(beforeCompanyCount + 1);
    expect(after.workers[after.workers.length - 1].count).toBeGreaterThanOrEqual(beforeWorkerCount + 1);
    expect(after.dealsClosed[after.dealsClosed.length - 1].count).toBeGreaterThanOrEqual(beforeDealsCount + 1);
  });
});
