import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../client';
import { companies } from './companies';
import { users } from './users';

const TEST_PHONE = '+5511977770000';

async function createTestUser() {
  const [user] = await db.insert(users).values({ phone: TEST_PHONE }).returning();
  return user;
}

describe('tabela companies', () => {
  afterEach(async () => {
    await db.delete(users).where(eq(users.phone, TEST_PHONE));
  });

  it('cria uma empresa com status "pending" por padrão', async () => {
    const user = await createTestUser();

    const [company] = await db
      .insert(companies)
      .values({
        ownerUserId: user.id,
        legalName: 'Buffet Aurora Ltda',
        tradeName: 'Buffet Aurora',
        cnpj: '12345678000199',
      })
      .returning();

    expect(company.verificationStatus).toBe('pending');
    expect(company.totalJobsPosted).toBe(0);
  });

  it('não permite duas empresas com o mesmo dono', async () => {
    const user = await createTestUser();
    await db.insert(companies).values({
      ownerUserId: user.id,
      legalName: 'Buffet Aurora Ltda',
      tradeName: 'Buffet Aurora',
      cnpj: '12345678000199',
    });

    await expect(
      db.insert(companies).values({
        ownerUserId: user.id,
        legalName: 'Outra Empresa Ltda',
        tradeName: 'Outra Empresa',
        cnpj: '98765432000188',
      }),
    ).rejects.toThrow();
  });

  it('não permite duas empresas com o mesmo CNPJ', async () => {
    const ownerA = await createTestUser();
    await db.insert(companies).values({
      ownerUserId: ownerA.id,
      legalName: 'Buffet Aurora Ltda',
      tradeName: 'Buffet Aurora',
      cnpj: '12345678000199',
    });

    const [ownerB] = await db
      .insert(users)
      .values({ phone: '+5511977770001' })
      .returning();

    await expect(
      db.insert(companies).values({
        ownerUserId: ownerB.id,
        legalName: 'Outra Empresa Ltda',
        tradeName: 'Outra Empresa',
        cnpj: '12345678000199',
      }),
    ).rejects.toThrow();

    await db.delete(users).where(eq(users.id, ownerB.id));
  });
});
