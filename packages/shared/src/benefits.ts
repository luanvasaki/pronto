export type BenefitProvision = 'none' | 'on_site' | 'paid';

const CURRENCY_FORMATTER = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** Rótulo de exibição pra alimentação/transporte — null quando a vaga não oferece o benefício. */
export function formatBenefitLabel(provision: BenefitProvision, amount: string | null, label: string): string | null {
  if (provision === 'none') return null;
  if (provision === 'paid' && amount) return `${label}: ${CURRENCY_FORMATTER.format(Number(amount))}`;
  return `${label} no local`;
}
