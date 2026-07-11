import { eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { users } from '../../db/schema';
import { HttpError } from '../../shared/errors/http-error';
import { isValidEmail } from './email';
import { IssuedTokens, issueTokens } from './issue-tokens';
import { hashPassword, isValidPassword } from './password';
import { toUserResponse, UserResponse } from './user-response';

export interface RegisterResult extends IssuedTokens {
  user: UserResponse;
}

/**
 * A checagem de "já existe" acima previne o caso comum, mas não fecha a
 * corrida entre dois registros simultâneos com o mesmo e-mail (duplo
 * clique, aba duplicada) — as duas passam pela checagem antes de
 * qualquer insert terminar. O índice único do banco pega isso de
 * verdade; aqui só traduz o erro cru do Postgres pra mensagem amigável,
 * mesmo padrão de create-application.ts.
 */
function isUniqueViolation(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const code = (error as { code?: unknown }).code;
  const causeCode = (error.cause as { code?: unknown } | undefined)?.code;
  return code === '23505' || causeCode === '23505';
}

export async function register(
  email: string | undefined,
  password: string | undefined,
  termsAccepted: boolean | undefined,
): Promise<RegisterResult> {
  if (!email || !isValidEmail(email)) {
    throw new HttpError(400, 'E-mail inválido.');
  }
  if (!password || !isValidPassword(password)) {
    throw new HttpError(400, 'Senha deve ter entre 8 e 72 caracteres.');
  }
  if (!termsAccepted) {
    throw new HttpError(400, 'É preciso aceitar os Termos de Uso para criar uma conta.');
  }

  const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (existing) {
    throw new HttpError(409, 'Já existe uma conta com este e-mail.');
  }

  const passwordHash = await hashPassword(password);
  let createdUser;
  try {
    [createdUser] = await db
      .insert(users)
      .values({ email, passwordHash, termsAcceptedAt: new Date() })
      .returning();
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new HttpError(409, 'Já existe uma conta com este e-mail.');
    }
    throw error;
  }
  if (!createdUser) {
    throw new HttpError(500, 'Falha ao criar usuário.');
  }

  const tokens = await issueTokens(createdUser.id);
  return { user: toUserResponse(createdUser), ...tokens };
}
