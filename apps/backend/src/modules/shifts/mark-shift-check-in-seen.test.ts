import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../../db/client';
import { applications, companies, jobs, shifts, skillCategories, users, workerProfiles } from '../../db/schema';
import { createApplication } from '../applications/create-application';
import { updateApplicationStatus } from '../applications/update-application-status';
import { checkIn } from './check-in';
import { markShiftCheckInSeen } from './mark-shift-check-in-seen';

const WORKER_PHONE = '+5511966661098';
const OWNER_PHONE = '+5511966661099';
const OTHER_OWNER_PHONE = '+5511966661100';
const TEST_CNPJ = '11222333000704';
const TEST_CATEGORY_NAME = 'Categoria de teste — mark-shift-check-in-seen';

const TOMORROW = new Date(Date.now() + 24 * 60 * 60 * 1000);
const TOMORROW_PLUS_5H = new Date(TOMORROW.getTime() + 5 * 60 * 60 * 1000);

async function setupCheckedInShift() {
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
      positionsTotal: 2,
      payAmount: '100.00',
      startsAt: TOMORROW,
      endsAt: TOMORROW_PLUS_5H,
    })
    .returning();
  const application = await createApplication(worker.id, job.id, true);
  await updateApplicationStatus(owner.id, application.id, 'approved');
  const shift = await db.query.shifts.findFirst({ where: eq(shifts.applicationId, application.id) });
  if (!shift) throw new Error('Turno não foi criado no setup do teste.');
  await checkIn(worker.id, shift.id, { lat: -23.55, lng: -46.63 });
  return { worker, owner, shift };
}

describe('markShiftCheckInSeen', () => {
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
    }
    await db.delete(users).where(eq(users.phone, WORKER_PHONE));
    await db.delete(users).where(eq(users.phone, OWNER_PHONE));
    await db.delete(users).where(eq(users.phone, OTHER_OWNER_PHONE));
    await db.delete(skillCategories).where(eq(skillCategories.name, TEST_CATEGORY_NAME));
  });

  it('marca o check-in como visto', async () => {
    const { owner, shift } = await setupCheckedInShift();

    await markShiftCheckInSeen(owner.id, shift.id);

    const updated = await db.query.shifts.findFirst({ where: eq(shifts.id, shift.id) });
    expect(updated?.companySeenCheckInAt).not.toBeNull();
  });

  it('rejeita quem não é dono da empresa da vaga', async () => {
    const { shift } = await setupCheckedInShift();
    const [otherOwner] = await db.insert(users).values({ phone: OTHER_OWNER_PHONE }).returning();

    await expect(markShiftCheckInSeen(otherOwner.id, shift.id)).rejects.toThrow('não tem acesso');
  });

  it('rejeita turno inexistente', async () => {
    const { owner } = await setupCheckedInShift();

    await expect(markShiftCheckInSeen(owner.id, '00000000-0000-0000-0000-000000000000')).rejects.toThrow(
      'não encontrado',
    );
  });
});
