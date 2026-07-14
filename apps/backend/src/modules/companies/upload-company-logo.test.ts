import { eq } from 'drizzle-orm';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../../db/client';
import { companies, users } from '../../db/schema';
import { LocalFileStorage } from '../workers/file-storage';
import { uploadCompanyLogo } from './upload-company-logo';

// Fixture única entre arquivos de teste (ver README).
const TEST_PHONE = '+5511955550004';
const TEST_CNPJ = '11112223340502';

async function createTestUser() {
  const [user] = await db.insert(users).values({ phone: TEST_PHONE }).returning();
  return user;
}

const storage = new LocalFileStorage();

describe('uploadCompanyLogo', () => {
  afterEach(async () => {
    const existingCompany = await db.query.companies.findFirst({ where: eq(companies.cnpj, TEST_CNPJ) });
    await db.delete(users).where(eq(users.phone, TEST_PHONE));
    if (existingCompany) {
      await rm(path.join(process.cwd(), 'uploads', 'public', existingCompany.id), {
        recursive: true,
        force: true,
      });
    }
  });

  it('rejeita quando não há arquivo', async () => {
    const user = await createTestUser();

    await expect(uploadCompanyLogo(user.id, undefined, storage)).rejects.toThrow('Nenhum arquivo enviado');
  });

  it('rejeita quando a empresa ainda não existe', async () => {
    const user = await createTestUser();
    const file = { buffer: Buffer.from('logo'), mimetype: 'image/jpeg', size: 4 };

    await expect(uploadCompanyLogo(user.id, file, storage)).rejects.toThrow('Complete o cadastro');
  });

  it('grava o arquivo público e atualiza logoUrl da empresa', async () => {
    const user = await createTestUser();
    await db
      .insert(companies)
      .values({ ownerUserId: user.id, legalName: 'Bar Teste Ltda', tradeName: 'Bar Teste', cnpj: TEST_CNPJ });
    const file = { buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]), mimetype: 'image/jpeg', size: 4 };

    const result = await uploadCompanyLogo(user.id, file, storage);

    expect(result.logoUrl).toContain('/uploads/public/');
    const saved = await db.query.companies.findFirst({ where: eq(companies.ownerUserId, user.id) });
    expect(saved?.logoUrl).toBe(result.logoUrl);
  });
});
