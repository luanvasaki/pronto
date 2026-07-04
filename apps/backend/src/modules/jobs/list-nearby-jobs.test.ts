import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../../db/client';
import { companies, jobs, skillCategories, users, workerProfiles, workerSkills } from '../../db/schema';
import { createJob } from './create-job';
import { listNearbyJobs } from './list-nearby-jobs';

// Fixtures únicas entre arquivos de teste (ver README).
const WORKER_PHONE = '+5511966660008';
const OWNER_PHONE = '+5511966660009';
const TEST_CNPJ = '11222333000177';
const CATEGORY_NEAR = 'Categoria de teste — nearby A';
const CATEGORY_FAR = 'Categoria de teste — nearby B';

// Vila Madalena, São Paulo.
const WORKER_LAT = -23.546;
const WORKER_LNG = -46.69;
// ~1km de distância.
const NEAR_JOB_LAT = -23.55;
const NEAR_JOB_LNG = -46.695;
// Rio de Janeiro — bem longe, fora de qualquer raio razoável.
const FAR_JOB_LAT = -22.9068;
const FAR_JOB_LNG = -43.1729;

const TOMORROW = new Date(Date.now() + 24 * 60 * 60 * 1000);
const TOMORROW_PLUS_5H = new Date(TOMORROW.getTime() + 5 * 60 * 60 * 1000);

async function createWorker() {
  const [user] = await db.insert(users).values({ phone: WORKER_PHONE }).returning();
  return user;
}

async function createCompanyOwner() {
  const [owner] = await db.insert(users).values({ phone: OWNER_PHONE }).returning();
  await db
    .insert(companies)
    .values({ ownerUserId: owner.id, legalName: 'Buffet Aurora Ltda', tradeName: 'Buffet Aurora', cnpj: TEST_CNPJ });
  return owner;
}

async function createTestJob(ownerId: string, categoryId: string, lat: number, lng: number) {
  return createJob(ownerId, {
    categoryId,
    description: 'Vaga de teste com descrição detalhada o suficiente.',
    addressLabel: 'Endereço de teste',
    locationLat: lat,
    locationLng: lng,
    positionsTotal: 2,
    payAmount: '100.00',
    startsAt: TOMORROW.toISOString(),
    endsAt: TOMORROW_PLUS_5H.toISOString(),
  });
}

describe('listNearbyJobs', () => {
  afterEach(async () => {
    const owner = await db.query.users.findFirst({ where: eq(users.phone, OWNER_PHONE) });
    if (owner) {
      const [company] = await db.query.companies.findMany({ where: eq(companies.ownerUserId, owner.id) });
      if (company) {
        await db.delete(jobs).where(eq(jobs.companyId, company.id));
      }
    }
    await db.delete(users).where(eq(users.phone, WORKER_PHONE));
    await db.delete(users).where(eq(users.phone, OWNER_PHONE));
    await db.delete(skillCategories).where(eq(skillCategories.name, CATEGORY_NEAR));
    await db.delete(skillCategories).where(eq(skillCategories.name, CATEGORY_FAR));
  });

  it('rejeita quando o perfil ainda não existe', async () => {
    const worker = await createWorker();

    await expect(listNearbyJobs(worker.id)).rejects.toThrow('Complete seu cadastro');
  });

  it('rejeita quando a localização ainda não foi definida', async () => {
    const worker = await createWorker();
    await db.insert(workerProfiles).values({ userId: worker.id, fullName: 'Ana Souza' });

    await expect(listNearbyJobs(worker.id)).rejects.toThrow('Defina sua localização');
  });

  it('retorna lista vazia quando o worker não tem categorias', async () => {
    const worker = await createWorker();
    await db
      .insert(workerProfiles)
      .values({ userId: worker.id, fullName: 'Ana Souza', homeLat: WORKER_LAT, homeLng: WORKER_LNG });

    const result = await listNearbyJobs(worker.id);

    expect(result).toEqual([]);
  });

  it('só retorna vagas da categoria do worker, dentro do raio, ordenadas por distância', async () => {
    const worker = await createWorker();
    await db
      .insert(workerProfiles)
      .values({ userId: worker.id, fullName: 'Ana Souza', homeLat: WORKER_LAT, homeLng: WORKER_LNG, searchRadiusKm: 20 });
    const [categoryNear] = await db.insert(skillCategories).values({ name: CATEGORY_NEAR }).returning();
    const [categoryFar] = await db.insert(skillCategories).values({ name: CATEGORY_FAR }).returning();
    await db.insert(workerSkills).values({ workerId: worker.id, categoryId: categoryNear.id });

    const owner = await createCompanyOwner();
    const nearJob = await createTestJob(owner.id, categoryNear.id, NEAR_JOB_LAT, NEAR_JOB_LNG);
    // Fora do raio (outra cidade).
    await createTestJob(owner.id, categoryNear.id, FAR_JOB_LAT, FAR_JOB_LNG);
    // Categoria que o worker não tem.
    await createTestJob(owner.id, categoryFar.id, WORKER_LAT, WORKER_LNG);

    const result = await listNearbyJobs(worker.id);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(nearJob.id);
    expect(result[0].distanceKm).toBeGreaterThan(0);
    expect(result[0].distanceKm).toBeLessThan(20);
  });
});
