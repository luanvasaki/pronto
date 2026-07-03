import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export interface FileStorage {
  save(buffer: Buffer, ownerId: string, mimeType: string): Promise<string>;
}

const UPLOADS_DIR = path.join(process.cwd(), 'uploads', 'documents');
const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

/**
 * Disco local — suficiente pro MVP rodando como processo único.
 * Vira S3 (ou equivalente) no dia em que existir conta configurada;
 * a interface já isola essa troca, mesmo padrão do OtpSender (T2.1).
 */
export class LocalFileStorage implements FileStorage {
  async save(buffer: Buffer, ownerId: string, mimeType: string): Promise<string> {
    const extension = EXTENSION_BY_MIME[mimeType] ?? 'bin';
    const key = `${ownerId}/${randomUUID()}.${extension}`;
    const fullPath = path.join(UPLOADS_DIR, key);

    await mkdir(path.dirname(fullPath), { recursive: true });
    await writeFile(fullPath, buffer);

    return `documents/${key}`;
  }
}

/** Único lugar que decide a implementação — mesmo padrão de createOtpSender. */
export function createFileStorage(): FileStorage {
  return new LocalFileStorage();
}
