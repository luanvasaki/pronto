import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../../db/client';
import { applications, companies, jobs, payments, shifts, skillCategories, users, workerProfiles } from '../../db/schema';
import { createApplication } from '../applications/create-application';
import { updateApplicationStatus } from '../applications/update-application-status';
import { PaymentGateway } from '../payments/payment-gateway';
import { chargeForShift } from '../payments/charge-for-shift';
import { checkIn } from '../shifts/check-in';
import { checkOut } from '../shifts/check-out';
import { getAdminMetrics } from './get-metrics';

// Fixtures únicas entre arquivos de teste (ver README).
const WORKER_PHONE = '+5511966660050';
const OWNER_PHONE = '+5511966660051';
const TEST_CNPJ = '11112223340340';
const TEST_CATEGORY_NAME = 'Categoria de teste — get-metrics';
const PAY_AMOUNT = '150.00';

const TOMORROW = new Date(Date.now() + 24 * 60 * 60 * 1000);
const TOMORROW_PLUS_5H = new Date(TOMORROW.getTime() + 5 * 60 * 60 * 1000);

const SUCCESS_GATEWAY: PaymentGateway = {
  charge: async () => ({ pspChargeId: 'psp_metrics_test' }),
  release: async () => {},
};

describe('getAdminMetrics', () => {
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

  it('reflete um turno concluído e pago no delta das métricas', async () => {
    const before = await getAdminMetrics();

    const [worker] = await db.insert(users).values({ phone: WORKER_PHONE }).returning();
    await db.insert(workerProfiles).values({ userId: worker.id, fullName: 'Beatriz Lima', kycStatus: 'approved' });
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
        payAmount: PAY_AMOUNT,
        startsAt: TOMORROW,
        endsAt: TOMORROW_PLUS_5H,
      })
      .returning();
    const application = await createApplication(worker.id, job.id, true);
    await updateApplicationStatus(owner.id, application.id, 'approved');
    const shift = await db.query.shifts.findFirst({ where: eq(shifts.applicationId, application.id) });
    if (!shift) throw new Error('Turno não foi criado no setup do teste.');
    await checkIn(worker.id, shift.id, { lat: -23.55, lng: -46.63 });
    const completed = await checkOut(worker.id, shift.id, { lat: -23.55, lng: -46.63 });
    await chargeForShift(SUCCESS_GATEWAY, completed.id, completed.payAmountSnapshot);

    const after = await getAdminMetrics();

    // >= em vez de === de propósito: essas são métricas globais (sem
    // filtro por dado do teste), e o Vitest roda os arquivos em paralelo
    // contra o mesmo banco — outro arquivo pode inserir/apagar sua
    // própria linha entre o "before" e o "after". O que garantimos aqui
    // é que a linha desse teste entrou na conta, não o valor exato.
    expect(after.workers.total).toBeGreaterThanOrEqual(before.workers.total + 1);
    expect(after.workers.verified).toBeGreaterThanOrEqual(before.workers.verified + 1);
    expect(after.workers.active).toBeGreaterThanOrEqual(before.workers.active + 1);
    expect(after.companies.total).toBeGreaterThanOrEqual(before.companies.total + 1);
    expect(after.companies.verified).toBeGreaterThanOrEqual(before.companies.verified + 1);
    expect(after.companies.jobsPosted).toBeGreaterThanOrEqual(before.companies.jobsPosted + 1);
    expect(after.shifts.completed).toBeGreaterThanOrEqual(before.shifts.completed + 1);
    expect(after.payments.countByStatus.charged).toBeGreaterThanOrEqual(before.payments.countByStatus.charged + 1);
    expect(Number(after.payments.totalProcessed)).toBeGreaterThanOrEqual(
      Number(before.payments.totalProcessed) + Number(PAY_AMOUNT) - 0.01,
    );
  });
});
