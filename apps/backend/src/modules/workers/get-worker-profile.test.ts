import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../../db/client';
import {
  applications,
  companies,
  documents,
  jobs,
  shifts,
  skillCategories,
  users,
  workerProfiles,
} from '../../db/schema';
import { createApplication } from '../applications/create-application';
import { updateApplicationStatus } from '../applications/update-application-status';
import { checkIn } from '../shifts/check-in';
import { checkOut } from '../shifts/check-out';
import { getWorkerProfile } from './get-worker-profile';
import { upsertWorkerProfile } from './upsert-worker-profile';

// Fixtures únicas entre arquivos de teste (ver README).
const TEST_PHONE = '+5511966660035';
const OWNER_PHONE = '+5511966660036';
const TEST_CATEGORY_NAME = 'Categoria de teste — get-worker-profile';
const TEST_CNPJ = '11222333000397';

const TOMORROW = new Date(Date.now() + 24 * 60 * 60 * 1000);
const TOMORROW_PLUS_5H = new Date(TOMORROW.getTime() + 5 * 60 * 60 * 1000);

describe('getWorkerProfile', () => {
  afterEach(async () => {
    // jobs/shifts não têm cascade a partir de companies (de propósito,
    // ver schema) — apaga turno e vaga antes da empresa/usuário.
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
    }
    await db.delete(users).where(eq(users.phone, TEST_PHONE));
    await db.delete(users).where(eq(users.phone, OWNER_PHONE));
    await db.delete(skillCategories).where(eq(skillCategories.name, TEST_CATEGORY_NAME));
  });

  it('rejeita quem ainda não completou o cadastro', async () => {
    const [user] = await db.insert(users).values({ phone: TEST_PHONE }).returning();

    await expect(getWorkerProfile(user.id)).rejects.toThrow('Complete seu cadastro');
  });

  it('retorna nome, categorias e zero turnos/horas pra quem nunca trabalhou', async () => {
    const [user] = await db.insert(users).values({ phone: TEST_PHONE }).returning();
    const [category] = await db.insert(skillCategories).values({ name: TEST_CATEGORY_NAME }).returning();
    await upsertWorkerProfile(user.id, {
      fullName: 'Ana Souza',
      categoryIds: [category.id],
      photoUrl: undefined,
      bio: undefined,
      cpf: undefined,
    });

    const result = await getWorkerProfile(user.id);

    expect(result.fullName).toBe('Ana Souza');
    expect(result.categoryIds).toEqual([category.id]);
    expect(result.kycStatus).toBe('pending');
    expect(result.hasDocument).toBe(false);
    expect(result.totalShiftsCompleted).toBe(0);
    expect(result.totalHoursWorked).toBe(0);
    expect(result.avgRating).toBeNull();
  });

  it('indica hasDocument depois que o documento é enviado', async () => {
    const [user] = await db.insert(users).values({ phone: TEST_PHONE }).returning();
    const [category] = await db.insert(skillCategories).values({ name: TEST_CATEGORY_NAME }).returning();
    await upsertWorkerProfile(user.id, {
      fullName: 'Ana Souza',
      categoryIds: [category.id],
      photoUrl: undefined,
      bio: undefined,
      cpf: undefined,
    });
    await db.insert(documents).values({ workerId: user.id, fileUrl: 'documents/fake.jpg' });

    const result = await getWorkerProfile(user.id);

    expect(result.hasDocument).toBe(true);
  });

  it('calcula turnos completados e horas trabalhadas ao vivo, a partir dos turnos de verdade', async () => {
    const [worker] = await db.insert(users).values({ phone: TEST_PHONE }).returning();
    const [category] = await db.insert(skillCategories).values({ name: TEST_CATEGORY_NAME }).returning();
    await upsertWorkerProfile(worker.id, {
      fullName: 'Ana Souza',
      categoryIds: [category.id],
      photoUrl: undefined,
      bio: undefined,
      cpf: undefined,
    });

    const [owner] = await db.insert(users).values({ phone: OWNER_PHONE }).returning();
    const [company] = await db
      .insert(companies)
      .values({ ownerUserId: owner.id, legalName: 'Bar Teste Ltda', tradeName: 'Bar Teste', cnpj: TEST_CNPJ })
      .returning();
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
        payAmount: '100.00',
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
    // Sobrescreve os horários reais (quase instantâneos no teste) por um
    // intervalo de 3h exatas, só pra ter um número redondo pra conferir.
    const checkInTime = new Date();
    const checkOutTime = new Date(checkInTime.getTime() + 3 * 60 * 60 * 1000);
    await db.update(shifts).set({ checkInAt: checkInTime, checkOutAt: checkOutTime }).where(eq(shifts.id, shift.id));

    const result = await getWorkerProfile(worker.id);

    expect(result.totalShiftsCompleted).toBe(1);
    expect(result.totalHoursWorked).toBe(3);
  });

  it('reflete avgRating quando já existe', async () => {
    const [user] = await db.insert(users).values({ phone: TEST_PHONE }).returning();
    const [category] = await db.insert(skillCategories).values({ name: TEST_CATEGORY_NAME }).returning();
    await upsertWorkerProfile(user.id, {
      fullName: 'Ana Souza',
      categoryIds: [category.id],
      photoUrl: undefined,
      bio: undefined,
      cpf: undefined,
    });
    await db.update(workerProfiles).set({ avgRating: '4.5' }).where(eq(workerProfiles.userId, user.id));

    const result = await getWorkerProfile(user.id);

    expect(result.avgRating).toBe('4.5');
  });
});
