import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { updateApplicationStatus } from '../applications/update-application-status';
import { db } from '../../db/client';
import {
  applications,
  companies,
  jobs,
  payments,
  ratings,
  shifts,
  skillCategories,
  users,
  workerProfiles,
} from '../../db/schema';
import { createApplication } from '../applications/create-application';
import { checkIn } from '../shifts/check-in';
import { checkOut } from '../shifts/check-out';
import { chargeForShift } from '../payments/charge-for-shift';
import { PaymentGateway } from '../payments/payment-gateway';
import { deleteDemoData } from './demo-data';

// Fixtures únicas entre arquivos de teste (ver README).
const WORKER_PHONE = '+5511966660060';
const DEMO_OWNER_PHONE = '+5511966660061';
const REAL_OWNER_PHONE = '+5511966660062';
const DEMO_CNPJ = '11222333000297';
const REAL_CNPJ = '11222333000304';
const TEST_CATEGORY_NAME = 'Categoria de teste — demo data';

const TOMORROW = new Date(Date.now() + 24 * 60 * 60 * 1000);
const TOMORROW_PLUS_5H = new Date(TOMORROW.getTime() + 5 * 60 * 60 * 1000);

const GATEWAY: PaymentGateway = {
  charge: async () => ({ pspChargeId: 'psp_demo' }),
  release: async () => {},
};

async function cleanupCompanyTree(ownerPhone: string): Promise<void> {
  const owner = await db.query.users.findFirst({ where: eq(users.phone, ownerPhone) });
  if (!owner) return;
  const [company] = await db.query.companies.findMany({ where: eq(companies.ownerUserId, owner.id) });
  if (company) {
    const companyJobs = await db.query.jobs.findMany({ where: eq(jobs.companyId, company.id) });
    for (const job of companyJobs) {
      const jobShifts = await db.query.shifts.findMany({ where: eq(shifts.jobId, job.id) });
      for (const shift of jobShifts) {
        await db.delete(ratings).where(eq(ratings.shiftId, shift.id));
        await db.delete(payments).where(eq(payments.shiftId, shift.id));
      }
      await db.delete(shifts).where(eq(shifts.jobId, job.id));
      await db.delete(applications).where(eq(applications.jobId, job.id));
    }
    await db.delete(jobs).where(eq(jobs.companyId, company.id));
    await db.delete(companies).where(eq(companies.id, company.id));
  }
  await db.delete(users).where(eq(users.id, owner.id));
}

describe('deleteDemoData', () => {
  afterEach(async () => {
    await cleanupCompanyTree(DEMO_OWNER_PHONE);
    await cleanupCompanyTree(REAL_OWNER_PHONE);
    await db.delete(users).where(eq(users.phone, WORKER_PHONE));
    await db.delete(skillCategories).where(eq(skillCategories.name, TEST_CATEGORY_NAME));
  });

  it('não mexe em nada quando não há empresa de demonstração', async () => {
    const result = await deleteDemoData();

    expect(result.companiesRemoved).toBe(0);
  });

  it('remove empresa demo com turno completo (candidatura, turno, pagamento, avaliação) e preserva empresa real', async () => {
    const [worker] = await db.insert(users).values({ phone: WORKER_PHONE }).returning();
    await db.insert(workerProfiles).values({ kycStatus: 'approved', userId: worker.id, fullName: 'Ana Souza' });
    const [category] = await db.insert(skillCategories).values({ name: TEST_CATEGORY_NAME }).returning();

    const [demoOwner] = await db.insert(users).values({ phone: DEMO_OWNER_PHONE }).returning();
    const [demoCompany] = await db
      .insert(companies)
      .values({
        ownerUserId: demoOwner.id,
        legalName: 'Bar Demo Ltda',
        tradeName: 'Bar Demo',
        cnpj: DEMO_CNPJ,
        isDemo: true,
      })
      .returning();
    const [demoJob] = await db
      .insert(jobs)
      .values({
        companyId: demoCompany.id,
        categoryId: category.id,
        description: 'Vaga demo com descrição detalhada o suficiente.',
        addressLabel: 'Endereço demo',
        locationLat: -23.55,
        locationLng: -46.63,
        positionsTotal: 1,
        payAmount: '130.00',
        startsAt: TOMORROW,
        endsAt: TOMORROW_PLUS_5H,
      })
      .returning();
    const application = await createApplication(worker.id, demoJob.id);
    await updateApplicationStatus(demoOwner.id, application.id, 'approved');
    const shift = await db.query.shifts.findFirst({ where: eq(shifts.applicationId, application.id) });
    if (!shift) throw new Error('Turno não foi criado no setup do teste.');
    await checkIn(worker.id, shift.id, { lat: -23.55, lng: -46.63 });
    const completed = await checkOut(worker.id, shift.id, { lat: -23.55, lng: -46.63 });
    await chargeForShift(GATEWAY, completed.id, completed.payAmountSnapshot);
    await db.insert(ratings).values({ shiftId: shift.id, raterRole: 'worker', score: 5, comment: null });

    const [realOwner] = await db.insert(users).values({ phone: REAL_OWNER_PHONE }).returning();
    const [realCompany] = await db
      .insert(companies)
      .values({
        ownerUserId: realOwner.id,
        legalName: 'Bar Real Ltda',
        tradeName: 'Bar Real',
        cnpj: REAL_CNPJ,
        isDemo: false,
      })
      .returning();

    const result = await deleteDemoData();

    expect(result.companiesRemoved).toBe(1);
    expect(await db.query.companies.findFirst({ where: eq(companies.id, demoCompany.id) })).toBeUndefined();
    expect(await db.query.users.findFirst({ where: eq(users.id, demoOwner.id) })).toBeUndefined();
    expect(await db.query.jobs.findFirst({ where: eq(jobs.id, demoJob.id) })).toBeUndefined();
    expect(await db.query.shifts.findFirst({ where: eq(shifts.id, shift.id) })).toBeUndefined();

    expect(await db.query.companies.findFirst({ where: eq(companies.id, realCompany.id) })).toBeDefined();
    expect(await db.query.users.findFirst({ where: eq(users.id, realOwner.id) })).toBeDefined();
  });
});
