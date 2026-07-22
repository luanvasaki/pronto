import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../../db/client';
import {
  applications,
  companies,
  documents,
  jobs,
  payments,
  shifts,
  skillCategories,
  users,
  workerProfiles,
} from '../../db/schema';
import { createApplication } from '../applications/create-application';

const CONSENT = { termsAccepted: true, minorsTermsAccepted: undefined, ipAddress: null, userAgent: null } as const;
import { updateApplicationStatus } from '../applications/update-application-status';
import { withdrawApplication } from '../applications/withdraw-application';
import { PaymentGateway } from '../payments/payment-gateway';
import { checkIn } from '../shifts/check-in';
import { checkOut } from '../shifts/check-out';
import { confirmCheckOut } from '../shifts/confirm-check-out';
import { getWorkerProfile } from './get-worker-profile';
import { upsertWorkerProfile } from './upsert-worker-profile';

const SUCCESS_GATEWAY: PaymentGateway = {
  charge: async () => ({ pspChargeId: 'psp_get-worker-profile' }),
  release: async () => {},
};

async function createJobForCompany(companyId: string, categoryId: string) {
  const [job] = await db
    .insert(jobs)
    .values({
      companyId,
      categoryId,
      description: 'Vaga de teste com descrição detalhada o suficiente.',
      addressLabel: 'Endereço de teste',
      locationLat: -23.55,
      locationLng: -46.63,
      positionsTotal: 3,
      payAmount: '100.00',
      startsAt: TOMORROW,
      endsAt: TOMORROW_PLUS_5H,
    })
    .returning();
  return job;
}

/** Candidatura é única por (jobId, workerId) — turnos extras da mesma empresa pro mesmo trabalhador precisam de vagas separadas. */
async function createCompanyAndJob(ownerPhone: string, cnpj: string, categoryId: string) {
  const [owner] = await db.insert(users).values({ phone: ownerPhone }).returning();
  const [company] = await db
    .insert(companies)
    .values({ ownerUserId: owner.id, legalName: `Empresa ${cnpj}`, tradeName: `Empresa ${cnpj}`, cnpj })
    .returning();
  const job = await createJobForCompany(company.id, categoryId);
  return { owner, company, job };
}

async function completeShift(workerId: string, ownerId: string, jobId: string) {
  const application = await createApplication(workerId, jobId, CONSENT);
  await updateApplicationStatus(ownerId, application.id, 'approved');
  const shift = await db.query.shifts.findFirst({ where: eq(shifts.applicationId, application.id) });
  if (!shift) throw new Error('Turno não foi criado no setup do teste.');
  await checkIn(workerId, shift.id);
  await checkOut(workerId, shift.id);
  await confirmCheckOut(SUCCESS_GATEWAY, ownerId, shift.id);
  return shift;
}

// Fixtures únicas entre arquivos de teste (ver README).
const TEST_PHONE = '+5511966660035';
const OWNER_PHONE = '+5511966660036';
const OWNER2_PHONE = '+5511966661094';
const TEST_CATEGORY_NAME = 'Categoria de teste — get-worker-profile';
const TEST_CNPJ = '11222333000397';
const TEST_CNPJ2 = '11222333000702';
const TEST_CPF = '11122283067';
const TEST_ADDRESS = 'Rua das Flores, 123, Centro, São Paulo - SP';
const TEST_WORKER_PHONE = '11912345678';
const TEST_BIRTH_DATE = '2000-01-01';

const TOMORROW = new Date(Date.now() + 24 * 60 * 60 * 1000);
const TOMORROW_PLUS_5H = new Date(TOMORROW.getTime() + 5 * 60 * 60 * 1000);

