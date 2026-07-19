import { apiFetch } from './api';

export interface RatingCategory {
  id: string;
  label: string;
}

/**
 * Empresa avalia trabalhador — mesmos ids/labels de
 * apps/backend/src/modules/ratings/rating-categories.ts (duplicado de
 * propósito, front e back não importam um do outro).
 */
export const WORKER_RATING_CATEGORIES: readonly RatingCategory[] = [
  { id: 'pontualidade', label: 'Pontualidade' },
  { id: 'educacao', label: 'Educação e respeito' },
  { id: 'proatividade', label: 'Proatividade' },
  { id: 'comunicacao', label: 'Comunicação' },
  { id: 'qualidade', label: 'Qualidade do trabalho' },
];

/** Trabalhador avalia empresa. */
export const COMPANY_RATING_CATEGORIES: readonly RatingCategory[] = [
  { id: 'pontualidade_pagamento', label: 'Pontualidade no pagamento' },
  { id: 'clareza_vaga', label: 'Clareza das informações da vaga' },
  { id: 'respeito', label: 'Respeito no tratamento' },
  { id: 'comunicacao', label: 'Comunicação' },
  { id: 'ambiente', label: 'Ambiente e condições de trabalho' },
];

export interface Rating {
  id: string;
  shiftId: string;
  raterRole: string;
  score: number;
  categoryScores: Record<string, number> | null;
  comment: string | null;
  createdAt: string;
}

export interface ShiftRatings {
  worker: Rating | null;
  company: Rating | null;
}

export function rateShift(
  shiftId: string,
  categoryScores: Record<string, number>,
  comment: string | undefined,
): Promise<Rating> {
  return apiFetch(`/shifts/${shiftId}/rating`, {
    method: 'POST',
    body: JSON.stringify({ categoryScores, comment }),
  });
}

export interface SkipRatingResult {
  shiftId: string;
  skippedAt: string;
}

/**
 * Quem avalia é sempre "a outra ponta do turno" (ver rateShift) — o
 * mesmo vale pra ignorar: o backend decide sozinho, pela identidade de
 * quem chama, se marca `companyRatingSkippedAt` ou
 * `workerRatingSkippedAt`. Cada app só chama isso pro seu próprio papel
 * (business nunca chama como trabalhador, e vice-versa), por isso a
 * resposta não precisa dizer qual dos dois campos foi marcado.
 */
export function skipRating(shiftId: string): Promise<SkipRatingResult> {
  return apiFetch(`/shifts/${shiftId}/skip-rating`, { method: 'PATCH' });
}
