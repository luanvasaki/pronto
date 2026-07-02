export interface OtpSender {
  send(phone: string, code: string): Promise<void>;
}

/**
 * Loga o código em vez de enviar SMS de verdade — usado em dev/teste
 * até existir conta num provedor real (Twilio, Zenvia...). Nenhum
 * código que dependa de OtpSender precisa saber disso.
 */
export class ConsoleOtpSender implements OtpSender {
  async send(phone: string, code: string): Promise<void> {
    console.log(`[otp] código ${code} para ${phone}`);
  }
}
