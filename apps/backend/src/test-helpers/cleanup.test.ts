import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { updateApplicationStatus } from '../modules/applications/update-application-status';
import { createApplication } from '../modules/applications/create-application';
import { checkIn } from '../modules/shifts/check-in';
import { checkOut } from '../modules/shifts/check-out';
import { chargeForShift } from '../modules/payments/charge-for-shift';
import { db } from '../db/client';
import { applications, companies, jobs, payments, shifts, skillCategories, users, workerProfiles } from '../db/schema';
import { deleteCompanyJobsAndDependents } from './cleanup';

// Fixtures únicas entre arquivos de teste (ver README).
const WORKER_PHONE = '+5511966664100';
const OWNER_PHONE = '+5511966664101';
const TEST_CNPJ = '11222333004100';
const TEST_CATEGORY_NAME = 'Categoria de teste — cleanup helper';

const TOMORROW = new Date(Date.now() + 24 * 60 * 60 * 1000);
const TOMORROW_PLUS_5H = new Date(TOMORROW.getTime() + 5 * 60 * 60 * 1000);

describe('deleteCompanyJobsAndDependents', () => {
  afterEach(async () => {
    await db.delete(users).where(eq(users.phone, WORKER_PHONE));
    await db.delete(users).where(eq(users.phone, OWNER_PHONE));
    await db.delete(skillCategories).where(eq(skillCategories.name, TEST_CATEGORY_NAME));
  });

  it('não faz nada quando o dono não tem empresa', async () => {
    const [owner] = await db.insert(users).values({ phone: OWNER_PHONE }).returning();

    await expect(deleteCompanyJobsAndDependents(owner.id)).resolves.not.toThrow();
  });

  it('apaga pagamento, turno, candidatura e vaga, deixando o usuário livre pra deletar sem violar FK', async () => {
    const [worker] = await db.insert(users).values({ phone: WORKER_PHONE }).returning();
    await db.insert(workerProfiles).values({ kycStatus: 'approved', userId: worker.id, fullName: 'Ana Souza' });
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
    await checkIn(worker.id, shift.id, { lat: -23.55, lng: -46.63 });
    const completed = await checkOut(worker.id, shift.id, { lat: -23.55, lng: -46.63 });
    await chargeForShift(
      { charge: async () => ({ pspChargeId: 'psp_ok' }), release: async () => {} },
      completed.id,
      completed.payAmountSnapshot,
    );

    await deleteCompanyJobsAndDependents(owner.id);

    expect(await db.query.payments.findFirst({ where: eq(payments.shiftId, shift.id) })).toBeUndefined();
    expect(await db.query.shifts.findFirst({ where: eq(shifts.id, shift.id) })).toBeUndefined();
    expect(await db.query.applications.findFirst({ where: eq(applications.id, application.id) })).toBeUndefined();
    expect(await db.query.jobs.findFirst({ where: eq(jobs.id, job.id) })).toBeUndefined();

    // A prova real do helper: sem a limpeza acima, deletar o dono
    // (que cascateia pra companies) bateria numa FK violation porque
    // jobs.company_id não tem onDelete: cascade.
    await expect(db.delete(users).where(eq(users.id, owner.id))).resolves.not.toThrow();
  });
});
