import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../../db/client';
import { applications, companies, jobs, skillCategories, users, workerProfiles } from '../../db/schema';
import { createApplication } from '../applications/create-application';

const CONSENT = { termsAccepted: true, minorsTermsAccepted: undefined, ipAddress: null, userAgent: null } as const;
import { duplicateWeek } from './duplicate-week';

// Fixtures únicas entre arquivos de teste (ver README).
const OWNER_PHONE = '+5511966660097';
const WORKER_PHONE = '+5511966660098';
const TEST_CNPJ = '11112223341231';
const TEST_CATEGORY_NAME = 'Categoria de teste — duplicate-week';

// Semana de origem começa daqui a 3 dias — bem dentro do futuro, longe o
// bastante da borda "startsAt precisa ser no futuro" do createJob.
const SOURCE_WEEK_START = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
SOURCE_WEEK_START.setHours(0, 0, 0, 0);
const TARGET_WEEK_START = new Date(SOURCE_WEEK_START.getTime() + 7 * 24 * 60 * 60 * 1000);

function jobStartsAt(daysAfterWeekStart: number, hour: number) {
  const date = new Date(SOURCE_WEEK_START.getTime() + daysAfterWeekStart * 24 * 60 * 60 * 1000);
  date.setHours(hour, 0, 0, 0);
  return date;
}

async function setup() {
  const [owner] = await db.insert(users).values({ phone: OWNER_PHONE }).returning();
  const [company] = await db
    .insert(companies)
    .values({
      ownerUserId: owner.id,
      legalName: 'Buffet Aurora Ltda',
      tradeName: 'Buffet Aurora',
      cnpj: TEST_CNPJ,
      verificationStatus: 'approved',
    })
    .returning();
  const [category] = await db.insert(skillCategories).values({ name: TEST_CATEGORY_NAME }).returning();
  return { owner, company, category };
}

async function createSourceJob(
  companyId: string,
  categoryId: string,
  overrides: { startsAt: Date; positionsTotal?: number; status?: 'open' | 'filled' | 'cancelled' },
) {
  const endsAt = new Date(overrides.startsAt.getTime() + 5 * 60 * 60 * 1000);
  const [job] = await db
    .insert(jobs)
    .values({
      companyId,
      categoryId,
      description: 'Vaga de teste com descrição detalhada o suficiente.',
      addressLabel: 'Endereço de teste',
      locationLat: -23.55,
      locationLng: -46.63,
      positionsTotal: overrides.positionsTotal ?? 2,
      payAmount: '120.00',
      startsAt: overrides.startsAt,
      endsAt,
      status: overrides.status ?? 'open',
    })
    .returning();
  return job;
}

