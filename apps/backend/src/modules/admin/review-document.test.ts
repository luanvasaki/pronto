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

  it('aprova o documento, mas só sincroniza o kycStatus como aprovado quando a selfie também estiver', async () => {
    const { admin, document, worker } = await setupPendingDocument();

    const result = await reviewDocument(admin.id, document.id, 'approved');

    expect(result.status).toBe('approved');
    // Só a identidade foi enviada — falta a selfie, então o perfil não
    // pode virar "approved" ainda (bug antigo: um array de 1 documento
    // passava no every() sozinho e marcava aprovado sem selfie nenhuma).
    const profile = await db.query.workerProfiles.findFirst({ where: eq(workerProfiles.userId, worker.id) });
    expect(profile?.kycStatus).toBe('pending');
  });

  it('rejeita revisar o mesmo documento duas vezes', async () => {
    const { admin, document } = await setupPendingDocument();
    await reviewDocument(admin.id, document.id, 'rejected');

    await expect(reviewDocument(admin.id, document.id, 'approved')).rejects.toThrow('já foi revisado');
  });

  it('rejeita revisar o mesmo documento duas vezes mesmo em corrida (duas chamadas simultâneas)', async () => {
    const { admin, document } = await setupPendingDocument();

    const results = await Promise.allSettled([
      reviewDocument(admin.id, document.id, 'approved'),
      reviewDocument(admin.id, document.id, 'rejected'),
    ]);

    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter((result) => result.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason.message).toContain('já foi revisado');
  });

  it('só marca o kycStatus como aprovado quando identidade e selfie estão aprovadas', async () => {
    const { admin, document: identityDocument, worker } = await setupPendingDocument();
    const [selfieDocument] = await db
      .insert(documents)
      .values({ workerId: worker.id, fileUrl: 'documents/x/selfie.jpg', type: 'selfie' })
      .returning();

    await reviewDocument(admin.id, identityDocument.id, 'approved');
    let profile = await db.query.workerProfiles.findFirst({ where: eq(workerProfiles.userId, worker.id) });
    expect(profile?.kycStatus).toBe('pending');

    await reviewDocument(admin.id, selfieDocument.id, 'approved');
    profile = await db.query.workerProfiles.findFirst({ where: eq(workerProfiles.userId, worker.id) });
    expect(profile?.kycStatus).toBe('approved');
  });

  it('rejeitar um documento marca o kycStatus como rejeitado mesmo com o outro já aprovado', async () => {
    const { admin, document: identityDocument, worker } = await setupPendingDocument();
    const [selfieDocument] = await db
      .insert(documents)
      .values({ workerId: worker.id, fileUrl: 'documents/x/selfie.jpg', type: 'selfie' })
      .returning();

    await reviewDocument(admin.id, identityDocument.id, 'approved');
    await reviewDocument(admin.id, selfieDocument.id, 'rejected');

    const profile = await db.query.workerProfiles.findFirst({ where: eq(workerProfiles.userId, worker.id) });
    expect(profile?.kycStatus).toBe('rejected');
  });

  it('chega a aprovado depois de reenviar o documento rejeitado, mesmo com a linha antiga rejeitada no banco', async () => {
    const { admin, document: identityDocument, worker } = await setupPendingDocument();
    const [selfieDocument] = await db
      .insert(documents)
      .values({ workerId: worker.id, fileUrl: 'documents/x/selfie.jpg', type: 'selfie' })
      .returning();

    // Documento de identidade rejeitado — trabalhador reenvia (nova
    // linha, upload-document.ts nunca atualiza a antiga).
    await reviewDocument(admin.id, identityDocument.id, 'rejected');
    const [resentIdentityDocument] = await db
      .insert(documents)
      .values({ workerId: worker.id, fileUrl: 'documents/x/y-v2.jpg', type: 'identity' })
      .returning();

    await reviewDocument(admin.id, resentIdentityDocument.id, 'approved');
    await reviewDocument(admin.id, selfieDocument.id, 'approved');

    const profile = await db.query.workerProfiles.findFirst({ where: eq(workerProfiles.userId, worker.id) });
    expect(profile?.kycStatus).toBe('approved');
  });

  describe('trabalhador menor de idade — exige também o documento do responsável', () => {
    async function setupMinorWithPendingDocument(options: { withGuardianConsent?: boolean } = {}) {
      const { withGuardianConsent = true } = options;
      const seventeenYearsAgo = new Date();
      seventeenYearsAgo.setFullYear(seventeenYearsAgo.getFullYear() - 17);
      const birthDate = seventeenYearsAgo.toISOString().slice(0, 10);

      const [worker] = await db.insert(users).values({ phone: WORKER_PHONE }).returning();
      await db.insert(workerProfiles).values({
        userId: worker.id,
        fullName: 'Ana Souza',
        birthDate,
        ...(withGuardianConsent
          ? {
              guardianFullName: 'José Souza',
              guardianCpf: '11122283148',
              guardianPhone: '11988887777',
              guardianAuthorizedAt: new Date(),
            }
          : {}),
      });
      const [admin] = await db.insert(users).values({ phone: ADMIN_PHONE, isAdmin: true }).returning();
      const [document] = await db
        .insert(documents)
        .values({ workerId: worker.id, fileUrl: 'documents/x/y.jpg' })
        .returning();
      return { worker, admin, document };
    }

    it('não aprova o kycStatus com identidade+selfie aprovadas se faltar o documento do responsável', async () => {
      const { admin, document: identityDocument, worker } = await setupMinorWithPendingDocument();
      const [selfieDocument] = await db
        .insert(documents)
        .values({ workerId: worker.id, fileUrl: 'documents/x/selfie.jpg', type: 'selfie' })
        .returning();

      await reviewDocument(admin.id, identityDocument.id, 'approved');
      await reviewDocument(admin.id, selfieDocument.id, 'approved');

      const profile = await db.query.workerProfiles.findFirst({ where: eq(workerProfiles.userId, worker.id) });
      expect(profile?.kycStatus).toBe('pending');
    });

    it('aprova o kycStatus só depois que identidade+selfie+documento do responsável estão todos aprovados', async () => {
      const { admin, document: identityDocument, worker } = await setupMinorWithPendingDocument();
      const [selfieDocument] = await db
        .insert(documents)
        .values({ workerId: worker.id, fileUrl: 'documents/x/selfie.jpg', type: 'selfie' })
        .returning();
      const [guardianDocument] = await db
        .insert(documents)
        .values({ workerId: worker.id, fileUrl: 'documents/x/responsavel.jpg', type: 'guardian_identity' })
        .returning();

      await reviewDocument(admin.id, identityDocument.id, 'approved');
      await reviewDocument(admin.id, selfieDocument.id, 'approved');
      let profile = await db.query.workerProfiles.findFirst({ where: eq(workerProfiles.userId, worker.id) });
      expect(profile?.kycStatus).toBe('pending');

      await reviewDocument(admin.id, guardianDocument.id, 'approved');
      profile = await db.query.workerProfiles.findFirst({ where: eq(workerProfiles.userId, worker.id) });
      expect(profile?.kycStatus).toBe('approved');
    });

    it('não aprova o kycStatus mesmo com os 3 documentos aprovados se o perfil não tiver o consentimento do responsável registrado', async () => {
      // Reproduz o cenário do bug: um documento do tipo guardian_identity
      // aprovado não é prova nenhuma de que os dados do responsável
      // (nome/CPF/telefone) e a autorização explícita (guardianAuthorizedAt)
      // realmente existem no perfil — checar só o TIPO do documento deixava
      // passar isso.
      const { admin, document: identityDocument, worker } = await setupMinorWithPendingDocument({
        withGuardianConsent: false,
      });
      const [selfieDocument] = await db
        .insert(documents)
        .values({ workerId: worker.id, fileUrl: 'documents/x/selfie.jpg', type: 'selfie' })
        .returning();
      const [guardianDocument] = await db
        .insert(documents)
        .values({ workerId: worker.id, fileUrl: 'documents/x/responsavel.jpg', type: 'guardian_identity' })
        .returning();

      await reviewDocument(admin.id, identityDocument.id, 'approved');
      await reviewDocument(admin.id, selfieDocument.id, 'approved');
      await reviewDocument(admin.id, guardianDocument.id, 'approved');

      const profile = await db.query.workerProfiles.findFirst({ where: eq(workerProfiles.userId, worker.id) });
      expect(profile?.kycStatus).toBe('pending');
    });
  });
});
