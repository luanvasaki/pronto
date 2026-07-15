import { describe, expect, it } from 'vitest';
import { formatBenefitLabel } from './benefits';

describe('formatBenefitLabel', () => {
  it('retorna null quando a vaga não oferece o benefício', () => {
    expect(formatBenefitLabel('none', null, 'Alimentação')).toBeNull();
  });

  it('indica "no local" quando o benefício é fornecido sem valor', () => {
    expect(formatBenefitLabel('on_site', null, 'Alimentação')).toBe('Alimentação no local');
  });

  it('mostra o valor formatado em reais quando o benefício é pago', () => {
    expect(formatBenefitLabel('paid', '20.00', 'Alimentação')).toBe('Alimentação: R$\xa020,00');
  });

  it('não mostra nada (não "no local") se o benefício é pago mas não veio valor — dado inconsistente, não devia acontecer', () => {
    expect(formatBenefitLabel('paid', null, 'Transporte')).toBeNull();
  });
});
