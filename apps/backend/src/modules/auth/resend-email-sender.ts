import { Resend } from 'resend';
import { EmailSender } from './email-sender';

export class ResendEmailSender implements EmailSender {
  private readonly resend: Resend;

  constructor(
    apiKey: string,
    private readonly fromEmail: string,
  ) {
    this.resend = new Resend(apiKey);
  }

  async sendPasswordResetEmail(email: string, resetUrl: string): Promise<void> {
    await this.resend.emails.send({
      from: this.fromEmail,
      to: email,
      subject: 'Redefinir sua senha',
      html: `<p>Clique para redefinir sua senha: <a href="${resetUrl}">${resetUrl}</a></p><p>Se não foi você, ignore este e-mail.</p>`,
    });
  }
}
