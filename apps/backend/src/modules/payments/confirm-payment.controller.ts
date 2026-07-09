import { NextFunction, Request, Response } from 'express';
import { HttpError } from '../../shared/errors/http-error';
import { confirmPayment } from './confirm-payment';

export async function confirmPaymentHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      throw new HttpError(401, 'Sessão inválida ou expirada.');
    }

    const shiftId = req.params.id;
    if (typeof shiftId !== 'string') {
      throw new HttpError(404, 'Turno não encontrado.');
    }

    const { received } = req.body as { received?: boolean };
    if (typeof received !== 'boolean') {
      throw new HttpError(400, 'Informe se recebeu o pagamento.');
    }

    const result = await confirmPayment(userId, shiftId, received);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
