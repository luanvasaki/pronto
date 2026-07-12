import { env } from '../../config/env';
import { GoogleTokenVerifier, RealGoogleTokenVerifier, UnconfiguredGoogleTokenVerifier } from './google-token-verifier';

/**
 * Único lugar que decide o verificador de token do Google — mesmo
 * padrão de createEmailSender()/createFileStorage(). Em produção,
 * exige a variável (não tem como oferecer um fallback seguro pra
 * "Entrar com Google" sem client id configurado). Em dev/teste sem a
 * variável, cai num verificador que só falha se alguém tentar usar de
 * verdade — não trava o boot do servidor nem os testes que não tocam
 * nessa rota.
 */
export function createGoogleTokenVerifier(): GoogleTokenVerifier {
  if (env.googleClientId) {
    return new RealGoogleTokenVerifier(env.googleClientId);
  }

  if (env.nodeEnv === 'production') {
    throw new Error(
      'GOOGLE_CLIENT_ID não configurada — "Entrar com Google" não pode rodar em produção sem isso.',
    );
  }

  console.warn(
    '[createGoogleTokenVerifier] GOOGLE_CLIENT_ID não configurada — caindo pro UnconfiguredGoogleTokenVerifier ("Entrar com Google" vai falhar em qualquer tentativa real). ' +
      'Isso é esperado em dev/teste. Se essa mensagem aparecer nos logs de PRODUÇÃO, significa que o login com Google está QUEBRADO (verifique NODE_ENV e GOOGLE_CLIENT_ID no ambiente de deploy).',
  );

  return new UnconfiguredGoogleTokenVerifier();
}
