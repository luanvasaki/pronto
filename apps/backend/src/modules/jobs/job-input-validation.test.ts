import { describe, expect, it } from 'vitest';
import { JobInput, validateJobInput } from './job-input-validation';

const TOMORROW = new Date(Date.now() + 24 * 60 * 60 * 1000);
const TOMORROW_PLUS_5H = new Date(TOMORROW.getTime() + 5 * 60 * 60 * 1000);
const IN_TWO_HOURS = new Date(Date.now() + 2 * 60 * 60 * 1000);

function baseInput(overrides: Partial<JobInput> = {}): JobInput {
  return {
    categoryId: 'cat-1',
    description: 'Descrição com mais de dez caracteres.',
    requiresExperience: false,
    dressCode: undefined,
    toolsRequired: undefined,
    cnhCategory: undefined,
    cnhRequired: undefined,
    mealProvision: undefined,
    mealAmount: undefined,
    transportProvision: undefined,
    transportAmount: undefined,
    minorsAllowed: undefined,
    addressLabel: 'Vila Madalena, São Paulo',
    locationLat: -23.55,
    locationLng: -46.63,
    positionsTotal: 2,
    payAmount: '130.00',
    startsAt: TOMORROW.toISOString(),
    endsAt: TOMORROW_PLUS_5H.toISOString(),
    applicationsCloseAt: undefined,
    ...overrides,
  };
}

