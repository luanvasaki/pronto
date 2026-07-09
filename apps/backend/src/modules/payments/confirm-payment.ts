import { and, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { payments, shifts } from '../../db/schema';
import { HttpError } from '../../shared/errors/http-error';
import { PaymentResponse, toPaymentResponse } from './payment-response';

/**
 * Só o trabalhador do turno confirma ou contesta — é o lado que
 * recebeu (ou não) o dinheiro de verdade fora da plataforma. UPDATE
 * condicional (WHERE status = 'released') fecha a corrida de duas
 * confirmações simultâneas, mesmo padrão de releasePayment.
 */
export async function confirmPayment(
  workerUserId: string,
  shiftId: string,
  received: boolean,
): Promise<PaymentResponse> {
  const shift = await db.query.shifts.findFirst({ where: eq(shifts.id, shiftId) });
  if (!shift) {
    throw new HttpError(404, 'Turno não encontrado.');
  }
  if (shift.workerId !== workerUserId) {
    throw new HttpError(403, 'Você não tem acesso a esse turno.');
  }

  const payment = await db.query.payments.findFirst({ where: eq(payments.shiftId, shiftId) });
  if (!payment) {
    throw new HttpError(404, 'Pagamento não encontrado.');
  }
  if (payment.status !== 'released') {
    throw new HttpError(400, 'Esse pagamento ainda não foi marcado como pago pela empresa.');
  }

  const now = new Date();
  const [updated] = await db
    .update(payments)
    .set({
      status: received ? 'confirmed' : 'disputed',
      confirmedAt: received ? now : null,
      disputedAt: received ? null : now,
      updatedAt: now,
    })
    .where(and(eq(payments.id, payment.id), eq(payments.status, 'released')))
    .returning();
  if (!updated) {
    throw new HttpError(400, 'Esse pagamento não está pronto pra confirmação.');
  }

  return toPaymentResponse(updated);
}
