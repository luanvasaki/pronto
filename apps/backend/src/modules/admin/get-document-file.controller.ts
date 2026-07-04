import path from 'node:path';
import { eq } from 'drizzle-orm';
import { NextFunction, Request, Response } from 'express';
import { db } from '../../db/client';
import { documents } from '../../db/schema';
import { HttpError } from '../../shared/errors/http-error';

/**
 * `document.fileUrl` nunca vem do cliente aqui — é lido do banco a
 * partir do id do documento, então não há risco de path traversal via
 * entrada do usuário (diferente de aceitar um caminho arbitrário).
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

    const fullPath = path.join(process.cwd(), 'uploads', document.fileUrl);
    res.sendFile(fullPath, (error) => {
      if (error) next(error);
    });
  } catch (error) {
    next(error);
  }
}
