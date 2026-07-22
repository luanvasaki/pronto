import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useJobFormValidation } from './use-job-form-validation';

const TOMORROW = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
const TOMORROW_PLUS_5H = new Date(Date.now() + 29 * 60 * 60 * 1000).toISOString().slice(0, 16);

function baseInput() {
  return {
    categoryId: 'cat-1',
    requiresExperience: false,
    description: 'Descrição com mais de dez caracteres.',
    addressLabel: 'Vila Madalena, São Paulo',
    lat: -23.55,
    lng: -46.63,
    positionsTotal: '2',
    payAmount: '130.00',
    mealProvision: 'none' as const,
    mealAmount: '',
    transportProvision: 'none' as const,
    transportAmount: '',
    startsAt: TOMORROW,
    endsAt: TOMORROW_PLUS_5H,
    applicationsCloseAt: '',
    minorsAllowed: false,
    minorsTermsAccepted: false,
  };
}

describe('useJobFormValidation', () => {
  it('é válido quando todos os campos obrigatórios estão preenchidos', () => {
    const { result } = renderHook(() => useJobFormValidation(baseInput()));
    expect(result.current.isValid).toBe(true);
    expect(result.current.missingFields).toEqual([]);
  });

  it('lista categoria, descrição e localização faltando', () => {
    const { result } = renderHook(() =>
      useJobFormValidation({ ...baseInput(), categoryId: '', description: 'curta', lat: null, lng: null }),
    );
    expect(result.current.missingFields).toContain('categoria');
    expect(result.current.missingFields).toContain('descrição (mínimo 10 caracteres)');
    expect(result.current.missingFields).toContain(
      'localização (endereço não localizado automaticamente — clique em "Usar minha localização atual")',
    );
  });

  it('exige nome da categoria nova só quando isNewCategory é true', () => {
    const withoutFlag = renderHook(() => useJobFormValidation({ ...baseInput(), newCategoryName: '' }));
    expect(withoutFlag.result.current.missingFields).not.toContain('nome da nova categoria');

    const withFlag = renderHook(() =>
      useJobFormValidation({ ...baseInput(), isNewCategory: true, newCategoryName: '' }),
    );
    expect(withFlag.result.current.missingFields).toContain('nome da nova categoria');
  });

  it('exige termsAccepted só quando informado como false (edição não repete o aceite)', () => {
    const editing = renderHook(() => useJobFormValidation(baseInput()));
    expect(editing.result.current.missingFields).not.toContain('confirmação de que a escala é intermediação avulsa');

    const creating = renderHook(() => useJobFormValidation({ ...baseInput(), termsAccepted: false }));
    expect(creating.result.current.missingFields).toContain('confirmação de que a escala é intermediação avulsa');

    const accepted = renderHook(() => useJobFormValidation({ ...baseInput(), termsAccepted: true }));
    expect(accepted.result.current.missingFields).toEqual([]);
  });

  it('exige aceite do termo de menores só quando minorsAllowed está ligado', () => {
    const withoutMinors = renderHook(() => useJobFormValidation({ ...baseInput(), minorsAllowed: false }));
    expect(withoutMinors.result.current.isValid).toBe(true);

    const minorsNotAccepted = renderHook(() =>
      useJobFormValidation({ ...baseInput(), minorsAllowed: true, minorsTermsAccepted: false }),
    );
    expect(minorsNotAccepted.result.current.missingFields).toContain(
      'aceite do termo de habilitar candidaturas de 16-17 anos',
    );

    const minorsAccepted = renderHook(() =>
      useJobFormValidation({ ...baseInput(), minorsAllowed: true, minorsTermsAccepted: true }),
    );
    expect(minorsAccepted.result.current.isValid).toBe(true);
  });

  it('rejeita término antes do início e início no passado', () => {
    const { result } = renderHook(() =>
      useJobFormValidation({ ...baseInput(), startsAt: TOMORROW_PLUS_5H, endsAt: TOMORROW }),
    );
    expect(result.current.missingFields).toContain('término depois do início');
  });

  it('calcula a estimativa (vagas × valor) quando os dois campos são válidos', () => {
    const { result } = renderHook(() => useJobFormValidation({ ...baseInput(), positionsTotal: '3', payAmount: '100.00' }));
    expect(result.current.showEstimate).toBe(true);
    expect(result.current.estimateTotal).toBe(300);
  });

  it('não mostra estimativa com valor inválido', () => {
    const { result } = renderHook(() => useJobFormValidation({ ...baseInput(), payAmount: '0' }));
    expect(result.current.showEstimate).toBe(false);
  });

  it('aceita vírgula como separador decimal (forma natural de digitar valor em reais)', () => {
    const { result } = renderHook(() =>
      useJobFormValidation({ ...baseInput(), positionsTotal: '2', payAmount: '130,50' }),
    );
    expect(result.current.missingFields).not.toContain('valor por pessoa');
    expect(result.current.showEstimate).toBe(true);
    expect(result.current.payAmountNumber).toBe(130.5);
    expect(result.current.estimateTotal).toBe(261);
  });

  it('rejeita valor negativo', () => {
    const { result } = renderHook(() => useJobFormValidation({ ...baseInput(), payAmount: '-50.00' }));
    expect(result.current.missingFields).toContain('valor por pessoa');
  });

  it('rejeita mais de 2 casas decimais', () => {
    const { result } = renderHook(() => useJobFormValidation({ ...baseInput(), payAmount: '130.999' }));
    expect(result.current.missingFields).toContain('valor por pessoa');
  });

  describe('alimentação/transporte (mealProvision/transportProvision)', () => {
    it('não exige valor quando não oferece ou oferece no local', () => {
      const { result } = renderHook(() => useJobFormValidation(baseInput()));
      expect(result.current.missingFields).not.toContain('valor da alimentação');
      expect(result.current.missingFields).not.toContain('valor do transporte');

      const onSite = renderHook(() =>
        useJobFormValidation({ ...baseInput(), mealProvision: 'on_site', transportProvision: 'on_site' }),
      );
      expect(onSite.result.current.missingFields).not.toContain('valor da alimentação');
      expect(onSite.result.current.missingFields).not.toContain('valor do transporte');
    });

    it('exige valor da alimentação quando mealProvision é "paid" sem valor', () => {
      const { result } = renderHook(() =>
        useJobFormValidation({ ...baseInput(), mealProvision: 'paid', mealAmount: '' }),
      );
      expect(result.current.missingFields).toContain('valor da alimentação');
    });

    it('exige valor do transporte quando transportProvision é "paid" sem valor', () => {
      const { result } = renderHook(() =>
        useJobFormValidation({ ...baseInput(), transportProvision: 'paid', transportAmount: '' }),
      );
      expect(result.current.missingFields).toContain('valor do transporte');
    });

    it('aceita valores válidos (com vírgula) quando "paid"', () => {
      const { result } = renderHook(() =>
        useJobFormValidation({
          ...baseInput(),
          mealProvision: 'paid',
          mealAmount: '20,00',
          transportProvision: 'paid',
          transportAmount: '15,50',
        }),
      );
      expect(result.current.missingFields).not.toContain('valor da alimentação');
      expect(result.current.missingFields).not.toContain('valor do transporte');
    });

    it('rejeita valor zero ou negativo quando "paid"', () => {
      const { result } = renderHook(() =>
        useJobFormValidation({ ...baseInput(), mealProvision: 'paid', mealAmount: '0' }),
      );
      expect(result.current.missingFields).toContain('valor da alimentação');
    });
  });
});
