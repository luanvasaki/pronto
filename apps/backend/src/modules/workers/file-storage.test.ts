import { access, rm } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
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
