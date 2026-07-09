import { eq } from 'drizzle-orm';
import { NextFunction, Request, Response } from 'express';
import { db } from '../../db/client';
import { documents } from '../../db/schema';
import { HttpError } from '../../shared/errors/http-error';
import { createFileStorage } from '../workers/file-storage';

const fileStorage = createFileStorage('private');

/**
 * `document.fileUrl` nunca vem do cliente aqui — é lido do banco a
 * partir do id do documento, então não há risco de path traversal via
 * entrada do usuário (diferente de aceitar um caminho arbitrário).
 *
 * Os bytes sempre passam por aqui (nunca uma URL do Blob direto pro
 * cliente) — é esse proxy autenticado que garante que só quem tem
 * `requireAdmin` consegue ver o documento, já que a URL pública do
 * Blob em si não tem controle de acesso próprio.
 */
export async function getDocumentFileHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const documentId = req.params.id;
    if (typeof documentId !== 'string') {
      throw new HttpError(404, 'Documento não encontrado.');
    }

    const document = await db.query.documents.findFirst({ where: eq(documents.id, documentId) });
    if (!document) {
      throw new HttpError(404, 'Documento não encontrado.');
    }

    const file = await fileStorage.read(document.fileUrl);
    res.setHeader('Content-Type', file.contentType);
    res.send(file.buffer);
  } catch (error) {
    next(error);
  }
}
