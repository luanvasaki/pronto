import { describe, expect, it } from 'vitest';
import { isValidOtpCode } from './otp-code';

describe('isValidOtpCode', () => {
  it('aceita exatamente 6 dígitos', () => {
    expect(isValidOtpCode('123456')).toBe(true);
  });

  it('rejeita mais ou menos de 6 dígitos', () => {
    expect(isValidOtpCode('12345')).toBe(false);
    expect(isValidOtpCode('1234567')).toBe(false);
    expect(isValidOtpCode('')).toBe(false);
  });
});
