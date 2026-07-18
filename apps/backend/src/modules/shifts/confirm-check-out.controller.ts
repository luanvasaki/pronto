import { NextFunction, Request, Response } from 'express';
import { HttpError } from '../../shared/errors/http-error';
import { PaymentGateway } from '../payments/payment-gateway';
import { confirmCheckOut } from './confirm-check-out';

/** Recebe o gateway por injeção — mesmo padrão do antigo createCheckOutHandler. */
export function createConfirmCheckOutHandler(gateway: PaymentGateway) {
  return async function confirmCheckOutHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.auth?.userId;
      if (!userId) {
        throw new HttpError(401, 'Sessão inválida ou expirada.');
      }

      const shiftId = req.params.id;
      if (typeof shiftId !== 'string') {
        throw new HttpError(404, 'Turno não encontrado.');
      }

      const result = await confirmCheckOut(gateway, userId, shiftId);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };
}
