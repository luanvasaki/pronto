import { and, eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../../db/client';
import { consentDocuments, loginConsents, users } from '../../db/schema';
import { acceptLoginTerms } from './accept-login-terms';

// Fixture única entre arquivos de teste (ver README).
const TEST_EMAIL = 'accept-login-terms-test@example.com';
const TEST_DOCUMENT_VERSION = 'alt-test-0.1';

async function createTestUser() {
  const [user] = await db.insert(users).values({ email: TEST_EMAIL }).returning();
  return user;
}

async function seedLoginSummary(): Promise<void> {
  await db.insert(consentDocuments).values({
    type: 'login_summary',
    version: TEST_DOCUMENT_VERSION,
    chapters: [{ number: '1', heading: 'Teste', body: 'Corpo de teste.' }],
    declaration: 'Declaração de teste.',
  });
}

describe('acceptLoginTerms', () => {
  afterEach(async () => {
    const user = await db.query.users.findFirst({ where: eq(users.email, TEST_EMAIL) });
    if (user) {
      await db.delete(loginConsents).where(eq(loginConsents.userId, user.id));
    }
    await db.delete(users).where(eq(users.email, TEST_EMAIL));
    await db.delete(consentDocuments).where(eq(consentDocuments.version, TEST_DOCUMENT_VERSION));
  });

  it('rejeita quando a versão enviada não é a mais recente de login_summary', async () => {
    await seedLoginSummary();
    const user = await createTestUser();

    await expect(acceptLoginTerms(user.id, 'versao-velha-inexistente', '203.0.113.1', 'test-agent')).rejects.toThrow(
      'A versão do termo mudou',
    );
  });

  it('grava um registro de aceite com IP e user-agent', async () => {
    await seedLoginSummary();
    const user = await createTestUser();

    const result = await acceptLoginTerms(user.id, TEST_DOCUMENT_VERSION, '203.0.113.1', 'test-agent');

    expect(result.version).toBe(TEST_DOCUMENT_VERSION);
    const row = await db.query.loginConsents.findFirst({
      where: and(eq(loginConsents.userId, user.id), eq(loginConsents.version, TEST_DOCUMENT_VERSION)),
    });
    expect(row?.ipAddress).toBe('203.0.113.1');
    expect(row?.userAgent).toBe('test-agent');
  });

  it('não duplica o registro quando chamado duas vezes pra mesma versão', async () => {
    await seedLoginSummary();
    const user = await createTestUser();

    await acceptLoginTerms(user.id, TEST_DOCUMENT_VERSION, '203.0.113.1', 'test-agent');
    await acceptLoginTerms(user.id, TEST_DOCUMENT_VERSION, '203.0.113.2', 'test-agent-2');

    const rows = await db.query.loginConsents.findMany({
      where: and(eq(loginConsents.userId, user.id), eq(loginConsents.version, TEST_DOCUMENT_VERSION)),
    });
    expect(rows).toHaveLength(1);
  });
});
