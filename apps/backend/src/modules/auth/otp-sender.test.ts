import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConsoleOtpSender } from './otp-sender';

describe('ConsoleOtpSender', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loga o código e o telefone', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const sender = new ConsoleOtpSender();

    await sender.send('+5511999990000', '123456');

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('123456'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('+5511999990000'));
  });
});
