import { eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { users } from '../../db/schema';
import { HttpError } from '../../shared/errors/http-error';
import { IssuedTokens, issueTokens } from './issue-tokens';
import { hashPassword, verifyPassword } from './password';
import { toUserResponse, UserResponse } from './user-response';

export interface LoginResult extends IssuedTokens {
  user: UserResponse;
}

const INVALID_CREDENTIALS_MESSAGE = 'E-mail ou senha inválidos.';

// Hash fixo (calculado uma vez, nunca de uma senha real) só pra manter o
// tempo do bcrypt.compare parecido entre "usuário não existe" e "senha
// errada" — sem isso, dá pra descobrir por timing se um e-mail está
// cadastrado.
let dummyHashPromise: Promise<string> | undefined;
function getDummyHash(): Promise<string> {
  if (!dummyHashPromise) {
    dummyHashPromise = hashPassword('dummy-password-for-timing-safety');
  }
  return dummyHashPromise;
}

export async function login(
  email: string | undefined,
  password: string | undefined,
): Promise<LoginResult> {
  if (!email || !password) {
    throw new HttpError(400, INVALID_CREDENTIALS_MESSAGE);
  }

  const user = await db.query.users.findFirst({ where: eq(users.email, email) });
  const hashToCompare = user?.passwordHash ?? (await getDummyHash());
  const passwordMatches = await verifyPassword(password, hashToCompare);

  if (!user || !user.passwordHash || !passwordMatches) {
    throw new HttpError(401, INVALID_CREDENTIALS_MESSAGE);
  }

  const tokens = await issueTokens(user.id);
  return { user: toUserResponse(user), ...tokens };
}
