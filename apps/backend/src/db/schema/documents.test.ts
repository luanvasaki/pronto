import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../client';
import { documents } from './documents';
import { users } from './users';
import { workerProfiles } from './worker-profiles';

// Fixtures únicas entre arquivos de teste (ver README).
const WORKER_PHONE = '+5511911110000';
const REVIEWER_PHONE = '+5511911110001';

async function createTestWorker() {
  const [workerUser] = await db.insert(users).values({ phone: WORKER_PHONE }).returning();
  const [workerProfile] = await db
    .insert(workerProfiles)
    .values({ userId: workerUser.id, fullName: 'Beatriz Nunes' })
    .returning();

  return { workerUser, workerProfile };
}

describe('tabela documents', () => {
  afterEach(async () => {
    await db.delete(users).where(eq(users.phone, WORKER_PHONE));
    await db.delete(users).where(eq(users.phone, REVIEWER_PHONE));
  });

  it('cria um documento com status "pending" por padrão', async () => {
    const { workerProfile } = await createTestWorker();

    const [document] = await db
      .insert(documents)
      .values({ workerId: workerProfile.userId, fileUrl: 'kyc/beatriz-rg.jpg' })
      .returning();

    expect(document.status).toBe('pending');
    expect(document.reviewedBy).toBeNull();
  });

  it('remove o documento junto quando o trabalhador é removido (cascade)', async () => {
    const { workerUser, workerProfile } = await createTestWorker();
    await db
      .insert(documents)
      .values({ workerId: workerProfile.userId, fileUrl: 'kyc/beatriz-rg.jpg' });

    await db.delete(users).where(eq(users.id, workerUser.id));

    const remaining = await db.query.documents.findMany({
      where: eq(documents.workerId, workerProfile.userId),
    });
    expect(remaining).toHaveLength(0);
  });

  it('registra a aprovação com quem revisou e quando', async () => {
    const { workerProfile } = await createTestWorker();
    const [reviewer] = await db.insert(users).values({ phone: REVIEWER_PHONE }).returning();
    const [document] = await db
      .insert(documents)
      .values({ workerId: workerProfile.userId, fileUrl: 'kyc/beatriz-rg.jpg' })
      .returning();

    const [updated] = await db
      .update(documents)
      .set({ status: 'approved', reviewedBy: reviewer.id, reviewedAt: new Date() })
      .where(eq(documents.id, document.id))
      .returning();

    expect(updated.status).toBe('approved');
    expect(updated.reviewedBy).toBe(reviewer.id);
  });
});
