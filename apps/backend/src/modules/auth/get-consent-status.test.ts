import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../../db/client';
import { consentDocuments, loginConsents, users } from '../../db/schema';
import { getConsentStatus } from './get-consent-status';

// Fixture única entre arquivos de teste (ver README).
const TEST_EMAIL = 'get-consent-status-test@example.com';
const TERMS_VERSION = 'gcs-terms-0.1';
const LOGIN_VERSION = 'gcs-login-0.1';

async function createTestUser(termsVersion?: string) {
  const [user] = await db.insert(users).values({ email: TEST_EMAIL, termsVersion }).returning();
  return user;
}

describe('getConsentStatus', () => {
  afterEach(async () => {
    const user = await db.query.users.findFirst({ where: eq(users.email, TEST_EMAIL) });
    if (user) {
      await db.delete(loginConsents).where(eq(loginConsents.userId, user.id));
    }
    await db.delete(users).where(eq(users.email, TEST_EMAIL));
    await db.delete(consentDocuments).where(eq(consentDocuments.version, TERMS_VERSION));
    await db.delete(consentDocuments).where(eq(consentDocuments.version, LOGIN_VERSION));
  });

  it('needsTermsAcceptance é true e hasAcceptedLoginTerms é false pra quem nunca aceitou nada', async () => {
    await db.insert(consentDocuments).values([
      {
        type: 'platform_terms',
        version: TERMS_VERSION,
        chapters: [{ number: '1', heading: 'T', body: 'B' }],
        declaration: 'D',
      },
      {
        type: 'login_summary',
        version: LOGIN_VERSION,
        chapters: [{ number: '1', heading: 'T', body: 'B' }],
        declaration: 'D',
      },
    ]);
    const user = await createTestUser();

    const status = await getConsentStatus(user.id);

    expect(status.needsTermsAcceptance).toBe(true);
    expect(status.hasAcceptedLoginTerms).toBe(false);
  });

  it('needsTermsAcceptance é true pra quem aceitou uma versão antiga', async () => {
    await db.insert(consentDocuments).values({
      type: 'platform_terms',
      version: TERMS_VERSION,
      chapters: [{ number: '1', heading: 'T', body: 'B' }],
      declaration: 'D',
    });
    const user = await createTestUser('versao-bem-antiga');

    const status = await getConsentStatus(user.id);

    expect(status.needsTermsAcceptance).toBe(true);
  });

  it('needsTermsAcceptance é false pra quem já aceitou a versão vigente', async () => {
    await db.insert(consentDocuments).values({
      type: 'platform_terms',
      version: TERMS_VERSION,
      chapters: [{ number: '1', heading: 'T', body: 'B' }],
      declaration: 'D',
    });
    const user = await createTestUser(TERMS_VERSION);

    const status = await getConsentStatus(user.id);

    expect(status.needsTermsAcceptance).toBe(false);
  });

  it('hasAcceptedLoginTerms é true depois de um registro em login_consents pra versão vigente', async () => {
    await db.insert(consentDocuments).values({
      type: 'login_summary',
      version: LOGIN_VERSION,
      chapters: [{ number: '1', heading: 'T', body: 'B' }],
      declaration: 'D',
    });
    const user = await createTestUser();
    await db.insert(loginConsents).values({ userId: user.id, version: LOGIN_VERSION });

    const status = await getConsentStatus(user.id);

    expect(status.hasAcceptedLoginTerms).toBe(true);
  });

});
