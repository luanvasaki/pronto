import { and, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { companies, jobs, payments, shifts } from '../../db/schema';
import { HttpError } from '../../shared/errors/http-error';
import { PaymentGateway } from './payment-gateway';
import { PaymentResponse, toPaymentResponse } from './payment-response';

/**
 * Só o dono da empresa da vaga pode liberar o pagamento do turno —
 * mesma checagem de acesso usada em update-application-status.
 * UPDATE condicional (WHERE status = 'charged') fecha a corrida de
 * duas liberações simultâneas, mesmo padrão de check-in/check-out.
 */
export async function releasePayment(
  gateway: PaymentGateway,
  ownerUserId: string,
  shiftId: string,
): Promise<PaymentResponse> {
  const shift = await db.query.shifts.findFirst({ where: eq(shifts.id, shiftId) });
  if (!shift) {
    throw new HttpError(404, 'Turno não encontrado.');
  }

  const job = await db.query.jobs.findFirst({ where: eq(jobs.id, shift.jobId) });
  if (!job) {
    throw new HttpError(404, 'Vaga não encontrada.');
  }

  const company = await db.query.companies.findFirst({ where: eq(companies.id, job.companyId) });
  if (!company || company.ownerUserId !== ownerUserId) {
    throw new HttpError(403, 'Você não tem acesso a esse turno.');
  }

  const payment = await db.query.payments.findFirst({ where: eq(payments.shiftId, shiftId) });
  if (!payment) {
    throw new HttpError(404, 'Pagamento não encontrado.');
  }
  if (payment.status !== 'charged') {
    throw new HttpError(400, 'Esse pagamento não está pronto pra ser liberado.');
  }

  // UPDATE condicional primeiro, chamada ao gateway só depois de vencer
  // essa corrida — se fosse ao contrário, duas chamadas simultâneas
  // passariam ambas pela checagem `status === 'charged'` acima e as
  // duas chamariam `gateway.release()`, liberando o pagamento em
  // dobro no PSP (só uma delas venceria o UPDATE depois). Inofensivo
  // enquanto o gateway for mock, mas seria dinheiro de verdade saindo
  // duas vezes assim que existir um PSP real.
  const [updated] = await db
    .update(payments)
    .set({ status: 'released', releasedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(payments.id, payment.id), eq(payments.status, 'charged')))
    .returning();
  if (!updated) {
    throw new HttpError(400, 'Esse pagamento não está pronto pra ser liberado.');
  }

  if (updated.pspChargeId) {
    await gateway.release(updated.pspChargeId);
  }

  return toPaymentResponse(updated);
}
