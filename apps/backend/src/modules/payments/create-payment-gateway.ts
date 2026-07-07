import { MockPaymentGateway, PaymentGateway } from './payment-gateway';

/**
 * Único lugar que decide qual implementação de PaymentGateway usar.
 *
 * Hoje só existe o mock — e isso é decisão de produto, não dívida
 * técnica esquecida: split de pagamento via PSP (Pagar.me) exige CNPJ
 * e compliance fiscal, custo que não faz sentido pagar antes de validar
 * se o mercado adota a plataforma. Pra essa fase, empresa e trabalhador
 * combinam o pagamento diretamente entre si (ver rótulos de
 * `payment.status` no frontend, que refletem isso). O `PaymentGateway`
 * já é uma interface plugável — reintegrar um PSP real no futuro é só
 * trocar esta função, sem tocar em mais nada.
 */
export function createPaymentGateway(): PaymentGateway {
  return new MockPaymentGateway();
}
