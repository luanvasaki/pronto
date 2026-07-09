import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../../db/client';
import { companies, documents, skillCategories, users, workerProfiles } from '../../db/schema';
import { listPendingVerifications } from './list-pending-verifications';
import { reviewDocument } from './review-document';

// Fixtures únicas entre arquivos de teste (ver README).
const WORKER_PHONE = '+5511966660045';
const OWNER_PHONE = '+5511966660046';
const ADMIN_PHONE = '+5511966660047';
const WORKER_CREATOR_PHONE = '+5511966660073';
const TEST_CNPJ = '11222333000299';
const TEST_CATEGORY_NAME = 'Categoria de teste — list-pending-verifications';
const WORKER_CATEGORY_NAME = 'Categoria de teste (worker) — list-pending-verifications';

describe('listPendingVerifications', () => {
  afterEach(async () => {
    // skill_categories.created_by_company_id não tem cascade (mesmo
    // motivo de jobs.company_id) — apaga antes da empresa/usuário.
    await db.delete(skillCategories).where(eq(skillCategories.name, TEST_CATEGORY_NAME));
    await db.delete(skillCategories).where(eq(skillCategories.name, WORKER_CATEGORY_NAME));
    await db.delete(users).where(eq(users.phone, WORKER_PHONE));
    await db.delete(users).where(eq(users.phone, OWNER_PHONE));
    await db.delete(users).where(eq(users.phone, ADMIN_PHONE));
    await db.delete(users).where(eq(users.phone, WORKER_CREATOR_PHONE));
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
    expect(result.companies.some((company) => company.cnpj === TEST_CNPJ)).toBe(true);
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
