import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../../db/client';
import { documents, users, workerProfiles } from '../../db/schema';
import { reviewDocument } from './review-document';

// Fixtures únicas entre arquivos de teste (ver README).
const WORKER_PHONE = '+5511966660042';
const ADMIN_PHONE = '+5511966660043';

async function setupPendingDocument() {
  const [worker] = await db.insert(users).values({ phone: WORKER_PHONE }).returning();
  await db.insert(workerProfiles).values({ userId: worker.id, fullName: 'Ana Souza' });
  const [admin] = await db.insert(users).values({ phone: ADMIN_PHONE, isAdmin: true }).returning();
  const [document] = await db.insert(documents).values({ workerId: worker.id, fileUrl: 'documents/x/y.jpg' }).returning();
  return { worker, admin, document };
}

describe('reviewDocument', () => {
  afterEach(async () => {
    await db.delete(users).where(eq(users.phone, WORKER_PHONE));
    await db.delete(users).where(eq(users.phone, ADMIN_PHONE));
  });

  it('rejeita status inválido', async () => {
    const { admin, document } = await setupPendingDocument();

    await expect(reviewDocument(admin.id, document.id, 'invalido')).rejects.toThrow('Status inválido');
  });

  it('rejeita documento inexistente', async () => {
    const { admin } = await setupPendingDocument();

    await expect(
      reviewDocument(admin.id, '00000000-0000-0000-0000-000000000000', 'approved'),
    ).rejects.toThrow('não encontrado');
  });

  it('aprova o documento e sincroniza o kycStatus do trabalhador', async () => {
    const { admin, document, worker } = await setupPendingDocument();

    const result = await reviewDocument(admin.id, document.id, 'approved');

    expect(result.status).toBe('approved');
    const profile = await db.query.workerProfiles.findFirst({ where: eq(workerProfiles.userId, worker.id) });
    expect(profile?.kycStatus).toBe('approved');
  });

  it('rejeita revisar o mesmo documento duas vezes', async () => {
    const { admin, document } = await setupPendingDocument();
    await reviewDocument(admin.id, document.id, 'rejected');

    await expect(reviewDocument(admin.id, document.id, 'approved')).rejects.toThrow('já foi revisado');
  });
});
