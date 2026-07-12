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

/**
 * Único lugar que decide a implementação — mesmo padrão de createOtpSender.
 *
 * `access` escolhe o token certo: `public` (foto/logo) e `private`
 * (documento de KYC) são stores diferentes na Vercel, cada um só aceita
 * gravar com o access com que foi criado.
 *
 * Em produção, exige o token: sem isso, LocalFileStorage gravaria no
 * disco do processo — que no Railway é efêmero, então foto de perfil,
 * logo de empresa e documento de KYC sumiriam a cada redeploy, sem
 * nenhum erro avisando. Mesmo padrão de createEmailSender()/
 * createGoogleTokenVerifier(): trava o boot em produção em vez de
 * degradar silenciosamente.
 */
export function createFileStorage(access: FileAccess): FileStorage {
  const token = access === 'public' ? env.blobReadWriteToken : env.blobDocumentsToken;

  if (token) {
    return new VercelBlobFileStorage(token);
  }

  if (env.nodeEnv === 'production') {
    const varName = access === 'public' ? 'BLOB_READ_WRITE_TOKEN' : 'BLOB_DOCUMENTS_TOKEN';
    throw new Error(
      `${varName} não configurada — LocalFileStorage não pode rodar em produção (o disco do processo é efêmero no Railway, arquivos salvos ali somem no próximo redeploy).`,
    );
  }

  console.warn(
    `[createFileStorage] Token do Blob (${access}) não configurado — caindo pro LocalFileStorage (disco local, só serve pra dev/teste). ` +
      'Isso é esperado em dev/teste. Se essa mensagem aparecer nos logs de PRODUÇÃO, significa que o upload de arquivos está QUEBRADO (verifique NODE_ENV e as variáveis do Blob no ambiente de deploy).',
  );

  return new LocalFileStorage();
}
