import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../../db/client';
import { companies, users } from '../../db/schema';
import { reviewCompany } from './review-company';

// Fixtures únicas entre arquivos de teste (ver README).
const OWNER_PHONE = '+5511966660044';
const TEST_CNPJ = '11222333000288';

async function setupPendingCompany() {
  const [owner] = await db.insert(users).values({ phone: OWNER_PHONE }).returning();
  const [company] = await db
    .insert(companies)
    .values({ ownerUserId: owner.id, legalName: 'Bar do Zé Ltda', tradeName: 'Bar do Zé', cnpj: TEST_CNPJ })
    .returning();
  return { owner, company };
}

describe('reviewCompany', () => {
  afterEach(async () => {
    await db.delete(users).where(eq(users.phone, OWNER_PHONE));
  });

  it('rejeita status inválido', async () => {
    const { company } = await setupPendingCompany();

    await expect(reviewCompany(company.id, 'invalido')).rejects.toThrow('Status inválido');
  });

  it('rejeita empresa inexistente', async () => {
    await expect(
      reviewCompany('00000000-0000-0000-0000-000000000000', 'approved'),
    ).rejects.toThrow('não encontrada');
  });

  it('aprova a verificação da empresa', async () => {
    const { company } = await setupPendingCompany();

    const result = await reviewCompany(company.id, 'approved');

    expect(result.verificationStatus).toBe('approved');
  });

  it('rejeita revisar a mesma empresa duas vezes', async () => {
    const { company } = await setupPendingCompany();
    await reviewCompany(company.id, 'rejected');

    await expect(reviewCompany(company.id, 'approved')).rejects.toThrow('já foi revisada');
  });
});
