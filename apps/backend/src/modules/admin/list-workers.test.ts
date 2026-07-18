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
import { listAdminWorkers } from './list-workers';

const SUCCESS_GATEWAY: PaymentGateway = {
  charge: async () => ({ pspChargeId: 'psp_list-workers' }),
  release: async () => {},
};

const WORKER_PHONE = '+5511966661070';
const WORKER_EMAIL = 'list-workers-worker@example.com';
const OWNER_PHONE = '+5511966661071';
const TEST_CNPJ = '11222333000422';
const TEST_CATEGORY_NAME = 'Categoria de teste — list-workers';

const TOMORROW = new Date(Date.now() + 24 * 60 * 60 * 1000);
const TOMORROW_PLUS_5H = new Date(TOMORROW.getTime() + 5 * 60 * 60 * 1000);

describe('listAdminWorkers', () => {
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

  it('inclui o trabalhador com turnos concluídos e horas trabalhadas', async () => {
    const [worker] = await db.insert(users).values({ phone: WORKER_PHONE, email: WORKER_EMAIL }).returning();
    await db.insert(workerProfiles).values({
      userId: worker.id,
      fullName: 'Camila Souza',
      kycStatus: 'approved',
      photoUrl: '/uploads/public/camila.jpg',
      phone: '11912345678',
    });
    const [owner] = await db.insert(users).values({ phone: OWNER_PHONE }).returning();
    const [company] = await db
      .insert(companies)
      .values({
        ownerUserId: owner.id,
        legalName: 'Espaço de Eventos Gama Ltda',
        tradeName: 'Espaço Gama',
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
    const application = await createApplication(worker.id, job.id, true);
    await updateApplicationStatus(owner.id, application.id, 'approved');
    const shift = await db.query.shifts.findFirst({ where: eq(shifts.applicationId, application.id) });
    if (!shift) throw new Error('Turno não foi criado no setup do teste.');
    await checkIn(worker.id, shift.id);
    await checkOut(worker.id, shift.id);
    await confirmCheckOut(SUCCESS_GATEWAY, owner.id, shift.id);
    // Sobrescreve os horários reais (quase instantâneos no teste) por um
    // intervalo de 3h exatas — mesma técnica de get-worker-profile.test.ts,
    // pra conferir o valor certo em vez de só "não é negativo".
    const checkInTime = new Date();
    const checkOutTime = new Date(checkInTime.getTime() + 3 * 60 * 60 * 1000);
    await db.update(shifts).set({ checkInAt: checkInTime, checkOutAt: checkOutTime }).where(eq(shifts.id, shift.id));

    const result = await listAdminWorkers();

    const found = result.find((row) => row.userId === worker.id);
    expect(found).toBeDefined();
    expect(found?.email).toBe(WORKER_EMAIL);
    expect(found?.photoUrl).toBe('/uploads/public/camila.jpg');
    expect(found?.phone).toBe('11912345678');
    expect(found?.shiftsCompleted).toBe(1);
    expect(found?.hoursWorked).toBe(3);
  });

  it('não conta horas de turno ainda em andamento (checked_in sem check-out)', async () => {
    const [worker] = await db.insert(users).values({ phone: WORKER_PHONE, email: WORKER_EMAIL }).returning();
    await db.insert(workerProfiles).values({ userId: worker.id, fullName: 'Camila Souza', kycStatus: 'approved' });
    const [owner] = await db.insert(users).values({ phone: OWNER_PHONE }).returning();
    const [company] = await db
      .insert(companies)
      .values({
        ownerUserId: owner.id,
        legalName: 'Espaço de Eventos Gama Ltda',
        tradeName: 'Espaço Gama',
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
    const application = await createApplication(worker.id, job.id, true);
    await updateApplicationStatus(owner.id, application.id, 'approved');
    const shift = await db.query.shifts.findFirst({ where: eq(shifts.applicationId, application.id) });
    if (!shift) throw new Error('Turno não foi criado no setup do teste.');
    await checkIn(worker.id, shift.id);

    const result = await listAdminWorkers();

    const found = result.find((row) => row.userId === worker.id);
    expect(found?.shiftsCompleted).toBe(0);
    expect(found?.hoursWorked).toBe(0);
  });
});
