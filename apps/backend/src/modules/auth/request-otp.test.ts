import { describe, expect, it, vi } from 'vitest';
import { InMemoryOtpCodeStore } from './otp-code-store';
import { requestOtp } from './request-otp';
import { OtpSender } from './otp-sender';

function createFakeSender(): OtpSender & { sentTo: string[] } {
  const sentTo: string[] = [];
  return {
    sentTo,
    async send(phone: string) {
      sentTo.push(phone);
    },
  };
}

describe('requestOtp', () => {
  it('rejeita celular ausente', async () => {
    const store = new InMemoryOtpCodeStore();
    const sender = createFakeSender();

    await expect(requestOtp(undefined, store, sender)).rejects.toThrow('Celular inválido');
  });

  it('rejeita celular em formato inválido', async () => {
    const store = new InMemoryOtpCodeStore();
    const sender = createFakeSender();

    await expect(requestOtp('11999990000', store, sender)).rejects.toThrow('Celular inválido');
  });

  it('gera e envia um código pra um celular válido', async () => {
    const store = new InMemoryOtpCodeStore();
    const sender = createFakeSender();
    const phone = '+5511999990001';

    await requestOtp(phone, store, sender);

    const saved = await store.find(phone);
    expect(saved?.code).toMatch(/^\d{6}$/);
    expect(sender.sentTo).toContain(phone);
  });

  it('bloqueia um segundo pedido dentro do período de cooldown', async () => {
    const store = new InMemoryOtpCodeStore();
    const sender = createFakeSender();
    const phone = '+5511999990002';

    await requestOtp(phone, store, sender);

    await expect(requestOtp(phone, store, sender)).rejects.toThrow('Aguarde');
  });

  it('permite novo pedido depois que o cooldown expira', async () => {
    vi.useFakeTimers();
    const store = new InMemoryOtpCodeStore();
    const sender = createFakeSender();
    const phone = '+5511999990003';

    await requestOtp(phone, store, sender);
    vi.advanceTimersByTime(61_000);
    await requestOtp(phone, store, sender);

    expect(sender.sentTo).toHaveLength(2);
    vi.useRealTimers();
  });
});
