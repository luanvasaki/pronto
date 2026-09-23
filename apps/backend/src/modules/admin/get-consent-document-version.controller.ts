import { NextFunction, Request, Response } from 'express';
import { HttpError } from '../../shared/errors/http-error';
import { getConsentDocumentByVersion, isConsentDocumentType } from '../consent-documents/get-consent-document';

export async function getConsentDocumentVersionHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const type = req.params.type;
    if (typeof type !== 'string' || !isConsentDocumentType(type)) {
      throw new HttpError(404, 'Tipo de documento inválido.');
    }

    const version = req.params.version;
    if (typeof version !== 'string' || version.length === 0) {
      throw new HttpError(404, 'Versão inválida.');
    }

    const document = await getConsentDocumentByVersion(type, version);
    res.status(200).json(document);
  } catch (error) {
    next(error);
  }
}
