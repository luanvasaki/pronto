import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { assertOwnsCompany } from './assert-owns-company';
import { db } from '../db/client';
import { companies, users } from '../db/schema';

const OWNER_PHONE = '+5511966660090';
const OUTSIDER_PHONE = '+5511966660091';
const TEST_CNPJ = '11222333000277';

describe('assertOwnsCompany', () => {
  afterEach(async () => {
    await db.delete(companies).where(eq(companies.cnpj, TEST_CNPJ));
    await db.delete(users).where(eq(users.phone, OWNER_PHONE));
    await db.delete(users).where(eq(users.phone, OUTSIDER_PHONE));
  });

  it('não lança nada quando o usuário é o dono da empresa', async () => {
    const [owner] = await db.insert(users).values({ phone: OWNER_PHONE }).returning();
    const [company] = await db
      .insert(companies)
      .values({ ownerUserId: owner.id, legalName: 'Buffet Aurora Ltda', tradeName: 'Buffet Aurora', cnpj: TEST_CNPJ })
      .returning();

    await expect(assertOwnsCompany(owner.id, company.id, 'Você não tem acesso.')).resolves.toBeUndefined();
  });

  it('lança a mensagem informada quando o usuário não é o dono', async () => {
    const [owner] = await db.insert(users).values({ phone: OWNER_PHONE }).returning();
    const [outsider] = await db.insert(users).values({ phone: OUTSIDER_PHONE }).returning();
    const [company] = await db
      .insert(companies)
      .values({ ownerUserId: owner.id, legalName: 'Buffet Aurora Ltda', tradeName: 'Buffet Aurora', cnpj: TEST_CNPJ })
      .returning();

    await expect(assertOwnsCompany(outsider.id, company.id, 'Você não tem acesso a essa vaga.')).rejects.toThrow(
      'Você não tem acesso a essa vaga.',
    );
  });

  it('lança quando a empresa não existe', async () => {
    const [outsider] = await db.insert(users).values({ phone: OUTSIDER_PHONE }).returning();

    await expect(
      assertOwnsCompany(outsider.id, '00000000-0000-0000-0000-000000000000', 'Você não tem acesso a esse turno.'),
    ).rejects.toThrow('Você não tem acesso a esse turno.');
  });
});
