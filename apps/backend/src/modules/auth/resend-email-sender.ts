import { Resend } from 'resend';
import { EmailSender } from './email-sender';

// Mesmos tokens de cor do app (ver apps/worker/src/app/globals.css, tema
// claro) — repetidos aqui porque e-mail não importa CSS de outro pacote.
const BRAND_PRIMARY = '#f5531e';
const BRAND_TEXT = '#1a1712';
const BRAND_TEXT_SECONDARY = '#7a7264';
const BRAND_BORDER = '#e4ded2';
const BRAND_BACKGROUND = '#f7f4ee';
const BRAND_SURFACE = '#ffffff';

/**
 * O motivo de rejeição é texto livre digitado por um admin — precisa ser
 * escapado antes de entrar no HTML do e-mail (mesmo não sendo uma fonte
 * hostil, um "<" ou "&" sem escape quebraria a renderização do e-mail).
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Template compartilhado por todos os e-mails transacionais — sem
 * imagem (a marca "pronto" é texto + CSS inline), pra não depender do
 * cliente de e-mail carregar imagem remota de um remetente novo
 * (Gmail/Outlook bloqueiam isso por padrão até o destinatário confiar
 * no remetente). Estilo sempre inline: `<style>` em bloco não é
 * suportado de forma confiável pelos clientes de e-mail mais usados.
 */
function renderEmail(bodyHtml: string): string {
  return `<div style="background-color:${BRAND_BACKGROUND};padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:480px;margin:0 auto;background-color:${BRAND_SURFACE};border:1px solid ${BRAND_BORDER};border-radius:12px;padding:32px 28px;">
    <div style="font-size:22px;font-weight:700;color:${BRAND_TEXT};margin-bottom:24px;">pr<span style="color:${BRAND_PRIMARY};">o</span>nto</div>
    <div style="font-size:15px;line-height:1.6;color:${BRAND_TEXT};">${bodyHtml}</div>
    <div style="margin-top:32px;padding-top:16px;border-top:1px solid ${BRAND_BORDER};font-size:12px;color:${BRAND_TEXT_SECONDARY};">Pronto — plataforma tecnológica de intermediação de trabalho avulso.</div>
  </div>
</div>`;
}

function renderButton(url: string, label: string): string {
  return `<p style="margin:24px 0;"><a href="${url}" style="display:inline-block;background-color:${BRAND_PRIMARY};color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 24px;border-radius:8px;">${label}</a></p>`;
}

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
      html: renderEmail(
        `<p>Recebemos um pedido pra redefinir a senha da sua conta na Pronto.</p>` +
          renderButton(resetUrl, 'Redefinir senha') +
          `<p style="color:${BRAND_TEXT_SECONDARY};font-size:13px;">Esse link expira em 1 hora e só pode ser usado uma vez. Se não foi você, pode ignorar este e-mail — sua senha continua a mesma.</p>`,
      ),
    });
  }

  async sendWelcomeEmail(email: string): Promise<void> {
    await this.resend.emails.send({
      from: this.fromEmail,
      to: email,
      subject: 'Bem-vindo(a) à Pronto!',
      html: renderEmail(
        `<p>Sua conta na Pronto foi criada.</p>` +
          `<p>Agora é só completar seu cadastro enviando seus dados, um documento e uma selfie — assim que aprovarmos, você já pode se candidatar às vagas disponíveis.</p>`,
      ),
    });
  }

  async sendKycApprovedEmail(email: string): Promise<void> {
    await this.resend.emails.send({
      from: this.fromEmail,
      to: email,
      subject: 'Seu cadastro foi aprovado!',
      html: renderEmail(
        `<p>Boas notícias: seus documentos foram aprovados.</p>` +
          `<p>Você já pode se candidatar às vagas disponíveis na Pronto.</p>`,
      ),
    });
  }

  async sendKycRejectedEmail(email: string, reason: string): Promise<void> {
    await this.resend.emails.send({
      from: this.fromEmail,
      to: email,
      subject: 'Seu documento precisa de ajuste',
      html: renderEmail(
        `<p>Um dos seus documentos enviados foi reprovado.</p>` +
          `<p style="background-color:${BRAND_BACKGROUND};border-radius:8px;padding:12px 16px;"><strong>Motivo:</strong> ${escapeHtml(reason)}</p>` +
          `<p>Acesse o app pra reenviar.</p>`,
      ),
    });
  }
}
