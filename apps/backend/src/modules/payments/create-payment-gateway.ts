import { MockPaymentGateway, PaymentGateway } from './payment-gateway';

/**
 * Único lugar que decide qual implementação de PaymentGateway usar.
 * Hoje só existe o mock — quando houver conta num PSP real, esta
 * função ganha um `if (env.paymentProvider === 'pagarme') ...`, e nada
 * fora daqui muda.
 */
export function createPaymentGateway(): PaymentGateway {
  return new MockPaymentGateway();
}
