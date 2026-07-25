export interface EmailSender {
  sendPasswordResetEmail(email: string, resetUrl: string): Promise<void>;
  sendWelcomeEmail(email: string): Promise<void>;
  sendKycApprovedEmail(email: string): Promise<void>;
  sendKycRejectedEmail(email: string, reason: string): Promise<void>;
}

/**
 * Loga o link/aviso em vez de mandar e-mail de verdade — usado em dev/teste
 * até existir conta num provedor real (Resend). Mesmo papel do
 * ConsoleOtpSender que existia antes desse módulo trocar de SMS pra
 * e-mail.
 */
export class ConsoleEmailSender implements EmailSender {
  async sendPasswordResetEmail(email: string, resetUrl: string): Promise<void> {
    console.log(`[password-reset] link para ${email}: ${resetUrl}`);
  }

  async sendWelcomeEmail(email: string): Promise<void> {
    console.log(`[welcome-email] boas-vindas para ${email}`);
  }

  async sendKycApprovedEmail(email: string): Promise<void> {
    console.log(`[kyc-approved] cadastro aprovado para ${email}`);
  }

  async sendKycRejectedEmail(email: string, reason: string): Promise<void> {
    console.log(`[kyc-rejected] documento reprovado para ${email}: ${reason}`);
  }
}