describe('getWorkerProfile', () => {
  afterEach(async () => {
    // jobs/shifts não têm cascade a partir de companies (de propósito,
    // ver schema) — apaga turno e vaga antes da empresa/usuário.
    for (const ownerPhone of [OWNER_PHONE, OWNER2_PHONE]) {
      const owner = await db.query.users.findFirst({ where: eq(users.phone, ownerPhone) });
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
      }
      await db.delete(users).where(eq(users.phone, ownerPhone));
    }
    await db.delete(users).where(eq(users.phone, TEST_PHONE));
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
      cpf: TEST_CPF,
      homeAddressFull: TEST_ADDRESS,
      phone: TEST_WORKER_PHONE,
      birthDate: TEST_BIRTH_DATE,
    });

    const result = await getWorkerProfile(user.id);

    expect(result.fullName).toBe('Ana Souza');
    expect(result.categoryIds).toEqual([category.id]);
    expect(result.homeAddressFull).toBe(TEST_ADDRESS);
    expect(result.kycStatus).toBe('pending');
    expect(result.hasDocument).toBe(false);
    expect(result.totalShiftsCompleted).toBe(0);
    expect(result.totalHoursWorked).toBe(0);
    expect(result.avgRating).toBeNull();
    expect(result.searchRadiusKm).toBe(10);
    expect(result.homeLat).toBeNull();
    expect(result.homeLng).toBeNull();
  });

  it('indica hasDocument depois que o documento é enviado', async () => {
    const [user] = await db.insert(users).values({ phone: TEST_PHONE }).returning();
    const [category] = await db.insert(skillCategories).values({ name: TEST_CATEGORY_NAME }).returning();
    await upsertWorkerProfile(user.id, {
      fullName: 'Ana Souza',
      categoryIds: [category.id],
      photoUrl: undefined,
      bio: undefined,
      cpf: TEST_CPF,
      homeAddressFull: TEST_ADDRESS,
      phone: TEST_WORKER_PHONE,
      birthDate: TEST_BIRTH_DATE,
    });
    await db.insert(documents).values({ workerId: user.id, fileUrl: 'documents/fake.jpg' });

    const result = await getWorkerProfile(user.id);

    expect(result.hasDocument).toBe(true);
    expect(result.hasSelfie).toBe(false);
  });

  it('indica hasSelfie separado de hasDocument, um por type', async () => {
    const [user] = await db.insert(users).values({ phone: TEST_PHONE }).returning();
    const [category] = await db.insert(skillCategories).values({ name: TEST_CATEGORY_NAME }).returning();
    await upsertWorkerProfile(user.id, {
      fullName: 'Ana Souza',
      categoryIds: [category.id],
      photoUrl: undefined,
      bio: undefined,
      cpf: TEST_CPF,
      homeAddressFull: TEST_ADDRESS,
      phone: TEST_WORKER_PHONE,
      birthDate: TEST_BIRTH_DATE,
    });
    await db.insert(documents).values({ workerId: user.id, fileUrl: 'documents/fake-selfie.jpg', type: 'selfie' });

    const result = await getWorkerProfile(user.id);

    expect(result.hasDocument).toBe(false);
    expect(result.hasSelfie).toBe(true);
  });

  it('indica hasCnhDocument separado dos outros types', async () => {
    const [user] = await db.insert(users).values({ phone: TEST_PHONE }).returning();
    const [category] = await db.insert(skillCategories).values({ name: TEST_CATEGORY_NAME }).returning();
    await upsertWorkerProfile(user.id, {
      fullName: 'Ana Souza',
      categoryIds: [category.id],
      photoUrl: undefined,
      bio: undefined,
      cpf: TEST_CPF,
      homeAddressFull: TEST_ADDRESS,
      phone: TEST_WORKER_PHONE,
      birthDate: TEST_BIRTH_DATE,
      cnhCategory: 'B',
    });

    const beforeUpload = await getWorkerProfile(user.id);
    expect(beforeUpload.hasCnhDocument).toBe(false);

    await db.insert(documents).values({ workerId: user.id, fileUrl: 'documents/fake-cnh.pdf', type: 'cnh' });

    const afterUpload = await getWorkerProfile(user.id);
    expect(afterUpload.hasCnhDocument).toBe(true);
    expect(afterUpload.hasDocument).toBe(false);
    expect(afterUpload.hasSelfie).toBe(false);
  });

  it('documento reprovado não conta como "has" — precisa reaparecer pra reenvio — e expõe o motivo', async () => {
    const [user] = await db.insert(users).values({ phone: TEST_PHONE }).returning();
    const [category] = await db.insert(skillCategories).values({ name: TEST_CATEGORY_NAME }).returning();
    await upsertWorkerProfile(user.id, {
      fullName: 'Ana Souza',
      categoryIds: [category.id],
      photoUrl: undefined,
      bio: undefined,
      cpf: TEST_CPF,
      homeAddressFull: TEST_ADDRESS,
      phone: TEST_WORKER_PHONE,
      birthDate: TEST_BIRTH_DATE,
    });
    await db.insert(documents).values({
      workerId: user.id,
      fileUrl: 'documents/fake.jpg',
      status: 'rejected',
      rejectionReason: 'Foto não é do documento pedido',
    });

    const result = await getWorkerProfile(user.id);

    expect(result.hasDocument).toBe(false);
    expect(result.documentRejectionReason).toBe('Foto não é do documento pedido');
  });

  it('reenviar documento (nova linha aprovada) volta a contar como "has" e some com o motivo', async () => {
    const [user] = await db.insert(users).values({ phone: TEST_PHONE }).returning();
    const [category] = await db.insert(skillCategories).values({ name: TEST_CATEGORY_NAME }).returning();
    await upsertWorkerProfile(user.id, {
      fullName: 'Ana Souza',
      categoryIds: [category.id],
      photoUrl: undefined,
      bio: undefined,
      cpf: TEST_CPF,
      homeAddressFull: TEST_ADDRESS,
      phone: TEST_WORKER_PHONE,
      birthDate: TEST_BIRTH_DATE,
    });
    await db.insert(documents).values({
      workerId: user.id,
      fileUrl: 'documents/fake-v1.jpg',
      status: 'rejected',
      rejectionReason: 'Foto não é do documento pedido',
      createdAt: new Date(Date.now() - 1000),
    });
    await db.insert(documents).values({ workerId: user.id, fileUrl: 'documents/fake-v2.jpg' });

    const result = await getWorkerProfile(user.id);

    expect(result.hasDocument).toBe(true);
    expect(result.documentRejectionReason).toBeNull();
  });

  it('isMinor vem false e sem dados de responsável pra trabalhador maior de idade', async () => {
    const [user] = await db.insert(users).values({ phone: TEST_PHONE }).returning();
    const [category] = await db.insert(skillCategories).values({ name: TEST_CATEGORY_NAME }).returning();
    await upsertWorkerProfile(user.id, {
      fullName: 'Ana Souza',
      categoryIds: [category.id],
      cpf: TEST_CPF,
      homeAddressFull: TEST_ADDRESS,
      phone: TEST_WORKER_PHONE,
      birthDate: TEST_BIRTH_DATE,
    });

    const result = await getWorkerProfile(user.id);

    expect(result.isMinor).toBe(false);
    expect(result.guardianFullName).toBeNull();
    expect(result.hasGuardianDocument).toBe(false);
  });

  it('isMinor vem true com dados do responsável e hasGuardianDocument pra trabalhador de 16-17 anos', async () => {
    const [user] = await db.insert(users).values({ phone: TEST_PHONE }).returning();
    const [category] = await db.insert(skillCategories).values({ name: TEST_CATEGORY_NAME }).returning();
    const seventeenYearsAgo = new Date();
    seventeenYearsAgo.setFullYear(seventeenYearsAgo.getFullYear() - 17);
    const birthDate = seventeenYearsAgo.toISOString().slice(0, 10);
    await upsertWorkerProfile(user.id, {
      fullName: 'Ana Souza',
      categoryIds: [category.id],
      cpf: TEST_CPF,
      homeAddressFull: TEST_ADDRESS,
      phone: TEST_WORKER_PHONE,
      birthDate,
      guardianFullName: 'Marcos Souza',
      guardianCpf: '11122283148',
      guardianPhone: '11988887777',
      guardianAuthorized: true,
    });

    const beforeUpload = await getWorkerProfile(user.id);
    expect(beforeUpload.isMinor).toBe(true);
    expect(beforeUpload.guardianFullName).toBe('Marcos Souza');
    expect(beforeUpload.guardianAuthorizedAt).not.toBeNull();
    expect(beforeUpload.hasGuardianDocument).toBe(false);

    await db.insert(documents).values({
      workerId: user.id,
      fileUrl: 'documents/fake-guardian.jpg',
      type: 'guardian_identity',
    });

    const afterUpload = await getWorkerProfile(user.id);
    expect(afterUpload.hasGuardianDocument).toBe(true);
  });

  it('calcula turnos completados e horas trabalhadas ao vivo, a partir dos turnos de verdade', async () => {
    const [worker] = await db.insert(users).values({ phone: TEST_PHONE }).returning();
    const [category] = await db.insert(skillCategories).values({ name: TEST_CATEGORY_NAME }).returning();
    await upsertWorkerProfile(worker.id, {
      fullName: 'Ana Souza',
      categoryIds: [category.id],
      photoUrl: undefined,
      bio: undefined,
      cpf: TEST_CPF,
      homeAddressFull: TEST_ADDRESS,
      phone: TEST_WORKER_PHONE,
      birthDate: TEST_BIRTH_DATE,
    });
    await db.update(workerProfiles).set({ kycStatus: 'approved' }).where(eq(workerProfiles.userId, worker.id));

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

    const application = await createApplication(worker.id, job.id, CONSENT);
    await updateApplicationStatus(owner.id, application.id, 'approved');
    const shift = await db.query.shifts.findFirst({ where: eq(shifts.applicationId, application.id) });
    if (!shift) throw new Error('Turno não foi criado no setup do teste.');

    await checkIn(worker.id, shift.id);
    await checkOut(worker.id, shift.id);
    await confirmCheckOut(SUCCESS_GATEWAY, owner.id, shift.id);
    // Sobrescreve os horários reais (quase instantâneos no teste) por um
    // intervalo de 3h exatas, só pra ter um número redondo pra conferir.
    const checkInTime = new Date();
    const checkOutTime = new Date(checkInTime.getTime() + 3 * 60 * 60 * 1000);
    await db.update(shifts).set({ checkInAt: checkInTime, checkOutAt: checkOutTime }).where(eq(shifts.id, shift.id));

    const result = await getWorkerProfile(worker.id);

    expect(result.totalShiftsCompleted).toBe(1);
    expect(result.totalHoursWorked).toBe(3);
  });

  it('soma as horas de vários turnos concluídos, em empresas diferentes', async () => {
    const [worker] = await db.insert(users).values({ phone: TEST_PHONE }).returning();
    const [category] = await db.insert(skillCategories).values({ name: TEST_CATEGORY_NAME }).returning();
    await upsertWorkerProfile(worker.id, {
      fullName: 'Ana Souza',
      categoryIds: [category.id],
      photoUrl: undefined,
      bio: undefined,
      cpf: TEST_CPF,
      homeAddressFull: TEST_ADDRESS,
      phone: TEST_WORKER_PHONE,
      birthDate: TEST_BIRTH_DATE,
    });
    await db.update(workerProfiles).set({ kycStatus: 'approved' }).where(eq(workerProfiles.userId, worker.id));

    const first = await createCompanyAndJob(OWNER_PHONE, TEST_CNPJ, category.id);
    const firstShift = await completeShift(worker.id, first.owner.id, first.job.id);
    const firstCheckIn = new Date();
    await db
      .update(shifts)
      .set({ checkInAt: firstCheckIn, checkOutAt: new Date(firstCheckIn.getTime() + 2 * 60 * 60 * 1000) })
      .where(eq(shifts.id, firstShift.id));

    const second = await createCompanyAndJob(OWNER2_PHONE, TEST_CNPJ2, category.id);
    const secondShift = await completeShift(worker.id, second.owner.id, second.job.id);
    const secondCheckIn = new Date();
    await db
      .update(shifts)
      .set({ checkInAt: secondCheckIn, checkOutAt: new Date(secondCheckIn.getTime() + 4 * 60 * 60 * 1000) })
      .where(eq(shifts.id, secondShift.id));

    const result = await getWorkerProfile(worker.id);

    expect(result.totalShiftsCompleted).toBe(2);
    expect(result.totalHoursWorked).toBe(6);
  });

  it('não conta horas de turno ainda em andamento (checked_in sem check-out)', async () => {
    const [worker] = await db.insert(users).values({ phone: TEST_PHONE }).returning();
    const [category] = await db.insert(skillCategories).values({ name: TEST_CATEGORY_NAME }).returning();
    await upsertWorkerProfile(worker.id, {
      fullName: 'Ana Souza',
      categoryIds: [category.id],
      photoUrl: undefined,
      bio: undefined,
      cpf: TEST_CPF,
      homeAddressFull: TEST_ADDRESS,
      phone: TEST_WORKER_PHONE,
      birthDate: TEST_BIRTH_DATE,
    });
    await db.update(workerProfiles).set({ kycStatus: 'approved' }).where(eq(workerProfiles.userId, worker.id));

    const { owner, job } = await createCompanyAndJob(OWNER_PHONE, TEST_CNPJ, category.id);
    const application = await createApplication(worker.id, job.id, CONSENT);
    await updateApplicationStatus(owner.id, application.id, 'approved');
    const shift = await db.query.shifts.findFirst({ where: eq(shifts.applicationId, application.id) });
    if (!shift) throw new Error('Turno não foi criado no setup do teste.');
    await checkIn(worker.id, shift.id);

    const result = await getWorkerProfile(worker.id);

    expect(result.totalShiftsCompleted).toBe(0);
    expect(result.totalHoursWorked).toBe(0);
  });

  it('reflete avgRating quando já existe', async () => {
    const [user] = await db.insert(users).values({ phone: TEST_PHONE }).returning();
    const [category] = await db.insert(skillCategories).values({ name: TEST_CATEGORY_NAME }).returning();
    await upsertWorkerProfile(user.id, {
      fullName: 'Ana Souza',
      categoryIds: [category.id],
      photoUrl: undefined,
      bio: undefined,
      cpf: TEST_CPF,
      homeAddressFull: TEST_ADDRESS,
      phone: TEST_WORKER_PHONE,
      birthDate: TEST_BIRTH_DATE,
    });
    await db.update(workerProfiles).set({ avgRating: '4.5' }).where(eq(workerProfiles.userId, user.id));

    const result = await getWorkerProfile(user.id);

    expect(result.avgRating).toBe('4.5');
  });

  it('conta empresas atendidas e calcula taxa de recontratação (0% com 1 turno só numa empresa)', async () => {
    const [worker] = await db.insert(users).values({ phone: TEST_PHONE }).returning();
    const [category] = await db.insert(skillCategories).values({ name: TEST_CATEGORY_NAME }).returning();
    await upsertWorkerProfile(worker.id, {
      fullName: 'Ana Souza',
      categoryIds: [category.id],
      photoUrl: undefined,
      bio: undefined,
      cpf: TEST_CPF,
      homeAddressFull: TEST_ADDRESS,
      phone: TEST_WORKER_PHONE,
      birthDate: TEST_BIRTH_DATE,
    });
    await db.update(workerProfiles).set({ kycStatus: 'approved' }).where(eq(workerProfiles.userId, worker.id));
    const { owner, job } = await createCompanyAndJob(OWNER_PHONE, TEST_CNPJ, category.id);
    await completeShift(worker.id, owner.id, job.id);

    const result = await getWorkerProfile(worker.id);

    expect(result.companiesServed).toBe(1);
    expect(result.rehireRate).toBe(0);
  });

  it('taxa de recontratação vai a 100% quando a mesma empresa contrata de novo', async () => {
    const [worker] = await db.insert(users).values({ phone: TEST_PHONE }).returning();
    const [category] = await db.insert(skillCategories).values({ name: TEST_CATEGORY_NAME }).returning();
    await upsertWorkerProfile(worker.id, {
      fullName: 'Ana Souza',
      categoryIds: [category.id],
      photoUrl: undefined,
      bio: undefined,
      cpf: TEST_CPF,
      homeAddressFull: TEST_ADDRESS,
      phone: TEST_WORKER_PHONE,
      birthDate: TEST_BIRTH_DATE,
    });
    await db.update(workerProfiles).set({ kycStatus: 'approved' }).where(eq(workerProfiles.userId, worker.id));
    const { owner, company, job } = await createCompanyAndJob(OWNER_PHONE, TEST_CNPJ, category.id);
    await completeShift(worker.id, owner.id, job.id);
    const secondJob = await createJobForCompany(company.id, category.id);
    await completeShift(worker.id, owner.id, secondJob.id);

    const result = await getWorkerProfile(worker.id);

    expect(result.companiesServed).toBe(1);
    expect(result.rehireRate).toBe(100);
  });

  it('taxa de recontratação considera cada empresa separadamente (2 empresas, 1 recontratou)', async () => {
    const [worker] = await db.insert(users).values({ phone: TEST_PHONE }).returning();
    const [category] = await db.insert(skillCategories).values({ name: TEST_CATEGORY_NAME }).returning();
    await upsertWorkerProfile(worker.id, {
      fullName: 'Ana Souza',
      categoryIds: [category.id],
      photoUrl: undefined,
      bio: undefined,
      cpf: TEST_CPF,
      homeAddressFull: TEST_ADDRESS,
      phone: TEST_WORKER_PHONE,
      birthDate: TEST_BIRTH_DATE,
    });
    await db.update(workerProfiles).set({ kycStatus: 'approved' }).where(eq(workerProfiles.userId, worker.id));
    const first = await createCompanyAndJob(OWNER_PHONE, TEST_CNPJ, category.id);
    await completeShift(worker.id, first.owner.id, first.job.id);
    const firstSecondJob = await createJobForCompany(first.company.id, category.id);
    await completeShift(worker.id, first.owner.id, firstSecondJob.id);
    const second = await createCompanyAndJob(OWNER2_PHONE, TEST_CNPJ2, category.id);
    await completeShift(worker.id, second.owner.id, second.job.id);

    const result = await getWorkerProfile(worker.id);

    expect(result.companiesServed).toBe(2);
    expect(result.rehireRate).toBe(50);
  });

  it('comparecimento sem nenhum turno ainda vem nulo, e cancelamentos conta candidatura retirada', async () => {
    const [worker] = await db.insert(users).values({ phone: TEST_PHONE }).returning();
    const [category] = await db.insert(skillCategories).values({ name: TEST_CATEGORY_NAME }).returning();
    await upsertWorkerProfile(worker.id, {
      fullName: 'Ana Souza',
      categoryIds: [category.id],
      photoUrl: undefined,
      bio: undefined,
      cpf: TEST_CPF,
      homeAddressFull: TEST_ADDRESS,
      phone: TEST_WORKER_PHONE,
      birthDate: TEST_BIRTH_DATE,
    });
    await db.update(workerProfiles).set({ kycStatus: 'approved' }).where(eq(workerProfiles.userId, worker.id));
    const { job } = await createCompanyAndJob(OWNER_PHONE, TEST_CNPJ, category.id);
    const application = await createApplication(worker.id, job.id, CONSENT);
    await withdrawApplication(worker.id, application.id);

    const result = await getWorkerProfile(worker.id);

    expect(result.attendanceRate).toBeNull();
    expect(result.companiesServed).toBe(0);
    expect(result.rehireRate).toBeNull();
    expect(result.cancellations).toBe(1);
  });

  it('comparecimento conta completed a favor e no_show contra, ignorando turno cancelado pela empresa', async () => {
    const [worker] = await db.insert(users).values({ phone: TEST_PHONE }).returning();
    const [category] = await db.insert(skillCategories).values({ name: TEST_CATEGORY_NAME }).returning();
    await upsertWorkerProfile(worker.id, {
      fullName: 'Ana Souza',
      categoryIds: [category.id],
      photoUrl: undefined,
      bio: undefined,
      cpf: TEST_CPF,
      homeAddressFull: TEST_ADDRESS,
      phone: TEST_WORKER_PHONE,
      birthDate: TEST_BIRTH_DATE,
    });
    await db.update(workerProfiles).set({ kycStatus: 'approved' }).where(eq(workerProfiles.userId, worker.id));
    const { owner, company, job } = await createCompanyAndJob(OWNER_PHONE, TEST_CNPJ, category.id);
    await completeShift(worker.id, owner.id, job.id);

    const noShowJob = await createJobForCompany(company.id, category.id);
    const noShowApplication = await createApplication(worker.id, noShowJob.id, CONSENT);
    await updateApplicationStatus(owner.id, noShowApplication.id, 'approved');
    const noShowShift = await db.query.shifts.findFirst({ where: eq(shifts.applicationId, noShowApplication.id) });
    await db.update(shifts).set({ status: 'no_show' }).where(eq(shifts.id, noShowShift!.id));

    const cancelledJob = await createJobForCompany(company.id, category.id);
    const cancelledApplication = await createApplication(worker.id, cancelledJob.id, CONSENT);
    await updateApplicationStatus(owner.id, cancelledApplication.id, 'approved');
    const cancelledShift = await db.query.shifts.findFirst({
      where: eq(shifts.applicationId, cancelledApplication.id),
    });
    await db.update(shifts).set({ status: 'cancelled' }).where(eq(shifts.id, cancelledShift!.id));

    const result = await getWorkerProfile(worker.id);

    // 1 completed / (1 completed + 1 no_show) = 50% — o cancelado não entra na conta.
    expect(result.attendanceRate).toBe(50);
  });
});
