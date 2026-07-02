import { HttpError } from '../../shared/errors/http-error';
import { generateOtpCode } from './otp-code';
import { OtpCodeStore } from './otp-code-store';
import { OtpSender } from './otp-sender';

const CODE_TTL_MS = 5 * 60 * 1000;
const COOLDOWN_MS = 60 * 1000;
const PHONE_PATTERN = /^\+\d{10,15}$/;

export function isValidPhone(phone: string): boolean {
  return PHONE_PATTERN.test(phone);
}

/**
 * Regra de negócio pura — não sabe nada de Express. O controller só
 * traduz HTTP para esta chamada, o que permite testar cooldown e
 * expiração sem subir servidor nenhum.
 */
export async function requestOtp(
  phone: string | undefined,
  store: OtpCodeStore,
  sender: OtpSender,
): Promise<void> {
  if (!phone || !isValidPhone(phone)) {
    throw new HttpError(400, 'Celular inválido. Use o formato +5511999999999.');
  }

  const now = Date.now();
  const existing = await store.find(phone);
  if (existing && now - existing.createdAt.getTime() < COOLDOWN_MS) {
    throw new HttpError(429, 'Aguarde antes de pedir um novo código.');
  }

  const code = generateOtpCode();
  await store.save(phone, {
    code,
    createdAt: new Date(now),
    expiresAt: new Date(now + CODE_TTL_MS),
    attempts: 0,
  });

  await sender.send(phone, code);
}
