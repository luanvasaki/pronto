import { eq } from 'drizzle-orm';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../../db/client';
import { companies, documents, skillCategories, users, workerProfiles } from '../../db/schema';
import { upsertCompanyProfile } from '../companies/upsert-company-profile';
import { LocalFileStorage } from '../workers/file-storage';
import { uploadCompanyDocument } from '../companies/upload-company-document';
import { listPendingVerifications } from './list-pending-verifications';
import { reviewDocument } from './review-document';

// Fixtures únicas entre arquivos de teste (ver README).
const WORKER_PHONE = '+5511966660045';
const OWNER_PHONE = '+5511966660046';
const ADMIN_PHONE = '+5511966660047';
const WORKER_CREATOR_PHONE = '+5511966660073';
const INDIVIDUAL_OWNER_PHONE = '+5511966660074';
const TEST_CNPJ = '11112223340189';
const TEST_CPF = '11122233558';
const TEST_CATEGORY_NAME = 'Categoria de teste — list-pending-verifications';
const WORKER_CATEGORY_NAME = 'Categoria de teste (worker) — list-pending-verifications';
const storage = new LocalFileStorage();

describe('listPendingVerifications', () => {
  afterEach(async () => {
    const individualOwner = await db.query.users.findFirst({ where: eq(users.phone, INDIVIDUAL_OWNER_PHONE) });
    if (individualOwner) {
      const [company] = await db.query.companies.findMany({ where: eq(companies.ownerUserId, individualOwner.id) });
      if (company) {
        await rm(path.join(process.cwd(), 'uploads', 'documents', company.id), { recursive: true, force: true });
      }
    }
    // skill_categories.created_by_company_id não tem cascade (mesmo
    // motivo de jobs.company_id) — apaga antes da empresa/usuário.
    await db.delete(skillCategories).where(eq(skillCategories.name, TEST_CATEGORY_NAME));
    await db.delete(skillCategories).where(eq(skillCategories.name, WORKER_CATEGORY_NAME));
    await db.delete(users).where(eq(users.phone, WORKER_PHONE));
    await db.delete(users).where(eq(users.phone, OWNER_PHONE));
    await db.delete(users).where(eq(users.phone, ADMIN_PHONE));
    await db.delete(users).where(eq(users.phone, WORKER_CREATOR_PHONE));
    await db.delete(users).where(eq(users.phone, INDIVIDUAL_OWNER_PHONE));
  });

  it('lista documentos e empresas pendentes, sem os já revisados', async () => {
    const [worker] = await db.insert(users).values({ phone: WORKER_PHONE }).returning();
    await db.insert(workerProfiles).values({ userId: worker.id, fullName: 'Ana Souza' });
    const [admin] = await db.insert(users).values({ phone: ADMIN_PHONE, isAdmin: true }).returning();
    const [pendingDocument] = await db
      .insert(documents)
      .values({ workerId: worker.id, fileUrl: 'documents/x/pending.jpg' })
      .returning();
    const [reviewedDocument] = await db
      .insert(documents)
      .values({ workerId: worker.id, fileUrl: 'documents/x/reviewed.jpg' })
      .returning();
    await reviewDocument(admin.id, reviewedDocument.id, 'approved');

    const [owner] = await db.insert(users).values({ phone: OWNER_PHONE }).returning();
    await db
      .insert(companies)
      .values({ ownerUserId: owner.id, legalName: 'Bar do Zé Ltda', tradeName: 'Bar do Zé', cnpj: TEST_CNPJ });

    const result = await listPendingVerifications();

    expect(result.documents).toHaveLength(1);
    expect(result.documents[0].id).toBe(pendingDocument.id);
    expect(result.documents[0].workerFullName).toBe('Ana Souza');
    expect(result.documents[0].isMinor).toBe(false);
    expect(result.documents[0].guardianFullName).toBeNull();
    expect(result.companies.some((company) => company.cnpj === TEST_CNPJ)).toBe(true);
  });

  it('inclui isMinor e os dados do responsável quando o trabalhador é menor de idade', async () => {
    const [worker] = await db.insert(users).values({ phone: WORKER_PHONE }).returning();
    const seventeenYearsAgo = new Date();
    seventeenYearsAgo.setFullYear(seventeenYearsAgo.getFullYear() - 17);
    const birthDate = seventeenYearsAgo.toISOString().slice(0, 10);
    await db.insert(workerProfiles).values({
      userId: worker.id,
      fullName: 'Ana Souza',
      birthDate,
      guardianFullName: 'Marcos Souza',
      guardianCpf: '11122283148',
      guardianPhone: '11988887777',
    });
    const [pendingDocument] = await db
      .insert(documents)
      .values({ workerId: worker.id, fileUrl: 'documents/x/responsavel.jpg', type: 'guardian_identity' })
      .returning();

    const result = await listPendingVerifications();

    const found = result.documents.find((document) => document.id === pendingDocument.id);
    expect(found?.isMinor).toBe(true);
    expect(found?.guardianFullName).toBe('Marcos Souza');
    expect(found?.guardianCpf).toBe('11122283148');
    expect(found?.guardianPhone).toBe('11988887777');
  });

  it('inclui personType, cpf e o id do documento mais recente de empresa pessoa física', async () => {
    const [owner] = await db.insert(users).values({ phone: INDIVIDUAL_OWNER_PHONE }).returning();
    await upsertCompanyProfile(owner.id, {
      legalName: 'Ana Souza',
      tradeName: 'Ana Freelas',
      personType: 'fisica',
      cpf: TEST_CPF,
    });
    const file = { buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]), mimetype: 'image/jpeg', size: 4 };
    const document = await uploadCompanyDocument(owner.id, file, storage);

    const result = await listPendingVerifications();

    const found = result.companies.find((company) => company.cpf === TEST_CPF);
    expect(found).toBeDefined();
    expect(found?.personType).toBe('fisica');
    expect(found?.cnpj).toBeNull();
    expect(found?.documentId).toBe(document.id);
  });

  it('documentId vem null quando a empresa não enviou documento', async () => {
    const [owner] = await db.insert(users).values({ phone: OWNER_PHONE }).returning();
    await db
      .insert(companies)
      .values({ ownerUserId: owner.id, legalName: 'Bar do Zé Ltda', tradeName: 'Bar do Zé', cnpj: TEST_CNPJ });

    const result = await listPendingVerifications();

    const found = result.companies.find((company) => company.cnpj === TEST_CNPJ);
    expect(found?.documentId).toBeNull();
  });

  it('lista categoria pendente com o nome da empresa criadora, sem as já aprovadas', async () => {
    const [owner] = await db.insert(users).values({ phone: OWNER_PHONE }).returning();
    const [company] = await db
      .insert(companies)
      .values({ ownerUserId: owner.id, legalName: 'Bar do Zé Ltda', tradeName: 'Bar do Zé', cnpj: TEST_CNPJ })
      .returning();
    const [pendingCategory] = await db
      .insert(skillCategories)
      .values({ name: TEST_CATEGORY_NAME, status: 'pending', createdByCompanyId: company.id })
      .returning();

    const result = await listPendingVerifications();

    expect(result.skillCategories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: pendingCategory.id, name: TEST_CATEGORY_NAME, createdByName: 'Bar do Zé' }),
      ]),
    );
    expect(result.skillCategories.every((category) => category.name !== 'Garçom')).toBe(true);
  });

  it('lista categoria pendente com o nome do trabalhador criador', async () => {
    const [worker] = await db.insert(users).values({ phone: WORKER_CREATOR_PHONE }).returning();
    await db.insert(workerProfiles).values({ userId: worker.id, fullName: 'Rafael Lima' });
    const [pendingCategory] = await db
      .insert(skillCategories)
      .values({ name: WORKER_CATEGORY_NAME, status: 'pending', createdByWorkerId: worker.id })
      .returning();

    const result = await listPendingVerifications();

    expect(result.skillCategories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: pendingCategory.id, name: WORKER_CATEGORY_NAME, createdByName: 'Rafael Lima' }),
      ]),
    );
  });
});
