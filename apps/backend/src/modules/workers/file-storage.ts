import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { get, put } from '@vercel/blob';
import { env } from '../../config/env';

export interface StoredFile {
  buffer: Buffer;
  contentType: string;
}

/**
 * `private` (default): só quem tem o token do Blob lê — usado pra
 * documento de KYC, sempre servido pelo proxy autenticado.
 * `public`: qualquer um com a URL lê direto, sem passar pelo backend —
 * usado pra foto de perfil/logo, pensadas pra aparecer num <img> comum.
 */
export type FileAccess = 'private' | 'public';

export interface FileStorage {
  save(buffer: Buffer, ownerId: string, mimeType: string, access?: FileAccess): Promise<string>;
  read(fileUrl: string): Promise<StoredFile>;
}

const UPLOADS_DIR = path.join(process.cwd(), 'uploads', 'documents');
const PUBLIC_UPLOADS_DIR = path.join(process.cwd(), 'uploads', 'public');
const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'application/pdf': 'pdf',
};
const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  pdf: 'application/pdf',
};

/**
 * Disco local — só usado quando não há `BLOB_READ_WRITE_TOKEN` (testes
 * e ambientes sem o Blob provisionado ainda). A interface isola essa
 * troca, mesmo padrão do OtpSender (T2.1).
 */
export class LocalFileStorage implements FileStorage {
  async save(buffer: Buffer, ownerId: string, mimeType: string, access: FileAccess = 'private'): Promise<string> {
    const extension = EXTENSION_BY_MIME[mimeType] ?? 'bin';
    const key = `${ownerId}/${randomUUID()}.${extension}`;

    if (access === 'public') {
      const fullPath = path.join(PUBLIC_UPLOADS_DIR, key);
      await mkdir(path.dirname(fullPath), { recursive: true });
      await writeFile(fullPath, buffer);
      return `/uploads/public/${key}`;
    }

    const fullPath = path.join(UPLOADS_DIR, key);
    await mkdir(path.dirname(fullPath), { recursive: true });
    await writeFile(fullPath, buffer);

    return `documents/${key}`;
  }

  async read(fileUrl: string): Promise<StoredFile> {
    const fullPath = path.join(process.cwd(), 'uploads', fileUrl);
    const buffer = await readFile(fullPath);
    const extension = fileUrl.split('.').pop() ?? '';

    return { buffer, contentType: MIME_BY_EXTENSION[extension] ?? 'application/octet-stream' };
  }
}

/**
 * Vercel Blob com `access: 'private'` — ler os bytes exige o
 * `BLOB_READ_WRITE_TOKEN`, não só conhecer a URL (diferente de
 * 'public', onde qualquer um com o link lê sem autenticação). Ainda
 * assim, quem baixa documento sempre passa pelo proxy autenticado
 * (`get-document-file.controller.ts`) — é ele quem decide *quem* pode
 * pedir aquele documento (dono ou admin); o Blob decide se o pedido em
 * si (com o token) é válido.
 */
export class VercelBlobFileStorage implements FileStorage {
  constructor(private readonly token: string) {}

  async save(buffer: Buffer, ownerId: string, mimeType: string, access: FileAccess = 'private'): Promise<string> {
    const extension = EXTENSION_BY_MIME[mimeType] ?? 'bin';
    const prefix = access === 'public' ? 'public' : 'documents';
    const key = `${prefix}/${ownerId}/${randomUUID()}.${extension}`;

    const blob = await put(key, buffer, {
      access,
      contentType: mimeType,
      addRandomSuffix: false,
      token: this.token,
    });

    return blob.url;
  }

  async read(fileUrl: string): Promise<StoredFile> {
    const result = await get(fileUrl, { access: 'private', token: this.token });
    if (!result || result.statusCode !== 200) {
      throw new Error('Documento não encontrado no Blob.');
    }

    const buffer = Buffer.from(await new Response(result.stream).arrayBuffer());

    return { buffer, contentType: result.blob.contentType };
  }
}

/** Único lugar que decide a implementação — mesmo padrão de createOtpSender. */
export function createFileStorage(): FileStorage {
  if (env.blobReadWriteToken) {
    return new VercelBlobFileStorage(env.blobReadWriteToken);
  }

  return new LocalFileStorage();
}
