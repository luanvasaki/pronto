import { eq } from 'drizzle-orm';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../../db/client';
import { users, workerProfiles } from '../../db/schema';
import { LocalFileStorage } from './file-storage';
import { uploadWorkerPhoto } from './upload-worker-photo';

// Fixture única entre arquivos de teste (ver README).
const TEST_PHONE = '+5511955550003';

async function createTestUser() {
  const [user] = await db.insert(users).values({ phone: TEST_PHONE }).returning();
  return user;
}

const storage = new LocalFileStorage();

describe('uploadWorkerPhoto', () => {
  afterEach(async () => {
    const existing = await db.query.users.findFirst({ where: eq(users.phone, TEST_PHONE) });
    await db.delete(users).where(eq(users.phone, TEST_PHONE));
    if (existing) {
      await rm(path.join(process.cwd(), 'uploads', 'public', existing.id), {
        recursive: true,
        force: true,
      });
    }
  });

  it('rejeita quando não há arquivo', async () => {
    const user = await createTestUser();

    await expect(uploadWorkerPhoto(user.id, undefined, storage)).rejects.toThrow(
      'Nenhum arquivo enviado',
    );
  });

  it('rejeita quando o perfil ainda não existe', async () => {
    const user = await createTestUser();
    const file = { buffer: Buffer.from('foto'), mimetype: 'image/jpeg', size: 4 };

    await expect(uploadWorkerPhoto(user.id, file, storage)).rejects.toThrow('Complete seu cadastro');
  });

  it('rejeita arquivo que não é uma imagem de verdade', async () => {
    const user = await createTestUser();
    await db.insert(workerProfiles).values({ userId: user.id, fullName: 'Beatriz Nunes' });
    const file = { buffer: Buffer.from('não é imagem'), mimetype: 'image/jpeg', size: 12 };

    await expect(uploadWorkerPhoto(user.id, file, storage)).rejects.toThrow(
      'não é uma imagem',
    );
  });

  it('grava o arquivo público e atualiza photoUrl do perfil', async () => {
    const user = await createTestUser();
    await db.insert(workerProfiles).values({ userId: user.id, fullName: 'Beatriz Nunes' });
    const file = { buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]), mimetype: 'image/jpeg', size: 4 };

    const result = await uploadWorkerPhoto(user.id, file, storage);

    expect(result.photoUrl).toContain('/uploads/public/');
    const saved = await db.query.workerProfiles.findFirst({ where: eq(workerProfiles.userId, user.id) });
    expect(saved?.photoUrl).toBe(result.photoUrl);
  });
});
