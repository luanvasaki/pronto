'use client';

import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google';

export interface GoogleLoginButtonProps {
  onSuccess: (idToken: string) => void;
  onError: () => void;
}

// Client id não é secreto (só o client secret seria) — pode ir pro
// bundle do cliente sem problema, é assim que o Google espera receber.
const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

/**
 * Sem NEXT_PUBLIC_GOOGLE_CLIENT_ID configurada (antes de criar o OAuth
 * client no Google Cloud Console), não renderiza nada em vez de
 * quebrar a tela — o resto do formulário de login continua funcionando.
 */
export function GoogleLoginButton({ onSuccess, onError }: GoogleLoginButtonProps) {
  if (!CLIENT_ID) {
    return null;
  }

  return (
    <GoogleOAuthProvider clientId={CLIENT_ID}>
      <GoogleLogin
        onSuccess={(credentialResponse) => {
          if (credentialResponse.credential) {
            onSuccess(credentialResponse.credential);
          } else {
            onError();
          }
        }}
        onError={onError}
        width="384"
      />
    </GoogleOAuthProvider>
  );
}
