import { describe, expect, it } from 'vitest';
import { createOtpSender } from './create-otp-sender';
import { ConsoleOtpSender } from './otp-sender';

describe('createOtpSender', () => {
  it('retorna o mock enquanto nenhum provedor real estiver configurado', () => {
    expect(createOtpSender()).toBeInstanceOf(ConsoleOtpSender);
  });
});
