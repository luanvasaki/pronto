import { payments } from '../../db/schema';

type PaymentRow = typeof payments.$inferSelect;

export interface PaymentResponse {
  id: string;
  shiftId: string;
  amount: string;
  status: string;
  chargedAt: Date | null;
  releasedAt: Date | null;
}

export function toPaymentResponse(payment: PaymentRow): PaymentResponse {
  return {
    id: payment.id,
    shiftId: payment.shiftId,
    amount: payment.amount,
    status: payment.status,
    chargedAt: payment.chargedAt,
    releasedAt: payment.releasedAt,
  };
}
