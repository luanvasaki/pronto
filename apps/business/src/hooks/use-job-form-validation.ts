import { BenefitProvision } from '@shift/shared';

const PAY_AMOUNT_REGEX = /^\d+(\.\d{1,2})?$/;

export interface JobFormValidationInput {
  categoryId: string;
  /** Só checado quando `isNewCategory` é true — tela de editar não tem essa opção. */
  isNewCategory?: boolean;
  newCategoryName?: string;
  requiresExperience: boolean | null;
  description: string;
  addressLabel: string;
  lat: number | null;
  lng: number | null;
  positionsTotal: string;
  payAmount: string;
  mealProvision: BenefitProvision;
  mealAmount: string;
  transportProvision: BenefitProvision;
  transportAmount: string;
  startsAt: string;
  endsAt: string;
  applicationsCloseAt: string;
  /** Undefined = não exigido de novo (edição não repete o aceite, só a criação). */
  termsAccepted?: boolean;
}

export interface JobFormValidationResult {
  positionsTotalNumber: number;
  payAmountNumber: number;
  showEstimate: boolean;
  estimateTotal: number;
  missingFields: string[];
  isValid: boolean;
}

/**
 * Validação do formulário de vaga — idêntica entre "nova vaga" e
 * "editar vaga" (a diferença nos dois é só o que existe ANTES de
 * chegar aqui: criação de categoria nova e aceite de termos só fazem
 * sentido em "nova"). Extraído pra um lugar só depois de perceber, ao
 * adicionar os campos de alimentação/transporte, que era fácil esquecer de
 * mudar as duas telas juntas.
 *
 * Cada condição vira um item em `missingFields`, na mesma ordem — se o
 * botão de publicar/salvar ficar cinza sem essa lista, ninguém acha o
 * campo que falta.
 */
export function useJobFormValidation(input: JobFormValidationInput): JobFormValidationResult {
  const positionsTotalNumber = Number(input.positionsTotal);
  // Aceita vírgula como separador decimal (forma natural de digitar
  // valor em reais) além do ponto — sem isso "130,50" caía num erro
  // genérico de "valor por pessoa" sem explicar o formato esperado.
  const normalizedPayAmount = input.payAmount.replace(',', '.');
  const payAmountNumber = Number(normalizedPayAmount);
  const showEstimate =
    Number.isInteger(positionsTotalNumber) &&
    positionsTotalNumber >= 1 &&
    PAY_AMOUNT_REGEX.test(normalizedPayAmount) &&
    payAmountNumber > 0;
  const estimateTotal = positionsTotalNumber * payAmountNumber;

  const missingFields: string[] = [];
  if (input.categoryId === '') missingFields.push('categoria');
  if (input.isNewCategory && (input.newCategoryName ?? '').trim().length < 2) {
    missingFields.push('nome da nova categoria');
  }
  if (input.requiresExperience === null) missingFields.push('exigência de experiência');
  if (input.description.trim().length < 10) missingFields.push('descrição (mínimo 10 caracteres)');
  if (input.addressLabel.trim().length < 2) missingFields.push('endereço');
  if (input.lat === null || input.lng === null) {
    missingFields.push('localização (endereço não localizado automaticamente — clique em "Usar minha localização atual")');
  }
  if (!Number.isInteger(positionsTotalNumber) || positionsTotalNumber < 1) missingFields.push('número de vagas');
  if (!PAY_AMOUNT_REGEX.test(normalizedPayAmount) || payAmountNumber <= 0) {
    missingFields.push('valor por pessoa');
  }
  if (input.mealProvision === 'paid') {
    const normalizedMealAmount = input.mealAmount.replace(',', '.');
    if (!PAY_AMOUNT_REGEX.test(normalizedMealAmount) || Number(normalizedMealAmount) <= 0) {
      missingFields.push('valor da alimentação');
    }
  }
  if (input.transportProvision === 'paid') {
    const normalizedTransportAmount = input.transportAmount.replace(',', '.');
    if (!PAY_AMOUNT_REGEX.test(normalizedTransportAmount) || Number(normalizedTransportAmount) <= 0) {
      missingFields.push('valor do transporte');
    }
  }
  if (input.startsAt === '') missingFields.push('início');
  if (input.endsAt === '') missingFields.push('término');
  if (input.startsAt !== '' && input.endsAt !== '' && !(new Date(input.endsAt) > new Date(input.startsAt))) {
    missingFields.push('término depois do início');
  }
  if (input.startsAt !== '' && !(new Date(input.startsAt) > new Date())) missingFields.push('início no futuro');
  if (
    input.applicationsCloseAt !== '' &&
    input.startsAt !== '' &&
    new Date(input.applicationsCloseAt) > new Date(input.startsAt)
  ) {
    missingFields.push('prazo de candidatura até o início');
  }
  if (input.termsAccepted === false) missingFields.push('confirmação de que a escala é intermediação avulsa');

  return {
    positionsTotalNumber,
    payAmountNumber,
    showEstimate,
    estimateTotal,
    missingFields,
    isValid: missingFields.length === 0,
  };
}
