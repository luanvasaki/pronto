import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../../db/client';
import { companies, documents, users, workerProfiles } from '../../db/schema';
import { listPendingVerifications } from './list-pending-verifications';
import { reviewDocument } from './review-document';

// Fixtures únicas entre arquivos de teste (ver README).
const WORKER_PHONE = '+5511966660045';
const OWNER_PHONE = '+5511966660046';
const ADMIN_PHONE = '+5511966660047';
const TEST_CNPJ = '11222333000299';

describe('listPendingVerifications', () => {
  afterEach(async () => {
    await db.delete(users).where(eq(users.phone, WORKER_PHONE));
    await db.delete(users).where(eq(users.phone, OWNER_PHONE));
    await db.delete(users).where(eq(users.phone, ADMIN_PHONE));
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
});
