import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../../db/client';
import { companies, users } from '../../db/schema';
import { upsertCompanyProfile } from './upsert-company-profile';

// Fixtures únicas entre arquivos de teste (ver README).
const TEST_PHONE = '+5511966660002';
const OTHER_PHONE = '+5511966660003';
const CNPJ_A = '11222333000181';
const CNPJ_B = '11222333000182';

async function createTestUser(phone: string) {
  const [user] = await db.insert(users).values({ phone }).returning();
  return user;
}

describe('upsertCompanyProfile', () => {
  afterEach(async () => {
    // Usuário primeiro (cascade limpa companies via ownerUserId).
    await db.delete(users).where(eq(users.phone, TEST_PHONE));
    await db.delete(users).where(eq(users.phone, OTHER_PHONE));
  });

  it('rejeita razão social ausente', async () => {
    const user = await createTestUser(TEST_PHONE);

    await expect(
      upsertCompanyProfile(user.id, { legalName: undefined, tradeName: 'Bar', cnpj: CNPJ_A }),
    ).rejects.toThrow('Razão social é obrigatória');
  });

  it('rejeita nome fantasia ausente', async () => {
    const user = await createTestUser(TEST_PHONE);

    await expect(
      upsertCompanyProfile(user.id, { legalName: 'Bar Ltda', tradeName: undefined, cnpj: CNPJ_A }),
    ).rejects.toThrow('Nome fantasia é obrigatório');
  });

  it('rejeita CNPJ com formato inválido', async () => {
    const user = await createTestUser(TEST_PHONE);

    await expect(
      upsertCompanyProfile(user.id, { legalName: 'Bar Ltda', tradeName: 'Bar', cnpj: '123' }),
    ).rejects.toThrow('CNPJ inválido');
  });

  it('cria a empresa com status "pending" por padrão', async () => {
    const user = await createTestUser(TEST_PHONE);

    const result = await upsertCompanyProfile(user.id, {
      legalName: '  Bar do Zé Ltda  ',
      tradeName: '  Bar do Zé  ',
      cnpj: CNPJ_A,
    });

    expect(result.legalName).toBe('Bar do Zé Ltda');
    expect(result.tradeName).toBe('Bar do Zé');
    expect(result.verificationStatus).toBe('pending');
  });

  it('atualiza os dados numa segunda chamada do mesmo dono', async () => {
    const user = await createTestUser(TEST_PHONE);

    const first = await upsertCompanyProfile(user.id, {
      legalName: 'Bar do Zé Ltda',
      tradeName: 'Bar do Zé',
      cnpj: CNPJ_A,
    });
    const updated = await upsertCompanyProfile(user.id, {
      legalName: 'Bar do Zé Eventos Ltda',
      tradeName: 'Bar do Zé Eventos',
      cnpj: CNPJ_A,
    });

    expect(updated.id).toBe(first.id);
    expect(updated.tradeName).toBe('Bar do Zé Eventos');

    const rows = await db.query.companies.findMany({ where: eq(companies.ownerUserId, user.id) });
    expect(rows).toHaveLength(1);
  });

  it('salva endereço e ramo de atividade quando informados', async () => {
    const user = await createTestUser(TEST_PHONE);

    const result = await upsertCompanyProfile(user.id, {
      legalName: 'Bar do Zé Ltda',
      tradeName: 'Bar do Zé',
      cnpj: CNPJ_A,
      addressLabel: 'Vila Madalena, São Paulo',
      businessSegment: 'bar',
    });

    expect(result.addressLabel).toBe('Vila Madalena, São Paulo');
    expect(result.businessSegment).toBe('bar');
  });

  it('rejeita ramo de atividade inválido', async () => {
    const user = await createTestUser(TEST_PHONE);

    await expect(
      upsertCompanyProfile(user.id, {
        legalName: 'Bar do Zé Ltda',
        tradeName: 'Bar do Zé',
        cnpj: CNPJ_A,
        addressLabel: undefined,
        businessSegment: 'academia',
      }),
    ).rejects.toThrow('Ramo de atividade inválido');
  });

  it('rejeita CNPJ já usado por outro dono', async () => {
    const owner = await createTestUser(TEST_PHONE);
    const otherOwner = await createTestUser(OTHER_PHONE);
    await upsertCompanyProfile(owner.id, { legalName: 'Bar do Zé Ltda', tradeName: 'Bar do Zé', cnpj: CNPJ_B });

    await expect(
      upsertCompanyProfile(otherOwner.id, {
        legalName: 'Outro Bar Ltda',
        tradeName: 'Outro Bar',
        cnpj: CNPJ_B,
      }),
    ).rejects.toThrow('Esse CNPJ já está cadastrado');
  });
});
