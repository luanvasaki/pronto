import { eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { users } from '../../db/schema';
import { HttpError } from '../../shared/errors/http-error';

export interface FoundUser {
  id: string;
  email: string | null;
  fullName: string | null;
  isAdmin: boolean;
}

/**
 * Busca por igualdade exata, mesmo padrão de login/register/forgot-password
 * (ver auth/login.ts) — o e-mail não é normalizado em nenhum lugar do
 * sistema hoje, então buscar diferente aqui só criaria uma inconsistência
 * nova (encontrar aqui um usuário que nunca conseguiria logar com essa
 * grafia de e-mail).
 */
export async function findUserByEmail(email: string): Promise<FoundUser> {
  const user = await db.query.users.findFirst({ where: eq(users.email, email.trim()) });
  if (!user) {
    throw new HttpError(404, 'Nenhum usuário encontrado com esse e-mail.');
  }

  return { id: user.id, email: user.email, fullName: user.fullName, isAdmin: user.isAdmin };
}
