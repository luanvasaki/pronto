import { eq } from 'drizzle-orm';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../../db/client';
import { documents, users, workerProfiles } from '../../db/schema';
import { LocalFileStorage } from './file-storage';
import { uploadDocument } from './upload-document';

// Fixture única entre arquivos de teste (ver README).
const TEST_PHONE = '+5511955550002';

async function createTestUser() {
  const [user] = await db.insert(users).values({ phone: TEST_PHONE }).returning();
  return user;
}

const storage = new LocalFileStorage();

describe('uploadDocument', () => {
  afterEach(async () => {
    // O storage salva pelo user.id (uuid), não pelo telefone — busca
    // o id antes de apagar o usuário pra poder limpar a pasta certa.
    const existing = await db.query.users.findFirst({ where: eq(users.phone, TEST_PHONE) });
    await db.delete(users).where(eq(users.phone, TEST_PHONE));
    if (existing) {
      await rm(path.join(process.cwd(), 'uploads', 'documents', existing.id), {
        recursive: true,
        force: true,
      });
    }
  });

  it('rejeita quando não há arquivo', async () => {
    const user = await createTestUser();

    await expect(uploadDocument(user.id, undefined, storage)).rejects.toThrow(
      'Nenhum arquivo enviado',
    );
  });

  it('rejeita quando o perfil ainda não existe', async () => {
    const user = await createTestUser();
    const file = { buffer: Buffer.from('foto'), mimetype: 'image/jpeg', size: 4 };

    await expect(uploadDocument(user.id, file, storage)).rejects.toThrow(
      'Complete seu cadastro',
    );
  });

  it('grava o arquivo e cria o documento como "pending"', async () => {
    const user = await createTestUser();
    await db.insert(workerProfiles).values({ userId: user.id, fullName: 'Beatriz Nunes' });
    const file = { buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]), mimetype: 'image/jpeg', size: 4 };

    const result = await uploadDocument(user.id, file, storage);

    expect(result.status).toBe('pending');
    const saved = await db.query.documents.findFirst({ where: eq(documents.id, result.id) });
    expect(saved?.fileUrl).toContain('documents/');
  });

  it('aceita PDF (CNH/RG digitalizado)', async () => {
    const user = await createTestUser();
    await db.insert(workerProfiles).values({ userId: user.id, fullName: 'Beatriz Nunes' });
    const file = { buffer: Buffer.from('%PDF-1.4\n...'), mimetype: 'application/pdf', size: 12 };

    const result = await uploadDocument(user.id, file, storage);

    expect(result.status).toBe('pending');
    const saved = await db.query.documents.findFirst({ where: eq(documents.id, result.id) });
    expect(saved?.fileUrl).toMatch(/\.pdf$/);
  });

  it('rejeita arquivo que não é imagem nem PDF de verdade', async () => {
    const user = await createTestUser();
    await db.insert(workerProfiles).values({ userId: user.id, fullName: 'Beatriz Nunes' });
    const file = { buffer: Buffer.from('não é nada disso'), mimetype: 'application/pdf', size: 20 };

    await expect(uploadDocument(user.id, file, storage)).rejects.toThrow('não é uma imagem');
  });

  it('grava como "identity" por padrão quando o type não é informado', async () => {
    const user = await createTestUser();
    await db.insert(workerProfiles).values({ userId: user.id, fullName: 'Beatriz Nunes' });
    const file = { buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]), mimetype: 'image/jpeg', size: 4 };

    const result = await uploadDocument(user.id, file, storage);

    expect(result.type).toBe('identity');
  });

  it('grava a selfie com o type correto', async () => {
    const user = await createTestUser();
    await db.insert(workerProfiles).values({ userId: user.id, fullName: 'Beatriz Nunes' });
    const file = { buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]), mimetype: 'image/jpeg', size: 4 };

    const result = await uploadDocument(user.id, file, storage, 'selfie');

    expect(result.type).toBe('selfie');
  });

  it('rejeita PDF como selfie', async () => {
    const user = await createTestUser();
    await db.insert(workerProfiles).values({ userId: user.id, fullName: 'Beatriz Nunes' });
    const file = { buffer: Buffer.from('%PDF-1.4\n...'), mimetype: 'application/pdf', size: 12 };

    await expect(uploadDocument(user.id, file, storage, 'selfie')).rejects.toThrow('precisa ser uma foto');
  });

  it('volta o kycStatus pra "pending" ao reenviar depois de rejeitado', async () => {
    const user = await createTestUser();
    await db.insert(workerProfiles).values({ userId: user.id, fullName: 'Beatriz Nunes', kycStatus: 'rejected' });
    const file = { buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]), mimetype: 'image/jpeg', size: 4 };

    await uploadDocument(user.id, file, storage);

    const profile = await db.query.workerProfiles.findFirst({ where: eq(workerProfiles.userId, user.id) });
    expect(profile?.kycStatus).toBe('pending');
  });

  it('não mexe no kycStatus quando ele já está "pending"', async () => {
    const user = await createTestUser();
    await db.insert(workerProfiles).values({ userId: user.id, fullName: 'Beatriz Nunes' });
    const file = { buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]), mimetype: 'image/jpeg', size: 4 };

    await uploadDocument(user.id, file, storage);

    const profile = await db.query.workerProfiles.findFirst({ where: eq(workerProfiles.userId, user.id) });
    expect(profile?.kycStatus).toBe('pending');
  });
});
