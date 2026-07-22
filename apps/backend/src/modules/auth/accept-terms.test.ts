import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../../db/client';
import { consentDocuments, users } from '../../db/schema';
import { acceptTerms } from './accept-terms';

// Fixture única entre arquivos de teste (ver README).
const TEST_EMAIL = 'accept-terms-test@example.com';
const TEST_DOCUMENT_VERSION = 'at-test-0.1';

async function createTestUser() {
  const [user] = await db.insert(users).values({ email: TEST_EMAIL }).returning();
  return user;
}

describe('acceptTerms', () => {
  afterEach(async () => {
    await db.delete(users).where(eq(users.email, TEST_EMAIL));
    await db.delete(consentDocuments).where(eq(consentDocuments.version, TEST_DOCUMENT_VERSION));
  });

  it('exige a versão no corpo', async () => {
    const user = await createTestUser();

    await expect(acceptTerms(user.id, undefined, '203.0.113.1', 'test-agent')).rejects.toThrow(
      'Versão do termo é obrigatória',
    );
  });

  it('rejeita quando a versão enviada não é a mais recente de platform_terms', async () => {
    await db.insert(consentDocuments).values({
      type: 'platform_terms',
      version: TEST_DOCUMENT_VERSION,
      chapters: [{ number: '1', heading: 'Teste', body: 'Corpo de teste.' }],
      declaration: 'Declaração de teste.',
    });
    const user = await createTestUser();

    await expect(acceptTerms(user.id, 'versao-velha-inexistente', '203.0.113.1', 'test-agent')).rejects.toThrow(
      'A versão do termo mudou',
    );
  });

  it('grava versão, IP, user-agent e o momento do aceite quando a versão bate com a mais recente', async () => {
    await db.insert(consentDocuments).values({
      type: 'platform_terms',
      version: TEST_DOCUMENT_VERSION,
      chapters: [{ number: '1', heading: 'Teste', body: 'Corpo de teste.' }],
      declaration: 'Declaração de teste.',
    });
    const user = await createTestUser();
    const before = new Date();

    const result = await acceptTerms(user.id, TEST_DOCUMENT_VERSION, '203.0.113.1', 'test-agent');

    expect(result.termsVersion).toBe(TEST_DOCUMENT_VERSION);
    const updated = await db.query.users.findFirst({ where: eq(users.id, user.id) });
    expect(updated?.termsVersion).toBe(TEST_DOCUMENT_VERSION);
    expect(updated?.termsAcceptedAt).not.toBeNull();
    expect(updated!.termsAcceptedAt!.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(updated?.termsIpAddress).toBe('203.0.113.1');
    expect(updated?.termsUserAgent).toBe('test-agent');
  });
});
