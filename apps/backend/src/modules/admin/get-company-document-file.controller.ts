import { eq } from 'drizzle-orm';
import { NextFunction, Request, Response } from 'express';
import { db } from '../../db/client';
import { companyDocuments } from '../../db/schema';
import { HttpError } from '../../shared/errors/http-error';
import { createFileStorage } from '../workers/file-storage';

const fileStorage = createFileStorage('private');

/** Mesmo padrão de get-document-file.controller.ts, mas pro documento de identidade da empresa pessoa física. */
export async function getCompanyDocumentFileHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const documentId = req.params.id;
    if (typeof documentId !== 'string') {
      throw new HttpError(404, 'Documento não encontrado.');
    }

    const document = await db.query.companyDocuments.findFirst({ where: eq(companyDocuments.id, documentId) });
    if (!document) {
      throw new HttpError(404, 'Documento não encontrado.');
    }

    const file = await fileStorage.read(document.fileUrl);
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(file.buffer);
  } catch (error) {
    next(error);
  }
}
