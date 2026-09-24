/**
 * "Como você conheceu a Pronto?" — mesmas opções pro cadastro de
 * trabalhador e de empresa (ver db/schema/referral-source.ts).
 */
export const REFERRAL_SOURCES = ['instagram', 'referral', 'google_search', 'other'] as const;
export type ReferralSource = (typeof REFERRAL_SOURCES)[number];

export function isReferralSource(value: string): value is ReferralSource {
  return (REFERRAL_SOURCES as readonly string[]).includes(value);
}
