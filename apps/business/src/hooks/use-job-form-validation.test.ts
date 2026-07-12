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
    startsAt: TOMORROW,
    endsAt: TOMORROW_PLUS_5H,
    applicationsCloseAt: '',
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
    expect(result.current.missingFields).toContain('localização (clique em "Usar minha localização atual")');
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
});
