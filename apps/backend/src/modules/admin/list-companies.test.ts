import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../../db/client';
import { applications, companies, jobs, shifts, skillCategories, users, workerProfiles } from '../../db/schema';
import { createApplication } from '../applications/create-application';
import { updateApplicationStatus } from '../applications/update-application-status';
import { checkIn } from '../shifts/check-in';
import { checkOut } from '../shifts/check-out';
import { listAdminCompanies } from './list-companies';

const WORKER_PHONE = '+5511966661060';
const OWNER_PHONE = '+5511966661061';
const OWNER_EMAIL = 'list-companies-owner@example.com';
const TEST_CNPJ = '11222333000411';
const TEST_CATEGORY_NAME = 'Categoria de teste — list-companies';

const TOMORROW = new Date(Date.now() + 24 * 60 * 60 * 1000);
const TOMORROW_PLUS_5H = new Date(TOMORROW.getTime() + 5 * 60 * 60 * 1000);

describe('listAdminCompanies', () => {
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
      await db.delete(companies).where(eq(companies.ownerUserId, owner.id));
    }
    await db.delete(users).where(eq(users.phone, WORKER_PHONE));
    await db.delete(users).where(eq(users.phone, OWNER_PHONE));
    await db.delete(skillCategories).where(eq(skillCategories.name, TEST_CATEGORY_NAME));
  });

  it('inclui a empresa com o total de turnos concluídos e o e-mail do dono', async () => {
    const [worker] = await db.insert(users).values({ phone: WORKER_PHONE }).returning();
    await db.insert(workerProfiles).values({ userId: worker.id, fullName: 'Débora Nunes', kycStatus: 'approved' });
    const [owner] = await db.insert(users).values({ phone: OWNER_PHONE, email: OWNER_EMAIL }).returning();
    const [company] = await db
      .insert(companies)
      .values({
        ownerUserId: owner.id,
        legalName: 'Espaço de Eventos Beta Ltda',
        tradeName: 'Espaço Beta',
        cnpj: TEST_CNPJ,
        logoUrl: '/uploads/public/beta-logo.jpg',
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
    const application = await createApplication(worker.id, job.id);
    await updateApplicationStatus(owner.id, application.id, 'approved');
    const shift = await db.query.shifts.findFirst({ where: eq(shifts.applicationId, application.id) });
    if (!shift) throw new Error('Turno não foi criado no setup do teste.');
    await checkIn(worker.id, shift.id, { lat: -23.55, lng: -46.63 });
    await checkOut(worker.id, shift.id, { lat: -23.55, lng: -46.63 });

    const result = await listAdminCompanies();

    const found = result.find((row) => row.id === company.id);
    expect(found).toBeDefined();
    expect(found?.ownerEmail).toBe(OWNER_EMAIL);
    expect(found?.logoUrl).toBe('/uploads/public/beta-logo.jpg');
    expect(found?.jobsPosted).toBeGreaterThanOrEqual(1);
    expect(found?.shiftsCompleted).toBeGreaterThanOrEqual(1);
  });
});
