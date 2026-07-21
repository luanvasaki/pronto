import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../../db/client';
import { companies, users } from '../../db/schema';
import { reviewCompany } from './review-company';

// Fixtures únicas entre arquivos de teste (ver README).
const OWNER_PHONE = '+5511966660044';
const ADMIN_PHONE = '+5511966660099';
const TEST_CNPJ = '11112223340260';

async function setupPendingCompany() {
  const [owner] = await db.insert(users).values({ phone: OWNER_PHONE }).returning();
  const [admin] = await db.insert(users).values({ phone: ADMIN_PHONE, isAdmin: true }).returning();
  const [company] = await db
    .insert(companies)
    .values({ ownerUserId: owner.id, legalName: 'Bar do Zé Ltda', tradeName: 'Bar do Zé', cnpj: TEST_CNPJ })
    .returning();
  return { owner, admin, company };
}

describe('reviewCompany', () => {
  afterEach(async () => {
    await db.delete(users).where(eq(users.phone, OWNER_PHONE));
    await db.delete(users).where(eq(users.phone, ADMIN_PHONE));
  });

  it('rejeita status inválido', async () => {
    const { admin, company } = await setupPendingCompany();

    await expect(reviewCompany(admin.id, company.id, 'invalido')).rejects.toThrow('Status inválido');
  });

  it('rejeita empresa inexistente', async () => {
    const { admin } = await setupPendingCompany();

    await expect(
      reviewCompany(admin.id, '00000000-0000-0000-0000-000000000000', 'approved'),
    ).rejects.toThrow('não encontrada');
  });

  it('aprova a verificação da empresa e registra quem revisou', async () => {
    const { admin, company } = await setupPendingCompany();

    const result = await reviewCompany(admin.id, company.id, 'approved');

    expect(result.verificationStatus).toBe('approved');
    const updated = await db.query.companies.findFirst({ where: eq(companies.id, company.id) });
    expect(updated?.reviewedBy).toBe(admin.id);
    expect(updated?.reviewedAt).toBeInstanceOf(Date);
  });

  it('rejeita revisar a mesma empresa duas vezes', async () => {
    const { admin, company } = await setupPendingCompany();
    await reviewCompany(admin.id, company.id, 'rejected', 'Documento ilegível');

    await expect(reviewCompany(admin.id, company.id, 'approved')).rejects.toThrow('já foi revisada');
  });

  it('rejeita revisar a mesma empresa duas vezes mesmo em corrida (duas chamadas simultâneas)', async () => {
    const { admin, company } = await setupPendingCompany();

    const results = await Promise.allSettled([
      reviewCompany(admin.id, company.id, 'approved'),
      reviewCompany(admin.id, company.id, 'rejected', 'Documento ilegível'),
    ]);

    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter((result) => result.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason.message).toContain('já foi revisada');
  });

  it('exige motivo pra rejeitar', async () => {
    const { admin, company } = await setupPendingCompany();

    await expect(reviewCompany(admin.id, company.id, 'rejected')).rejects.toThrow('motivo da rejeição');
    await expect(reviewCompany(admin.id, company.id, 'rejected', '   ')).rejects.toThrow('motivo da rejeição');
  });

  it('grava o motivo da rejeição', async () => {
    const { admin, company } = await setupPendingCompany();

    await reviewCompany(admin.id, company.id, 'rejected', 'Foto do documento cortada, não dá pra ler o CNPJ.');

    const updated = await db.query.companies.findFirst({ where: eq(companies.id, company.id) });
    expect(updated?.rejectionReason).toBe('Foto do documento cortada, não dá pra ler o CNPJ.');
  });

  it('não grava motivo quando aprova', async () => {
    const { admin, company } = await setupPendingCompany();

    const result = await reviewCompany(admin.id, company.id, 'approved');

    expect(result.verificationStatus).toBe('approved');
    const updated = await db.query.companies.findFirst({ where: eq(companies.id, company.id) });
    expect(updated?.rejectionReason).toBeNull();
  });
});
