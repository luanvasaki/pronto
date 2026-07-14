import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app';
import { db } from '../../db/client';
import { applications, companies, jobs, payments, shifts, skillCategories, users, workerProfiles } from '../../db/schema';

// Fixtures únicas entre arquivos de teste (ver README).
const WORKER_EMAIL = 'shifts-routes-worker-test@example.com';
const OWNER_EMAIL = 'shifts-routes-owner-test@example.com';
const TEST_PASSWORD = 'senha-de-teste-123';
const TEST_CNPJ = '11222333001900';
const TEST_CATEGORY_NAME = 'Categoria de teste — shifts routes';

const TOMORROW = new Date(Date.now() + 24 * 60 * 60 * 1000);
const TOMORROW_PLUS_5H = new Date(TOMORROW.getTime() + 5 * 60 * 60 * 1000);
const JOB_LAT = -23.55;
const JOB_LNG = -46.63;

async function registerAgent(app: ReturnType<typeof createApp>, email: string) {
  const agent = request.agent(app);
  await agent.post('/auth/register').send({ email, password: TEST_PASSWORD, termsAccepted: true });
  return agent;
}

/**
 * Sobe o cenário inteiro (empresa verificada + vaga + trabalhador com
 * KYC aprovado) via HTTP de verdade nos dois agentes — só o que não
 * tem rota pública própria (aprovar empresa, aprovar KYC) é ajustado
 * direto no banco, igual ao resto da suíte já faz.
 */
async function setupApprovedApplication(app: ReturnType<typeof createApp>) {
  const ownerAgent = await registerAgent(app, OWNER_EMAIL);
  await ownerAgent
    .put('/company-profile')
    .send({ legalName: 'Buffet Aurora Ltda', tradeName: 'Buffet Aurora', cnpj: TEST_CNPJ });
  await db.update(companies).set({ verificationStatus: 'approved' }).where(eq(companies.cnpj, TEST_CNPJ));

  const [category] = await db.insert(skillCategories).values({ name: TEST_CATEGORY_NAME }).returning();

  const createJobResponse = await ownerAgent.post('/jobs').send({
    categoryId: category.id,
    description: 'Vaga de teste com descrição detalhada o suficiente.',
    requiresExperience: false,
    addressLabel: 'Endereço de teste',
    locationLat: JOB_LAT,
    locationLng: JOB_LNG,
    positionsTotal: 1,
    payAmount: '150.00',
    startsAt: TOMORROW.toISOString(),
    endsAt: TOMORROW_PLUS_5H.toISOString(),
    termsAccepted: true,
  });
  if (createJobResponse.status !== 201) {
    throw new Error(`criação da vaga falhou no setup do teste: ${createJobResponse.status} ${JSON.stringify(createJobResponse.body)}`);
  }
  const jobId = createJobResponse.body.id as string;

  const workerAgent = await registerAgent(app, WORKER_EMAIL);
  await workerAgent.put('/worker-profile').send({
    fullName: 'Ana Souza',
    categoryIds: [category.id],
    cpf: '52998224725',
    homeAddressFull: 'Rua das Flores, 123, Centro, São Paulo - SP',
    phone: '11912345678',
    birthDate: '2000-01-01',
  });
  const worker = await db.query.users.findFirst({ where: eq(users.email, WORKER_EMAIL) });
  if (!worker) throw new Error('worker não encontrado no setup do teste.');
  await db.update(workerProfiles).set({ kycStatus: 'approved' }).where(eq(workerProfiles.userId, worker.id));

  await workerAgent.post(`/jobs/${jobId}/applications`).send({ termsAccepted: true });
  const applicationRow = await db.query.applications.findFirst({ where: eq(applications.jobId, jobId) });
  if (!applicationRow) throw new Error('candidatura não foi criada no setup do teste.');

  const approveResponse = await ownerAgent.patch(`/applications/${applicationRow.id}`).send({ status: 'approved' });
  if (approveResponse.status !== 200) throw new Error('aprovação da candidatura falhou no setup do teste.');

  const shift = await db.query.shifts.findFirst({ where: eq(shifts.applicationId, applicationRow.id) });
  if (!shift) throw new Error('turno não foi criado pela aprovação.');

  return { ownerAgent, workerAgent, shiftId: shift.id };
}

