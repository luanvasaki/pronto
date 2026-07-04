import { inArray } from 'drizzle-orm';
import { db } from '../../db/client';
import { payments } from '../../db/schema';
import { PaymentResponse, toPaymentResponse } from './payment-response';

/** Usado por list-my-shifts e list-job-applications pra embutir o pagamento de cada turno sem round-trip extra. */
export async function getPaymentsByShiftIds(shiftIds: string[]): Promise<Map<string, PaymentResponse>> {
  if (shiftIds.length === 0) return new Map();

  const rows = await db.query.payments.findMany({ where: inArray(payments.shiftId, shiftIds) });
  return new Map(rows.map((row) => [row.shiftId, toPaymentResponse(row)]));
}
