import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../../db/client';
import { documents, users, workerProfiles } from '../../db/schema';
import { EmailSender } from '../auth/email-sender';
import { reviewDocument } from './review-document';

// Fixtures únicas entre arquivos de teste (ver README).
const WORKER_PHONE = '+5511966660042';
const ADMIN_PHONE = '+5511966660043';
const WORKER_EMAIL = 'review-document-worker@example.com';

class FakeEmailSender implements EmailSender {
  public approvedEmails: string[] = [];
  public rejectedEmails: Array<{ email: string; reason: string }> = [];

  async sendPasswordResetEmail(): Promise<void> {}
  async sendWelcomeEmail(): Promise<void> {}

  async sendKycApprovedEmail(email: string): Promise<void> {
    this.approvedEmails.push(email);
  }

  async sendKycRejectedEmail(email: string, reason: string): Promise<void> {
    this.rejectedEmails.push({ email, reason });
  }
}

async function setupPendingDocument(options: { withEmail?: boolean } = {}) {
  const { withEmail = false } = options;
  const [worker] = await db
    .insert(users)
    .values({ phone: WORKER_PHONE, email: withEmail ? WORKER_EMAIL : undefined })
    .returning();
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

    await expect(reviewDocument(admin.id, document.id, 'invalido', new FakeEmailSender())).rejects.toThrow(
      'Status inválido',
    );
  });

  it('rejeita documento inexistente', async () => {
    const { admin } = await setupPendingDocument();

    await expect(
      reviewDocument(admin.id, '00000000-0000-0000-0000-000000000000', 'approved', new FakeEmailSender()),
    ).rejects.toThrow('não encontrado');
  });

  it('aprova o documento, mas só sincroniza o kycStatus como aprovado quando a selfie também estiver', async () => {
    const { admin, document, worker } = await setupPendingDocument();

    const result = await reviewDocument(admin.id, document.id, 'approved', new FakeEmailSender());

    expect(result.status).toBe('approved');
    // Só a identidade foi enviada — falta a selfie, então o perfil não
    // pode virar "approved" ainda (bug antigo: um array de 1 documento
    // passava no every() sozinho e marcava aprovado sem selfie nenhuma).
    const profile = await db.query.workerProfiles.findFirst({ where: eq(workerProfiles.userId, worker.id) });
    expect(profile?.kycStatus).toBe('pending');
  });

  it('rejeita revisar o mesmo documento duas vezes', async () => {
    const { admin, document } = await setupPendingDocument();
    await reviewDocument(admin.id, document.id, 'rejected', new FakeEmailSender(), 'Foto cortada');

    await expect(
      reviewDocument(admin.id, document.id, 'approved', new FakeEmailSender()),
    ).rejects.toThrow('já foi revisado');
  });

  it('rejeita revisar o mesmo documento duas vezes mesmo em corrida (duas chamadas simultâneas)', async () => {
    const { admin, document } = await setupPendingDocument();

    const results = await Promise.allSettled([
      reviewDocument(admin.id, document.id, 'approved', new FakeEmailSender()),
      reviewDocument(admin.id, document.id, 'rejected', new FakeEmailSender(), 'Foto cortada'),
    ]);

    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter((result) => result.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason.message).toContain('já foi revisado');
  });

  it('exige motivo pra rejeitar', async () => {
    const { admin, document } = await setupPendingDocument();

    await expect(reviewDocument(admin.id, document.id, 'rejected', new FakeEmailSender())).rejects.toThrow(
      'motivo da rejeição',
    );
  });

  it('grava o motivo da rejeição no documento', async () => {
    const { admin, document } = await setupPendingDocument();

    await reviewDocument(admin.id, document.id, 'rejected', new FakeEmailSender(), 'Foto não é do documento pedido');

    const updated = await db.query.documents.findFirst({ where: eq(documents.id, document.id) });
    expect(updated?.rejectionReason).toBe('Foto não é do documento pedido');
  });

  it('só marca o kycStatus como aprovado quando identidade e selfie estão aprovadas', async () => {
    const { admin, document: identityDocument, worker } = await setupPendingDocument();
    const [selfieDocument] = await db
      .insert(documents)
      .values({ workerId: worker.id, fileUrl: 'documents/x/selfie.jpg', type: 'selfie' })
      .returning();

    await reviewDocument(admin.id, identityDocument.id, 'approved', new FakeEmailSender());
    let profile = await db.query.workerProfiles.findFirst({ where: eq(workerProfiles.userId, worker.id) });
    expect(profile?.kycStatus).toBe('pending');

    await reviewDocument(admin.id, selfieDocument.id, 'approved', new FakeEmailSender());
    profile = await db.query.workerProfiles.findFirst({ where: eq(workerProfiles.userId, worker.id) });
    expect(profile?.kycStatus).toBe('approved');
  });

  it('rejeitar um documento marca o kycStatus como rejeitado mesmo com o outro já aprovado', async () => {
    const { admin, document: identityDocument, worker } = await setupPendingDocument();
    const [selfieDocument] = await db
      .insert(documents)
      .values({ workerId: worker.id, fileUrl: 'documents/x/selfie.jpg', type: 'selfie' })
      .returning();

    await reviewDocument(admin.id, identityDocument.id, 'approved', new FakeEmailSender());
    await reviewDocument(
      admin.id,
      selfieDocument.id,
      'rejected',
      new FakeEmailSender(),
      'Selfie não bate com o documento',
    );

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
    await reviewDocument(admin.id, identityDocument.id, 'rejected', new FakeEmailSender(), 'Foto cortada');
    const [resentIdentityDocument] = await db
      .insert(documents)
      .values({ workerId: worker.id, fileUrl: 'documents/x/y-v2.jpg', type: 'identity' })
      .returning();

    await reviewDocument(admin.id, resentIdentityDocument.id, 'approved', new FakeEmailSender());
    await reviewDocument(admin.id, selfieDocument.id, 'approved', new FakeEmailSender());

    const profile = await db.query.workerProfiles.findFirst({ where: eq(workerProfiles.userId, worker.id) });
    expect(profile?.kycStatus).toBe('approved');
  });

  describe('notificação por e-mail', () => {
    it('manda e-mail de reprovação com o motivo, quando o trabalhador tem e-mail cadastrado', async () => {
      const { admin, document } = await setupPendingDocument({ withEmail: true });
      const sender = new FakeEmailSender();

      await reviewDocument(admin.id, document.id, 'rejected', sender, 'Foto ilegível');

      expect(sender.rejectedEmails).toEqual([{ email: WORKER_EMAIL, reason: 'Foto ilegível' }]);
      expect(sender.approvedEmails).toEqual([]);
    });

    it('manda e-mail de aprovação só quando o kycStatus TRANSICIONA pra approved, não a cada documento revisado depois', async () => {
      const { admin, document: identityDocument, worker } = await setupPendingDocument({ withEmail: true });
      const [selfieDocument] = await db
        .insert(documents)
        .values({ workerId: worker.id, fileUrl: 'documents/x/selfie.jpg', type: 'selfie' })
        .returning();

      const senderForIdentity = new FakeEmailSender();
      await reviewDocument(admin.id, identityDocument.id, 'approved', senderForIdentity);
      // Ainda falta a selfie — perfil continua pending, sem e-mail de aprovação.
      expect(senderForIdentity.approvedEmails).toEqual([]);

      const senderForSelfie = new FakeEmailSender();
      await reviewDocument(admin.id, selfieDocument.id, 'approved', senderForSelfie);
      // Agora sim virou approved de verdade — dispara o e-mail.
      expect(senderForSelfie.approvedEmails).toEqual([WORKER_EMAIL]);

      // Reenvio posterior de outro documento (ex.: CNH) reaprovado não
      // deve mandar o e-mail de "cadastro aprovado" de novo — o perfil já
      // estava approved antes dessa revisão.
      const [cnhDocument] = await db
        .insert(documents)
        .values({ workerId: worker.id, fileUrl: 'documents/x/cnh.pdf', type: 'cnh' })
        .returning();
      const senderForCnh = new FakeEmailSender();
      await reviewDocument(admin.id, cnhDocument.id, 'approved', senderForCnh);
      expect(senderForCnh.approvedEmails).toEqual([]);
    });

    it('não tenta mandar e-mail nenhum quando o trabalhador não tem e-mail cadastrado (conta só com telefone)', async () => {
      const { admin, document } = await setupPendingDocument();
      const sender = new FakeEmailSender();

      await reviewDocument(admin.id, document.id, 'rejected', sender, 'Foto cortada');

      expect(sender.rejectedEmails).toEqual([]);
      expect(sender.approvedEmails).toEqual([]);
    });

    it('a decisão de KYC não falha mesmo se o envio do e-mail der erro', async () => {
      const { admin, document } = await setupPendingDocument({ withEmail: true });
      class ThrowingEmailSender extends FakeEmailSender {
        async sendKycRejectedEmail(): Promise<void> {
          throw new Error('Falha simulada no provedor de e-mail.');
        }
      }

      const result = await reviewDocument(admin.id, document.id, 'rejected', new ThrowingEmailSender(), 'Foto cortada');

      expect(result.status).toBe('rejected');
    });
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

      await reviewDocument(admin.id, identityDocument.id, 'approved', new FakeEmailSender());
      await reviewDocument(admin.id, selfieDocument.id, 'approved', new FakeEmailSender());

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

      await reviewDocument(admin.id, identityDocument.id, 'approved', new FakeEmailSender());
      await reviewDocument(admin.id, selfieDocument.id, 'approved', new FakeEmailSender());
      let profile = await db.query.workerProfiles.findFirst({ where: eq(workerProfiles.userId, worker.id) });
      expect(profile?.kycStatus).toBe('pending');

      await reviewDocument(admin.id, guardianDocument.id, 'approved', new FakeEmailSender());
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

      await reviewDocument(admin.id, identityDocument.id, 'approved', new FakeEmailSender());
      await reviewDocument(admin.id, selfieDocument.id, 'approved', new FakeEmailSender());
      await reviewDocument(admin.id, guardianDocument.id, 'approved', new FakeEmailSender());

      const profile = await db.query.workerProfiles.findFirst({ where: eq(workerProfiles.userId, worker.id) });
      expect(profile?.kycStatus).toBe('pending');
    });
  });
});
