import { access, rm } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LocalFileStorage } from './file-storage';

const TEST_OWNER_ID = 'test-owner-file-storage';

describe('LocalFileStorage', () => {
  afterEach(async () => {
    await rm(path.join(process.cwd(), 'uploads', 'documents', TEST_OWNER_ID), {
      recursive: true,
      force: true,
    });
  });

  it('grava o arquivo em disco e retorna uma chave com a extensão certa', async () => {
    const storage = new LocalFileStorage();
    const buffer = Buffer.from('conteúdo de teste');

    const key = await storage.save(buffer, TEST_OWNER_ID, 'image/png');

    expect(key).toMatch(new RegExp(`^documents/${TEST_OWNER_ID}/.+\\.png$`));
    await expect(access(path.join(process.cwd(), 'uploads', key))).resolves.toBeUndefined();
  });

  it('gera chaves diferentes pra cada chamada', async () => {
    const storage = new LocalFileStorage();
    const buffer = Buffer.from('a');

    const keyA = await storage.save(buffer, TEST_OWNER_ID, 'image/jpeg');
    const keyB = await storage.save(buffer, TEST_OWNER_ID, 'image/jpeg');

    expect(keyA).not.toBe(keyB);
  });
});

describe('createFileStorage', () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it('retorna LocalFileStorage sem token configurado (dev/teste)', async () => {
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', '');
    vi.stubEnv('BLOB_DOCUMENTS_TOKEN', '');
    vi.stubEnv('NODE_ENV', 'development');
    const { createFileStorage, LocalFileStorage: LocalFileStorageReimported } = await import('./file-storage');

    expect(createFileStorage('public')).toBeInstanceOf(LocalFileStorageReimported);
  });

  it('lança erro em produção sem BLOB_READ_WRITE_TOKEN (access public)', async () => {
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', '');
    vi.stubEnv('NODE_ENV', 'production');
    const { createFileStorage } = await import('./file-storage');

    expect(() => createFileStorage('public')).toThrow(/BLOB_READ_WRITE_TOKEN/);
  });

  it('lança erro em produção sem BLOB_DOCUMENTS_TOKEN (access private)', async () => {
    vi.stubEnv('BLOB_DOCUMENTS_TOKEN', '');
    vi.stubEnv('NODE_ENV', 'production');
    const { createFileStorage } = await import('./file-storage');

    expect(() => createFileStorage('private')).toThrow(/BLOB_DOCUMENTS_TOKEN/);
  });

  it('retorna VercelBlobFileStorage quando o token está configurado', async () => {
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'test-token');
    const { createFileStorage, VercelBlobFileStorage } = await import('./file-storage');

    expect(createFileStorage('public')).toBeInstanceOf(VercelBlobFileStorage);
  });
});
