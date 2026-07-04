import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../../db/client';
import { companies, users } from '../../db/schema';
import { upsertCompanyProfile } from './upsert-company-profile';
import { getCompanyProfile } from './get-company-profile';

// Fixtures únicas entre arquivos de teste (ver README).
const TEST_PHONE = '+5511966660036';
const TEST_CNPJ = '11222333000277';

describe('getCompanyProfile', () => {
  afterEach(async () => {
    await db.delete(users).where(eq(users.phone, TEST_PHONE));
  });

  it('rejeita quem ainda não cadastrou a empresa', async () => {
    const [user] = await db.insert(users).values({ phone: TEST_PHONE }).returning();

    await expect(getCompanyProfile(user.id)).rejects.toThrow('Complete o cadastro da empresa');
  });

  it('retorna os dados e estatísticas da empresa', async () => {
    const [user] = await db.insert(users).values({ phone: TEST_PHONE }).returning();
    await upsertCompanyProfile(user.id, { legalName: 'Bar do Zé Ltda', tradeName: 'Bar do Zé', cnpj: TEST_CNPJ });

    const result = await getCompanyProfile(user.id);

    expect(result.tradeName).toBe('Bar do Zé');
    expect(result.verificationStatus).toBe('pending');
    expect(result.totalJobsPosted).toBe(0);
    expect(result.avgRating).toBeNull();
  });

  it('reflete avgRating quando já existe', async () => {
    const [user] = await db.insert(users).values({ phone: TEST_PHONE }).returning();
    await upsertCompanyProfile(user.id, { legalName: 'Bar do Zé Ltda', tradeName: 'Bar do Zé', cnpj: TEST_CNPJ });
    await db.update(companies).set({ avgRating: '4.2', totalJobsPosted: 2 }).where(eq(companies.ownerUserId, user.id));

    const result = await getCompanyProfile(user.id);

    expect(result.avgRating).toBe('4.2');
    expect(result.totalJobsPosted).toBe(2);
  });
});
