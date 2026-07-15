export type BenefitProvision = 'none' | 'on_site' | 'paid';

const CURRENCY_FORMATTER = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/**
 * Rótulo de exibição pra alimentação/transporte — null quando a vaga
 * não oferece o benefício. `provision: 'paid'` sem `amount` não devia
 * acontecer (job-input-validation.ts exige o valor nesse caso), mas se
 * chegar aqui mesmo assim (dado legado, chamada indireta), cai pra
 * null em vez de mostrar "no local" — mostrar a informação errada é
 * pior que não mostrar nada.
 */
export function formatBenefitLabel(provision: BenefitProvision, amount: string | null, label: string): string | null {
  if (provision === 'none') return null;
  if (provision === 'on_site') return `${label} no local`;
  return amount ? `${label}: ${CURRENCY_FORMATTER.format(Number(amount))}` : null;
}
