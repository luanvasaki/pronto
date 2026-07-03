import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../../db/client';
import { users } from '../../db/schema';
import { InMemoryOtpCodeStore, StoredOtpCode } from './otp-code-store';
import { verifyOtp } from './verify-otp';

// Fixtures únicas entre arquivos de teste (ver README).
const NEW_USER_PHONE = '+5511900001111';
const EXISTING_USER_PHONE = '+5511900001112';

function validEntry(code = '123456'): StoredOtpCode {
  return { code, createdAt: new Date(), expiresAt: new Date(Date.now() + 60_000), attempts: 0 };
}

describe('verifyOtp', () => {
  afterEach(async () => {
    await db.delete(users).where(eq(users.phone, NEW_USER_PHONE));
    await db.delete(users).where(eq(users.phone, EXISTING_USER_PHONE));
  });

  it('rejeita celular ou código ausente/mal formatado', async () => {
    const store = new InMemoryOtpCodeStore();

    await expect(verifyOtp(undefined, '123456', store)).rejects.toThrow('Celular ou código');
    await expect(verifyOtp(NEW_USER_PHONE, '12', store)).rejects.toThrow('Celular ou código');
  });

  it('rejeita quando não há código pedido pra esse celular', async () => {
    const store = new InMemoryOtpCodeStore();

    await expect(verifyOtp(NEW_USER_PHONE, '123456', store)).rejects.toThrow(
      'Código inválido ou expirado',
    );
  });

  it('rejeita código expirado', async () => {
    const store = new InMemoryOtpCodeStore();
    await store.save(NEW_USER_PHONE, {
      code: '123456',
      createdAt: new Date(Date.now() - 10 * 60 * 1000),
      expiresAt: new Date(Date.now() - 5 * 60 * 1000),
      attempts: 0,
    });

    await expect(verifyOtp(NEW_USER_PHONE, '123456', store)).rejects.toThrow(
      'Código inválido ou expirado',
    );
  });

  it('bloqueia depois de 5 tentativas erradas, mesmo com o código certo na 6ª', async () => {
    const store = new InMemoryOtpCodeStore();
    await store.save(NEW_USER_PHONE, validEntry('123456'));

    for (let i = 0; i < 5; i += 1) {
      await expect(verifyOtp(NEW_USER_PHONE, '000000', store)).rejects.toThrow();
    }

    await expect(verifyOtp(NEW_USER_PHONE, '123456', store)).rejects.toThrow(
      'Código inválido ou expirado',
    );
  });

  it('cria um usuário novo quando o celular ainda não tem conta', async () => {
    const store = new InMemoryOtpCodeStore();
    await store.save(NEW_USER_PHONE, validEntry('123456'));

    const result = await verifyOtp(NEW_USER_PHONE, '123456', store);

    expect(result.isNewUser).toBe(true);
    expect(result.user.phone).toBe(NEW_USER_PHONE);
    expect(result.user.status).toBe('active');
    expect(result.accessToken).toEqual(expect.any(String));
    expect(result.refreshToken).toEqual(expect.any(String));
  });

  it('loga (não duplica) quando o celular já tem conta', async () => {
    const [existing] = await db.insert(users).values({ phone: EXISTING_USER_PHONE }).returning();
    const store = new InMemoryOtpCodeStore();
    await store.save(EXISTING_USER_PHONE, validEntry('123456'));

    const result = await verifyOtp(EXISTING_USER_PHONE, '123456', store);

    expect(result.isNewUser).toBe(false);
    expect(result.user.id).toBe(existing.id);
    expect(result.accessToken).toEqual(expect.any(String));
  });

  it('descarta o código depois de usado — não dá pra reusar', async () => {
    const store = new InMemoryOtpCodeStore();
    await store.save(NEW_USER_PHONE, validEntry('123456'));

    await verifyOtp(NEW_USER_PHONE, '123456', store);

    await expect(verifyOtp(NEW_USER_PHONE, '123456', store)).rejects.toThrow(
      'Código inválido ou expirado',
    );
  });
});
