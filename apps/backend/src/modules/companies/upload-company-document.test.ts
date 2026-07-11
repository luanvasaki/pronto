import { eq } from 'drizzle-orm';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../../db/client';
import { companies, companyDocuments, users } from '../../db/schema';
import { LocalFileStorage } from '../workers/file-storage';
import { upsertCompanyProfile } from './upsert-company-profile';
import { uploadCompanyDocument } from './upload-company-document';

// Fixture única entre arquivos de teste (ver README).
const TEST_PHONE = '+5511955550030';
const TEST_CPF = '11122233355';

async function createTestUser() {
  const [user] = await db.insert(users).values({ phone: TEST_PHONE }).returning();
  return user;
}

const storage = new LocalFileStorage();

describe('uploadCompanyDocument', () => {
  afterEach(async () => {
    const existing = await db.query.users.findFirst({ where: eq(users.phone, TEST_PHONE) });
    if (existing) {
      const [company] = await db.query.companies.findMany({ where: eq(companies.ownerUserId, existing.id) });
      if (company) {
        await rm(path.join(process.cwd(), 'uploads', 'documents', company.id), { recursive: true, force: true });
      }
    }
    await db.delete(users).where(eq(users.phone, TEST_PHONE));
  });

  it('rejeita quando não há arquivo', async () => {
    const user = await createTestUser();

    await expect(uploadCompanyDocument(user.id, undefined, storage)).rejects.toThrow('Nenhum arquivo enviado');
  });

  it('rejeita quando a empresa ainda não existe', async () => {
    const user = await createTestUser();
    const file = { buffer: Buffer.from('foto'), mimetype: 'image/jpeg', size: 4 };

    await expect(uploadCompanyDocument(user.id, file, storage)).rejects.toThrow('Complete o cadastro da empresa');
  });

  it('grava o documento vinculado à empresa', async () => {
    const user = await createTestUser();
    const company = await upsertCompanyProfile(user.id, {
      legalName: 'Ana Souza',
      tradeName: 'Ana Freelas',
      personType: 'fisica',
      cpf: TEST_CPF,
    });
    const file = { buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]), mimetype: 'image/jpeg', size: 4 };

    const result = await uploadCompanyDocument(user.id, file, storage);

    const saved = await db.query.companyDocuments.findFirst({ where: eq(companyDocuments.id, result.id) });
    expect(saved?.companyId).toBe(company.id);
    expect(saved?.fileUrl).toContain('documents/');
  });

  it('aceita PDF', async () => {
    const user = await createTestUser();
    await upsertCompanyProfile(user.id, {
      legalName: 'Ana Souza',
      tradeName: 'Ana Freelas',
      personType: 'fisica',
      cpf: TEST_CPF,
    });
    const file = { buffer: Buffer.from('%PDF-1.4\n...'), mimetype: 'application/pdf', size: 12 };

    const result = await uploadCompanyDocument(user.id, file, storage);

    const saved = await db.query.companyDocuments.findFirst({ where: eq(companyDocuments.id, result.id) });
    expect(saved?.fileUrl).toMatch(/\.pdf$/);
  });

  it('rejeita arquivo que não é imagem nem PDF de verdade', async () => {
    const user = await createTestUser();
    await upsertCompanyProfile(user.id, {
      legalName: 'Ana Souza',
      tradeName: 'Ana Freelas',
      personType: 'fisica',
      cpf: TEST_CPF,
    });
    const file = { buffer: Buffer.from('não é nada disso'), mimetype: 'application/pdf', size: 20 };

    await expect(uploadCompanyDocument(user.id, file, storage)).rejects.toThrow('não é uma imagem');
  });
});
