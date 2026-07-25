import { and, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { jobs, payments, shifts } from '../../db/schema';
import { assertOwnsCompany } from '../../shared/assert-owns-company';
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

  await assertOwnsCompany(ownerUserId, job.companyId, 'Você não tem acesso a esse turno.');

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
    try {
      await gateway.release(updated.pspChargeId);
    } catch (error) {
      // Já vencemos a corrida (status virou "released" acima) — não dá
      // pra saber se o gateway processou antes de falhar, então não
      // reverte pra "charged" (reverter arriscaria uma segunda chamada
      // real ao PSP se a primeira tiver ido, só demorou a confirmar).
      // "failed" é o mesmo estado terminal que chargeForShift usa: sem
      // retry automático, mas visível pra um admin resolver na mão em
      // GET /admin/failed-payments (ver list-failed-payments.ts).
      console.error(`[releasePayment] liberação falhou pro pagamento ${updated.id}:`, error);
      await db
        .update(payments)
        .set({ status: 'failed', updatedAt: new Date() })
        .where(eq(payments.id, updated.id));
      throw new HttpError(
        502,
        'Não foi possível confirmar a liberação no gateway de pagamento. Um admin foi notificado.',
      );
    }
  }

  return toPaymentResponse(updated);
}