describe('POST /shifts/:id/check-out (fiação real com cobrança)', () => {
  afterEach(async () => {
    const owner = await db.query.users.findFirst({ where: eq(users.email, OWNER_EMAIL) });
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
    await db.delete(users).where(eq(users.email, WORKER_EMAIL));
    await db.delete(users).where(eq(users.email, OWNER_EMAIL));
    await db.delete(skillCategories).where(eq(skillCategories.name, TEST_CATEGORY_NAME));
  });

  it('check-out via HTTP real dispara a cobrança de verdade (controller → chargeForShift), com o valor certo da vaga', async () => {
    const app = createApp();
    const { workerAgent, shiftId } = await setupApprovedApplication(app);

    const checkInResponse = await workerAgent.post(`/shifts/${shiftId}/check-in`).send({ lat: JOB_LAT, lng: JOB_LNG });
    expect(checkInResponse.status).toBe(200);

    const checkOutResponse = await workerAgent
      .post(`/shifts/${shiftId}/check-out`)
      .send({ lat: JOB_LAT, lng: JOB_LNG });
    expect(checkOutResponse.status).toBe(200);
    expect(checkOutResponse.body.status).toBe('completed');

    // A prova real: o controller de check-out (sem nenhum teste antes
    // disso) chamou chargeForShift de verdade através da rota HTTP —
    // existe um pagamento no banco, com o mesmo valor da vaga.
    const payment = await db.query.payments.findFirst({ where: eq(payments.shiftId, shiftId) });
    expect(payment).toBeDefined();
    expect(payment?.amount).toBe('150.00');
    expect(payment?.status).toBe('charged');
    expect(payment?.pspChargeId).not.toBeNull();
  });
});

describe('POST /shifts/:id/payment/release e /payment/confirm (fiação real)', () => {
  afterEach(async () => {
    const owner = await db.query.users.findFirst({ where: eq(users.email, OWNER_EMAIL) });
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
    await db.delete(users).where(eq(users.email, WORKER_EMAIL));
    await db.delete(users).where(eq(users.email, OWNER_EMAIL));
    await db.delete(skillCategories).where(eq(skillCategories.name, TEST_CATEGORY_NAME));
  });

  async function setupChargedShift(app: ReturnType<typeof createApp>) {
    const { ownerAgent, workerAgent, shiftId } = await setupApprovedApplication(app);
    await workerAgent.post(`/shifts/${shiftId}/check-in`).send({ lat: JOB_LAT, lng: JOB_LNG });
    await workerAgent.post(`/shifts/${shiftId}/check-out`).send({ lat: JOB_LAT, lng: JOB_LNG });
    return { ownerAgent, workerAgent, shiftId };
  }

  it('libera e confirma o pagamento via HTTP real (requireAuth + rate limiter + params reais)', async () => {
    const app = createApp();
    const { ownerAgent, workerAgent, shiftId } = await setupChargedShift(app);

    const noSessionRelease = await request(app).post(`/shifts/${shiftId}/payment/release`);
    expect(noSessionRelease.status).toBe(401);

    const releaseResponse = await ownerAgent.post(`/shifts/${shiftId}/payment/release`);
    expect(releaseResponse.status).toBe(200);
    expect(releaseResponse.body.status).toBe('released');

    const noSessionConfirm = await request(app).post(`/shifts/${shiftId}/payment/confirm`).send({ received: true });
    expect(noSessionConfirm.status).toBe(401);

    const confirmResponse = await workerAgent.post(`/shifts/${shiftId}/payment/confirm`).send({ received: true });
    expect(confirmResponse.status).toBe(200);
    expect(confirmResponse.body.status).toBe('confirmed');
    expect(confirmResponse.body.amount).toBe('150.00');

    const payment = await db.query.payments.findFirst({ where: eq(payments.shiftId, shiftId) });
    expect(payment?.status).toBe('confirmed');
  });
});
