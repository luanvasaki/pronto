import { OAuth2Client } from 'google-auth-library';
import { HttpError } from '../../shared/errors/http-error';

export interface GoogleUserInfo {
  email: string;
  googleId: string;
  emailVerified: boolean;
  picture?: string;
}

export interface GoogleTokenVerifier {
  verify(idToken: string): Promise<GoogleUserInfo>;
}

/**
 * Verifica a assinatura e o `aud` do ID token direto com as chaves
 * públicas do Google (a própria lib cuida do cache/rotação delas) —
 * não precisa de client secret, só do client id configurado.
 */
export class RealGoogleTokenVerifier implements GoogleTokenVerifier {
  private readonly client: OAuth2Client;

  constructor(private readonly clientId: string) {
    this.client = new OAuth2Client(clientId);
  }

  async verify(idToken: string): Promise<GoogleUserInfo> {
    const ticket = await this.client.verifyIdToken({ idToken, audience: this.clientId });
    const payload = ticket.getPayload();

    if (!payload?.email || !payload.sub) {
      throw new Error('Token do Google sem email ou sub.');
    }

    return {
      email: payload.email,
      googleId: payload.sub,
      emailVerified: payload.email_verified ?? false,
      picture: payload.picture,
    };
  }
}

/**
 * Usado em dev/teste enquanto ninguém configurou GOOGLE_CLIENT_ID — o
 * app sobe normalmente (diferente de travar o boot), só falha se
 * alguém de fato tentar usar "Entrar com Google".
 */
export class UnconfiguredGoogleTokenVerifier implements GoogleTokenVerifier {
  async verify(): Promise<GoogleUserInfo> {
    throw new HttpError(503, 'Login com Google ainda não configurado.');
  }
}
