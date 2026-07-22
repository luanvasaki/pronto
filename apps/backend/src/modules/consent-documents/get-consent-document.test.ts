import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../../db/client';
import { consentDocuments } from '../../db/schema';
import { getLatestConsentDocument } from './get-consent-document';

// Prefixo único de teste — não colide com o seed real (que usa '1.1').
const TEST_VERSION_OLD = 'test-0.1';
const TEST_VERSION_NEW = 'test-0.2';

describe('getLatestConsentDocument', () => {
  afterEach(async () => {
    await db.delete(consentDocuments).where(eq(consentDocuments.version, TEST_VERSION_OLD));
    await db.delete(consentDocuments).where(eq(consentDocuments.version, TEST_VERSION_NEW));
  });

  it('devolve os capítulos e a declaração do documento', async () => {
    await db.insert(consentDocuments).values({
      type: 'minors_opportunity',
      version: TEST_VERSION_OLD,
      chapters: [{ number: '1', heading: 'Teste', body: 'Corpo de teste.' }],
      declaration: 'Declaração de teste.',
    });

    const result = await getLatestConsentDocument('minors_opportunity');

    expect(result.version).toBe(TEST_VERSION_OLD);
    expect(result.chapters).toEqual([{ number: '1', heading: 'Teste', body: 'Corpo de teste.' }]);
    expect(result.declaration).toBe('Declaração de teste.');
  });

  it('devolve sempre a versão mais recente, não a primeira inserida', async () => {
    await db.insert(consentDocuments).values({
      type: 'platform_terms',
      version: TEST_VERSION_OLD,
      chapters: [{ number: '1', heading: 'Antiga', body: 'Corpo antigo.' }],
      declaration: 'Declaração antiga.',
      createdAt: new Date(Date.now() - 60_000),
    });
    await db.insert(consentDocuments).values({
      type: 'platform_terms',
      version: TEST_VERSION_NEW,
      chapters: [{ number: '1', heading: 'Nova', body: 'Corpo novo.' }],
      declaration: 'Declaração nova.',
    });

    const result = await getLatestConsentDocument('platform_terms');

    expect(result.version).toBe(TEST_VERSION_NEW);
  });
});
