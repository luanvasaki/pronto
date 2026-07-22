import { NextFunction, Request, Response } from 'express';
import { HttpError } from '../../shared/errors/http-error';
import { getLatestConsentDocument, isConsentDocumentType } from './get-consent-document';

export async function getConsentDocumentHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const type = req.params.type;
    if (typeof type !== 'string' || !isConsentDocumentType(type)) {
      throw new HttpError(404, 'Tipo de documento inválido.');
    }
    const document = await getLatestConsentDocument(type);
    res.status(200).json(document);
  } catch (error) {
    next(error);
  }
}
