import { randomUUID } from 'node:crypto';

export interface PaymentGateway {
  charge(amount: string): Promise<{ pspChargeId: string }>;
  release(pspChargeId: string): Promise<void>;
}

/**
 * Simula sucesso imediato de cobrança e liberação — mesmo padrão do
 * ConsoleOtpSender (T2.1): sem conta configurada num PSP real
 * (Pagar.me/Iugu) ainda, isto é o que roda em dev/teste. Nenhum código
 * que dependa de PaymentGateway precisa saber disso.
 */
export class MockPaymentGateway implements PaymentGateway {
  async charge(_amount: string): Promise<{ pspChargeId: string }> {
    return { pspChargeId: `mock_${randomUUID()}` };
  }

  async release(_pspChargeId: string): Promise<void> {
    // no-op — um provedor real confirmaria a liberação aqui.
  }
}
