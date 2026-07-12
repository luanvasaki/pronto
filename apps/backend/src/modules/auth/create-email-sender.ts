import { env } from '../../config/env';
import { ConsoleEmailSender, EmailSender } from './email-sender';
import { ResendEmailSender } from './resend-email-sender';

/**
 * Único lugar que decide qual implementação de EmailSender usar —
 * mesmo padrão de createFileStorage()/createOtpSender() (extinto).
 *
 * `ConsoleEmailSender` loga o link de redefinição em texto puro — em
 * produção isso vira uma conta que assume qualquer usuário pra quem
 * tiver acesso aos logs, então travamos a subida em vez de deixar isso
 * vazar silenciosamente.
 */
export function createEmailSender(): EmailSender {
  if (env.resendApiKey) {
    return new ResendEmailSender(env.resendApiKey, env.resendFromEmail);
  }

  if (env.nodeEnv === 'production') {
    throw new Error(
      'RESEND_API_KEY não configurada — ConsoleEmailSender não pode rodar em produção (vazaria o link de redefinição de senha nos logs).',
    );
  }

  console.warn(
    '[createEmailSender] RESEND_API_KEY não configurada — caindo pro ConsoleEmailSender (loga o link de redefinição em texto puro, não envia e-mail de verdade). ' +
      'Isso é esperado em dev/teste. Se essa mensagem aparecer nos logs de PRODUÇÃO, significa que o envio de e-mail real está QUEBRADO (verifique NODE_ENV e RESEND_API_KEY no ambiente de deploy).',
  );

  return new ConsoleEmailSender();
}
