import { randomInt } from 'node:crypto';

const OTP_LENGTH = 6;

/** Código numérico de 6 dígitos, aleatoriedade criptográfica (não Math.random). */
export function generateOtpCode(): string {
  return randomInt(0, 10 ** OTP_LENGTH).toString().padStart(OTP_LENGTH, '0');
}
