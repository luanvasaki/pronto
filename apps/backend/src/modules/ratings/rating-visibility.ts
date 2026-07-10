export const RATING_REVEAL_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Avaliação às cegas: nenhum dos dois lados vê a nota do outro até os dois
 * avaliarem o mesmo turno, ou até passarem 7 dias do check-out — evita
 * avaliação em represália. Sem coluna "revelado" nem cron pra virar isso:
 * calculado ao vivo sempre que lido (mesmo espírito de totalHoursWorked em
 * get-worker-profile.ts), então nunca fica desatualizado.
 */
export function isRatingRevealed(siblingExists: boolean, shiftCheckOutAt: Date | null): boolean {
  if (siblingExists) return true;
  if (!shiftCheckOutAt) return false;
  return Date.now() - shiftCheckOutAt.getTime() >= RATING_REVEAL_WINDOW_MS;
}
