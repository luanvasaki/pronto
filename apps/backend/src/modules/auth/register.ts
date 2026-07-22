import { eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { users } from '../../db/schema';
import { HttpError } from '../../shared/errors/http-error';
import { isUniqueViolation } from '../../shared/is-unique-violation';
import { isValidEmail } from './email';
import { IssuedTokens, issueTokens } from './issue-tokens';
import { hashPassword, isValidPassword } from './password';
import { toUserResponse, UserResponse } from './user-response';

export interface RegisterResult extends IssuedTokens {
  user: UserResponse;
}

/**
 * Criar a conta não exige mais aceite de termos aqui — isso virou uma
 * tela própria depois do cadastro (`PUT /auth/accept-terms`, ver
 * accept-terms.ts), documento completo e versionado, em vez de um
 * checkbox solto no mesmo formulário de email/senha. Cobre também quem
 * entra pela primeira vez via Google (ver google-login.ts) através do
 * mesmo gate no layout autenticado do front.
 */
export async function register(email: string | undefined, password: string | undefined): Promise<RegisterResult> {
  if (!email || !isValidEmail(email)) {
    throw new HttpError(400, 'E-mail inválido.');
  }
  if (!password || !isValidPassword(password)) {
    throw new HttpError(400, 'Senha deve ter entre 8 e 72 caracteres.');
  }

  const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (existing) {
    throw new HttpError(409, 'Já existe uma conta com este e-mail.');
  }

  const passwordHash = await hashPassword(password);
  let createdUser;
  try {
    [createdUser] = await db.insert(users).values({ email, passwordHash }).returning();
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
