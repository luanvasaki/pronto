import { NextFunction, Request, Response } from 'express';
import { chargeForShift } from '../payments/charge-for-shift';
import { PaymentGateway } from '../payments/payment-gateway';
import { HttpError } from '../../shared/errors/http-error';
import { checkOut } from './check-out';

/**
 * Recebe o gateway de pagamento por injeção (mesmo padrão do
 * OtpSender em auth.routes.ts) em vez de instanciar aqui — deixa o
 * mock trocável por um provedor real sem mexer neste arquivo.
 */
export function createCheckOutHandler(gateway: PaymentGateway) {
  return async function checkOutHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.auth?.userId;
      if (!userId) {
        throw new HttpError(401, 'Sessão inválida ou expirada.');
      }

      const shiftId = req.params.id;
      if (typeof shiftId !== 'string') {
        throw new HttpError(404, 'Turno não encontrado.');
      }

      const { lat, lng } = req.body as { lat?: number; lng?: number };
      const result = await checkOut(userId, shiftId, { lat, lng });

      // Best-effort: o check-out já aconteceu, uma falha ao criar a
      // cobrança não deveria impedir a resposta de sucesso.
      try {
        await chargeForShift(gateway, result.id, result.payAmountSnapshot);
      } catch (paymentError) {
        console.error('Falha ao criar cobrança do turno', paymentError);
      }

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };
}