describe('validateJobInput', () => {
  it('aceita um input válido completo', () => {
    const result = validateJobInput(baseInput());
    expect(result.categoryId).toBe('cat-1');
    expect(result.payAmount).toBe('130.00');
    expect(result.positionsTotal).toBe(2);
  });

  it('rejeita sem categoria', () => {
    expect(() => validateJobInput(baseInput({ categoryId: undefined }))).toThrow('Categoria é obrigatória');
  });

  it('rejeita descrição curta', () => {
    expect(() => validateJobInput(baseInput({ description: 'curta' }))).toThrow(
      'pelo menos 10 caracteres',
    );
  });

  it('rejeita quando requiresExperience não é booleano', () => {
    expect(() => validateJobInput(baseInput({ requiresExperience: undefined }))).toThrow(
      'exige experiência anterior',
    );
  });

  describe('latitude/longitude — limites', () => {
    it('aceita latitude exatamente nos limites (-90 e 90)', () => {
      expect(() => validateJobInput(baseInput({ locationLat: -90 }))).not.toThrow();
      expect(() => validateJobInput(baseInput({ locationLat: 90 }))).not.toThrow();
    });

    it('rejeita latitude fora dos limites', () => {
      expect(() => validateJobInput(baseInput({ locationLat: -90.0001 }))).toThrow('Latitude inválida');
      expect(() => validateJobInput(baseInput({ locationLat: 90.0001 }))).toThrow('Latitude inválida');
    });

    it('aceita longitude exatamente nos limites (-180 e 180)', () => {
      expect(() => validateJobInput(baseInput({ locationLng: -180 }))).not.toThrow();
      expect(() => validateJobInput(baseInput({ locationLng: 180 }))).not.toThrow();
    });

    it('rejeita longitude fora dos limites', () => {
      expect(() => validateJobInput(baseInput({ locationLng: -180.0001 }))).toThrow('Longitude inválida');
      expect(() => validateJobInput(baseInput({ locationLng: 180.0001 }))).toThrow('Longitude inválida');
    });

    it('rejeita latitude/longitude ausentes', () => {
      expect(() => validateJobInput(baseInput({ locationLat: undefined }))).toThrow('Latitude inválida');
      expect(() => validateJobInput(baseInput({ locationLng: undefined }))).toThrow('Longitude inválida');
    });
  });

  describe('positionsTotal', () => {
    it('rejeita zero ou negativo', () => {
      expect(() => validateJobInput(baseInput({ positionsTotal: 0 }))).toThrow('pelo menos 1');
      expect(() => validateJobInput(baseInput({ positionsTotal: -1 }))).toThrow('pelo menos 1');
    });

    it('rejeita valor não inteiro', () => {
      expect(() => validateJobInput(baseInput({ positionsTotal: 1.5 }))).toThrow('pelo menos 1');
    });

    it('aceita 1 (o mínimo)', () => {
      expect(() => validateJobInput(baseInput({ positionsTotal: 1 }))).not.toThrow();
    });
  });

  describe('payAmount', () => {
    it('rejeita valor negativo', () => {
      expect(() => validateJobInput(baseInput({ payAmount: '-50.00' }))).toThrow('Valor do pagamento inválido');
    });

    it('rejeita zero', () => {
      expect(() => validateJobInput(baseInput({ payAmount: '0' }))).toThrow('Valor do pagamento inválido');
    });

    it('rejeita mais de 2 casas decimais', () => {
      expect(() => validateJobInput(baseInput({ payAmount: '130.999' }))).toThrow('Valor do pagamento inválido');
    });

    it('rejeita valor com vírgula (formato não aceito nessa camada)', () => {
      expect(() => validateJobInput(baseInput({ payAmount: '130,50' }))).toThrow('Valor do pagamento inválido');
    });

    it('aceita valor com 1 casa decimal e sem casas decimais', () => {
      expect(() => validateJobInput(baseInput({ payAmount: '130.5' }))).not.toThrow();
      expect(() => validateJobInput(baseInput({ payAmount: '130' }))).not.toThrow();
    });
  });

  describe('datas', () => {
    it('rejeita data de início inválida', () => {
      expect(() => validateJobInput(baseInput({ startsAt: 'não é uma data' }))).toThrow(
        'Data de início inválida',
      );
    });

    it('rejeita término antes ou igual ao início', () => {
      expect(() => validateJobInput(baseInput({ endsAt: TOMORROW.toISOString() }))).toThrow(
        'Data de término precisa ser depois do início',
      );
      expect(
        () => validateJobInput(baseInput({ startsAt: TOMORROW_PLUS_5H.toISOString(), endsAt: TOMORROW.toISOString() })),
      ).toThrow('Data de término precisa ser depois do início');
    });

    it('rejeita início no passado', () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      expect(() => validateJobInput(baseInput({ startsAt: yesterday.toISOString() }))).toThrow(
        'Data de início precisa ser no futuro',
      );
    });

    it('rejeita prazo de candidatura depois do início do turno', () => {
      expect(
        () =>
          validateJobInput(
            baseInput({ applicationsCloseAt: TOMORROW_PLUS_5H.toISOString() }),
          ),
      ).toThrow('Prazo pra se candidatar precisa ser até o início do turno');
    });

    it('rejeita prazo de candidatura no passado', () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      expect(() => validateJobInput(baseInput({ applicationsCloseAt: yesterday.toISOString() }))).toThrow(
        'Prazo pra se candidatar precisa ser no futuro',
      );
    });

    it('aceita prazo de candidatura válido (futuro e até o início)', () => {
      expect(() => validateJobInput(baseInput({ applicationsCloseAt: IN_TWO_HOURS.toISOString() }))).not.toThrow();
    });
  });

  describe('CNH', () => {
    it('rejeita categoria de CNH inválida', () => {
      expect(() => validateJobInput(baseInput({ cnhCategory: 'Z' }))).toThrow('Categoria de CNH inválida');
    });

    it('rejeita cnhRequired sem categoria informada', () => {
      expect(() => validateJobInput(baseInput({ cnhRequired: true, cnhCategory: undefined }))).toThrow(
        'Escolha a categoria de CNH exigida',
      );
    });

    it('aceita categoria de CNH válida sem exigir (preferência)', () => {
      const result = validateJobInput(baseInput({ cnhCategory: 'B', cnhRequired: false }));
      expect(result.cnhCategory).toBe('B');
      expect(result.cnhRequired).toBe(false);
    });

    it('aceita categoria de CNH válida com exigência', () => {
      const result = validateJobInput(baseInput({ cnhCategory: 'B', cnhRequired: true }));
      expect(result.cnhCategory).toBe('B');
      expect(result.cnhRequired).toBe(true);
    });
  });

  describe('alimentação/transporte (mealProvision/transportProvision)', () => {
    it('default é "none" quando não informado', () => {
      const result = validateJobInput(baseInput());
      expect(result.mealProvision).toBe('none');
      expect(result.mealAmount).toBeNull();
      expect(result.transportProvision).toBe('none');
      expect(result.transportAmount).toBeNull();
    });

    it('aceita "on_site" sem exigir valor', () => {
      const result = validateJobInput(baseInput({ mealProvision: 'on_site', transportProvision: 'on_site' }));
      expect(result.mealProvision).toBe('on_site');
      expect(result.mealAmount).toBeNull();
      expect(result.transportProvision).toBe('on_site');
      expect(result.transportAmount).toBeNull();
    });

    it('rejeita opção inválida', () => {
      expect(() => validateJobInput(baseInput({ mealProvision: 'invalido' }))).toThrow('Opção de alimentação inválida');
      expect(() => validateJobInput(baseInput({ transportProvision: 'invalido' }))).toThrow(
        'Opção de transporte inválida',
      );
    });

    it('"paid" exige o valor', () => {
      expect(() => validateJobInput(baseInput({ mealProvision: 'paid' }))).toThrow('Informe o valor de alimentação');
      expect(() => validateJobInput(baseInput({ transportProvision: 'paid' }))).toThrow(
        'Informe o valor de transporte',
      );
    });

    it('"paid" rejeita valor zero, negativo ou mal formatado', () => {
      expect(() => validateJobInput(baseInput({ mealProvision: 'paid', mealAmount: '0' }))).toThrow(
        'Informe o valor de alimentação',
      );
      expect(() => validateJobInput(baseInput({ mealProvision: 'paid', mealAmount: '-10.00' }))).toThrow(
        'Informe o valor de alimentação',
      );
      expect(() => validateJobInput(baseInput({ mealProvision: 'paid', mealAmount: '10,50' }))).toThrow(
        'Informe o valor de alimentação',
      );
    });

    it('"paid" aceita e guarda o valor', () => {
      const result = validateJobInput(
        baseInput({ mealProvision: 'paid', mealAmount: '25.00', transportProvision: 'paid', transportAmount: '15.50' }),
      );
      expect(result.mealProvision).toBe('paid');
      expect(result.mealAmount).toBe('25.00');
      expect(result.transportProvision).toBe('paid');
      expect(result.transportAmount).toBe('15.50');
    });

    it('ignora o valor enviado quando a opção não é "paid"', () => {
      const result = validateJobInput(baseInput({ mealProvision: 'on_site', mealAmount: '25.00' }));
      expect(result.mealAmount).toBeNull();
    });
  });

  describe('minorsAllowed', () => {
    it('default é false quando não informado', () => {
      expect(validateJobInput(baseInput()).minorsAllowed).toBe(false);
    });

    it('aceita true explícito', () => {
      expect(validateJobInput(baseInput({ minorsAllowed: true })).minorsAllowed).toBe(true);
    });
  });

  it('rejeita endereço curto ou ausente', () => {
    expect(() => validateJobInput(baseInput({ addressLabel: 'a' }))).toThrow('Endereço é obrigatório');
    expect(() => validateJobInput(baseInput({ addressLabel: undefined }))).toThrow('Endereço é obrigatório');
  });

  it('rejeita vestimenta/ferramentas exigidas longas demais', () => {
    const tooLong = 'a'.repeat(256);
    expect(() => validateJobInput(baseInput({ dressCode: tooLong }))).toThrow('Vestimenta exigida muito longa');
    expect(() => validateJobInput(baseInput({ toolsRequired: tooLong }))).toThrow('Ferramentas exigidas muito longas');
  });
});
