export interface ReferralSourceOption {
  value: string;
  label: string;
}

/**
 * "Como você conheceu a Pronto?" — mesmos valores de
 * apps/backend/src/shared/validation/referral-source.ts (duplicado de
 * propósito, front e back não importam um do outro). Usada no
 * cadastro/perfil do trabalhador e da empresa — mesmas opções pros dois.
 */
export const REFERRAL_SOURCE_OPTIONS: readonly ReferralSourceOption[] = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'referral', label: 'Indicação de amigo/conhecido' },
  { value: 'google_search', label: 'Busca no Google' },
  { value: 'other', label: 'Outro' },
];
