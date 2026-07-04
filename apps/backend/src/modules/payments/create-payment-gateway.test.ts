import { describe, expect, it } from 'vitest';
import { createPaymentGateway } from './create-payment-gateway';
import { MockPaymentGateway } from './payment-gateway';

describe('createPaymentGateway', () => {
  it('retorna o mock', () => {
    expect(createPaymentGateway()).toBeInstanceOf(MockPaymentGateway);
  });
});
