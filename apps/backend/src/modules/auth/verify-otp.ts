import { eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { users } from '../../db/schema';
import { HttpError } from '../../shared/errors/http-error';
import { OtpCodeStore } from './otp-code-store';
import { isValidPhone } from './request-otp';

const MAX_ATTEMPTS = 5;
const CODE_PATTERN = /^\d{6}$/;
const INVALID_CODE_MESSAGE = 'Código inválido ou expirado.';

export interface VerifyOtpResult {
  user: { id: string; phone: string; status: string };
  isNewUser: boolean;
}

/**
 * Toca o banco direto (sem repositório no meio) — mesma convenção já
 * usada nos testes de schema: um único consumidor não justifica uma
 * camada de abstração extra ainda.
 */
export async function verifyOtp(
  phone: string | undefined,
  code: string | undefined,
  store: OtpCodeStore,
): Promise<VerifyOtpResult> {
  if (!phone || !isValidPhone(phone) || !code || !CODE_PATTERN.test(code)) {
    throw new HttpError(400, 'Celular ou código inválido.');
  }

  const entry = await store.find(phone);
  if (!entry) {
    throw new HttpError(401, INVALID_CODE_MESSAGE);
  }

  if (Date.now() > entry.expiresAt.getTime() || entry.attempts >= MAX_ATTEMPTS) {
    await store.delete(phone);
    throw new HttpError(401, INVALID_CODE_MESSAGE);
  }

  if (entry.code !== code) {
    await store.save(phone, { ...entry, attempts: entry.attempts + 1 });
    throw new HttpError(401, INVALID_CODE_MESSAGE);
  }

  await store.delete(phone);

  const existingUser = await db.query.users.findFirst({ where: eq(users.phone, phone) });
  if (existingUser) {
    return { user: toUserResponse(existingUser), isNewUser: false };
  }

  const [createdUser] = await db
    .insert(users)
    .values({ phone, phoneVerifiedAt: new Date() })
    .returning();

  if (!createdUser) {
    throw new HttpError(500, 'Falha ao criar usuário.');
  }

  return { user: toUserResponse(createdUser), isNewUser: true };
}

function toUserResponse(user: typeof users.$inferSelect): VerifyOtpResult['user'] {
  return { id: user.id, phone: user.phone, status: user.status };
}
