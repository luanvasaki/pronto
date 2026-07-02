import { ConsoleOtpSender, OtpSender } from './otp-sender';

/**
 * Único lugar que decide qual implementação de OtpSender usar.
 * Hoje só existe o mock — quando houver conta num provedor real,
 * esta função ganha um `if (env.otpProvider === 'twilio') ...`,
 * e nada fora daqui muda.
 */
export function createOtpSender(): OtpSender {
  return new ConsoleOtpSender();
}
