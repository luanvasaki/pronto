import { eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { users } from '../../db/schema';
import { HttpError } from '../../shared/errors/http-error';
import { GoogleTokenVerifier } from './google-token-verifier';
import { IssuedTokens, issueTokens } from './issue-tokens';
import { toUserResponse, UserResponse } from './user-response';

export interface GoogleLoginResult extends IssuedTokens {
  user: UserResponse;
}

/** Mesmo motivo/padrão de register.ts — fecha a corrida de dois logins Google simultâneos criando conta nova. */
function isUniqueViolation(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const code = (error as { code?: unknown }).code;
  const causeCode = (error.cause as { code?: unknown } | undefined)?.code;
  return code === '23505' || causeCode === '23505';
}

/**
 * Não linka automaticamente por e-mail com uma conta de senha existente:
 * o registro por e-mail+senha não tem confirmação de dono do e-mail, então
 * linkar cegamente abriria uma conta pro dono verdadeiro (via Google) cair
 * numa conta que outra pessoa já controla pela senha. Se o e-mail já
 * pertence a uma conta sem `googleId`, pede pra entrar por senha em vez
 * de logar automaticamente.
 */
export async function googleLogin(
  idToken: string | undefined,
  termsAccepted: boolean | undefined,
  verifier: GoogleTokenVerifier,
): Promise<GoogleLoginResult> {
  if (!idToken) {
    throw new HttpError(400, 'Token do Google ausente.');
  }

  let googleUser;
  try {
    googleUser = await verifier.verify(idToken);
  } catch (error) {
    // UnconfiguredGoogleTokenVerifier já lança HttpError (503) — só
    // token realmente inválido/malformado deve virar 401 aqui.
    if (error instanceof HttpError) {
      throw error;
    }
    throw new HttpError(401, 'Token do Google inválido.');
  }

  if (!googleUser.emailVerified) {
    throw new HttpError(401, 'E-mail do Google não verificado.');
  }

  const byGoogleId = await db.query.users.findFirst({ where: eq(users.googleId, googleUser.googleId) });
  if (byGoogleId) {
    const tokens = await issueTokens(byGoogleId.id);
    return { user: toUserResponse(byGoogleId), ...tokens };
  }

  const byEmail = await db.query.users.findFirst({ where: eq(users.email, googleUser.email) });
  if (byEmail) {
    throw new HttpError(
      409,
      'Já existe uma conta com senha para este e-mail. Entre com e-mail e senha.',
    );
  }

  // Só exige aceite dos termos na criação da conta — quem já tem conta
  // via Google não precisa aceitar de novo a cada login.
  if (!termsAccepted) {
    throw new HttpError(400, 'É preciso aceitar os Termos de Uso para criar uma conta.');
  }

  let createdUser;
  try {
    [createdUser] = await db
      .insert(users)
      .values({
        email: googleUser.email,
        googleId: googleUser.googleId,
        googlePhotoUrl: googleUser.picture,
        termsAcceptedAt: new Date(),
      })
      .returning();
  } catch (error) {
    // Duas abas/cliques simultâneos no mesmo login Google: a segunda
    // chamada perde a corrida do índice único, mas a conta que a
    // primeira acabou de criar já existe de verdade — melhor logar
    // nela do que devolver erro pra quem só clicou duas vezes.
    if (isUniqueViolation(error)) {
      const raceWinner = await db.query.users.findFirst({ where: eq(users.googleId, googleUser.googleId) });
      if (raceWinner) {
        const tokens = await issueTokens(raceWinner.id);
        return { user: toUserResponse(raceWinner), ...tokens };
      }
    }
    throw error;
  }
  if (!createdUser) {
    throw new HttpError(500, 'Falha ao criar usuário.');
  }

  const tokens = await issueTokens(createdUser.id);
  return { user: toUserResponse(createdUser), ...tokens };
}
