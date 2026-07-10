export interface RatingCategory {
  id: string;
  label: string;
}

/** Empresa avalia trabalhador — usado quando raterRole === 'company'. */
export const WORKER_RATING_CATEGORIES: readonly RatingCategory[] = [
  { id: 'pontualidade', label: 'Pontualidade' },
  { id: 'educacao', label: 'Educação e respeito' },
  { id: 'proatividade', label: 'Proatividade' },
  { id: 'comunicacao', label: 'Comunicação' },
  { id: 'qualidade', label: 'Qualidade do trabalho' },
];

/** Trabalhador avalia empresa — usado quando raterRole === 'worker'. */
export const COMPANY_RATING_CATEGORIES: readonly RatingCategory[] = [
  { id: 'pontualidade_pagamento', label: 'Pontualidade no pagamento' },
  { id: 'clareza_vaga', label: 'Clareza das informações da vaga' },
  { id: 'respeito', label: 'Respeito no tratamento' },
  { id: 'comunicacao', label: 'Comunicação' },
  { id: 'ambiente', label: 'Ambiente e condições de trabalho' },
];

/**
 * Quem avalia usa o conjunto de categorias do avaliado: um worker
 * avaliando o turno está avaliando a empresa (COMPANY_RATING_CATEGORIES),
 * e vice-versa — mesma inversão já usada pra raterRole em create-rating.ts.
 */
export function categoriesForRater(raterRole: 'worker' | 'company'): readonly RatingCategory[] {
  return raterRole === 'worker' ? COMPANY_RATING_CATEGORIES : WORKER_RATING_CATEGORIES;
}
