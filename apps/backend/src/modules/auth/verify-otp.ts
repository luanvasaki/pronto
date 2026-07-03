import { eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { users } from '../../db/schema';
import { HttpError } from '../../shared/errors/http-error';
import { issueTokens } from './issue-tokens';
import { OtpCodeStore } from './otp-code-store';
import { isValidPhone } from './request-otp';
import { toUserResponse, UserResponse } from './user-response';

const MAX_ATTEMPTS = 5;
const CODE_PATTERN = /^\d{6}$/;
const INVALID_CODE_MESSAGE = 'Código inválido ou expirado.';

export interface VerifyOtpResult {
  user: UserResponse;
  isNewUser: boolean;
  accessToken: string;
  refreshToken: string;
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
    const tokens = await issueTokens(existingUser.id);
    return { user: toUserResponse(existingUser), isNewUser: false, ...tokens };
  }

  const [createdUser] = await db
    .insert(users)
    .values({ phone, phoneVerifiedAt: new Date() })
    .returning();

  if (!createdUser) {
    throw new HttpError(500, 'Falha ao criar usuário.');
  }

  const tokens = await issueTokens(createdUser.id);
  return { user: toUserResponse(createdUser), isNewUser: true, ...tokens };
}