describe('duplicateWeek', () => {
  afterEach(async () => {
    const owner = await db.query.users.findFirst({ where: eq(users.phone, OWNER_PHONE) });
    if (owner) {
      const [company] = await db.query.companies.findMany({ where: eq(companies.ownerUserId, owner.id) });
      if (company) {
        const companyJobs = await db.query.jobs.findMany({ where: eq(jobs.companyId, company.id) });
        for (const job of companyJobs) {
          await db.delete(applications).where(eq(applications.jobId, job.id));
        }
        await db.delete(jobs).where(eq(jobs.companyId, company.id));
      }
    }
    await db.delete(users).where(eq(users.phone, WORKER_PHONE));
    await db.delete(users).where(eq(users.phone, OWNER_PHONE));
    await db.delete(skillCategories).where(eq(skillCategories.name, TEST_CATEGORY_NAME));
  });

  it('rejeita quando o perfil da empresa ainda não existe', async () => {
    const [owner] = await db.insert(users).values({ phone: OWNER_PHONE }).returning();

    await expect(
      duplicateWeek(owner.id, { sourceWeekStart: SOURCE_WEEK_START, targetWeekStart: TARGET_WEEK_START, termsAccepted: true, ipAddress: null, userAgent: null }),
    ).rejects.toThrow('Complete o cadastro');
  });

  it('rejeita quando não há vagas na semana de origem', async () => {
    const { owner } = await setup();

    await expect(
      duplicateWeek(owner.id, { sourceWeekStart: SOURCE_WEEK_START, targetWeekStart: TARGET_WEEK_START, termsAccepted: true, ipAddress: null, userAgent: null }),
    ).rejects.toThrow('Não há escalas');
  });

  it('duplica vagas preservando dia da semana e horário, reiniciando positionsFilled', async () => {
    const { owner, company, category } = await setup();
    const worker = await (async () => {
      const [u] = await db.insert(users).values({ phone: WORKER_PHONE }).returning();
      await db.insert(workerProfiles).values({ kycStatus: 'approved', userId: u.id, fullName: 'Ana Souza' });
      return u;
    })();
    const sourceJob = await createSourceJob(company.id, category.id, {
      startsAt: jobStartsAt(4, 20), // sexta-feira 20h da semana de origem
      positionsTotal: 3,
    });
    await createApplication(worker.id, sourceJob.id, CONSENT);

    const result = await duplicateWeek(owner.id, {
      sourceWeekStart: SOURCE_WEEK_START,
      targetWeekStart: TARGET_WEEK_START,
      termsAccepted: true,
      ipAddress: null,
      userAgent: null,
    });

    expect(result).toHaveLength(1);
    const duplicated = result[0];
    expect(duplicated.positionsTotal).toBe(3);
    expect(duplicated.positionsFilled).toBe(0);
    expect(duplicated.status).toBe('open');
    expect(new Date(duplicated.startsAt).getTime()).toBe(sourceJob.startsAt.getTime() + 7 * 24 * 60 * 60 * 1000);
    expect(new Date(duplicated.startsAt).getDay()).toBe(sourceJob.startsAt.getDay());
    expect(new Date(duplicated.startsAt).getHours()).toBe(sourceJob.startsAt.getHours());

    const duplicatedApplications = await db.query.applications.findMany({
      where: eq(applications.jobId, duplicated.id),
    });
    expect(duplicatedApplications).toEqual([]);
  });

  it('duplica todas as vagas não canceladas da semana, ignorando as canceladas', async () => {
    const { owner, company, category } = await setup();
    await createSourceJob(company.id, category.id, { startsAt: jobStartsAt(0, 10) });
    await createSourceJob(company.id, category.id, { startsAt: jobStartsAt(2, 14) });
    await createSourceJob(company.id, category.id, { startsAt: jobStartsAt(5, 9), status: 'cancelled' });

    const result = await duplicateWeek(owner.id, {
      sourceWeekStart: SOURCE_WEEK_START,
      targetWeekStart: TARGET_WEEK_START,
      termsAccepted: true,
      ipAddress: null,
      userAgent: null,
    });

    expect(result).toHaveLength(2);
  });

  it('não duplica vaga fora da janela da semana de origem', async () => {
    const { owner, company, category } = await setup();
    await createSourceJob(company.id, category.id, { startsAt: jobStartsAt(1, 10) });
    // Fora da semana de origem (semana seguinte).
    await createSourceJob(company.id, category.id, {
      startsAt: new Date(jobStartsAt(1, 10).getTime() + 7 * 24 * 60 * 60 * 1000),
    });

    const result = await duplicateWeek(owner.id, {
      sourceWeekStart: SOURCE_WEEK_START,
      targetWeekStart: TARGET_WEEK_START,
      termsAccepted: true,
      ipAddress: null,
      userAgent: null,
    });

    expect(result).toHaveLength(1);
  });

  it('não deixa duplicação parcial: se uma vaga do lote falhar, nenhuma é criada', async () => {
    const { owner, company, category } = await setup();
    // 1ª vaga (processada primeiro, por ordem de startsAt) é válida — sozinha
    // seria criada com sucesso. A 2ª tem positionsTotal 0, um estado que só
    // dá pra existir via insert direto (bypassa a validação de createJob) —
    // ao tentar recriá-la, createJob rejeita no meio do lote.
    await createSourceJob(company.id, category.id, { startsAt: jobStartsAt(0, 10), positionsTotal: 2 });
    await createSourceJob(company.id, category.id, { startsAt: jobStartsAt(2, 14), positionsTotal: 0 });

    await expect(
      duplicateWeek(owner.id, { sourceWeekStart: SOURCE_WEEK_START, targetWeekStart: TARGET_WEEK_START, termsAccepted: true, ipAddress: null, userAgent: null }),
    ).rejects.toThrow('Número de vagas precisa ser pelo menos 1');

    const jobsAfter = await db.query.jobs.findMany({ where: eq(jobs.companyId, company.id) });
    expect(jobsAfter).toHaveLength(2); // só as 2 vagas originais — a 1ª duplicata não ficou órfã no banco
  });
});
