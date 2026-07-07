export interface EmailSender {
  sendPasswordResetEmail(email: string, resetUrl: string): Promise<void>;
}

/**
 * Loga o link em vez de mandar e-mail de verdade — usado em dev/teste
 * até existir conta num provedor real (Resend). Mesmo papel do
 * ConsoleOtpSender que existia antes desse módulo trocar de SMS pra
 * e-mail.
 */
export class ConsoleEmailSender implements EmailSender {
  async sendPasswordResetEmail(email: string, resetUrl: string): Promise<void> {
    console.log(`[password-reset] link para ${email}: ${resetUrl}`);
  }
}
