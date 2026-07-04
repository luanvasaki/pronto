import { eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { payments } from '../../db/schema';
import { PaymentGateway } from './payment-gateway';

/**
 * Chamado depois que o check-out marca o turno como concluído — cria
 * a cobrança pendente e tenta debitar na hora. Falha na cobrança não
 * derruba o check-out (o trabalhador já saiu do turno); o pagamento
 * fica "failed" pra alguém revisar depois em vez de travar a resposta.
 */
export async function chargeForShift(gateway: PaymentGateway, shiftId: string, amount: string): Promise<void> {
  const [payment] = await db.insert(payments).values({ shiftId, amount, status: 'pending' }).returning();
  if (!payment) return;

  try {
    const { pspChargeId } = await gateway.charge(amount);
    await db
      .update(payments)
      .set({ status: 'charged', pspChargeId, chargedAt: new Date(), updatedAt: new Date() })
      .where(eq(payments.id, payment.id));
  } catch {
    await db.update(payments).set({ status: 'failed', updatedAt: new Date() }).where(eq(payments.id, payment.id));
  }
}
