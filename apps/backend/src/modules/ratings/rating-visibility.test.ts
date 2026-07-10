import { describe, expect, it } from 'vitest';
import { isRatingRevealed, RATING_REVEAL_WINDOW_MS } from './rating-visibility';

describe('isRatingRevealed', () => {
  it('revela quando o outro lado já avaliou, mesmo dentro do prazo', () => {
    const justNow = new Date();
    expect(isRatingRevealed(true, justNow)).toBe(true);
  });

  it('revela quando o outro lado já avaliou, mesmo sem check-out registrado', () => {
    expect(isRatingRevealed(true, null)).toBe(true);
  });

  it('mantém oculto sem avaliação do outro lado e dentro do prazo de 7 dias', () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    expect(isRatingRevealed(false, twoDaysAgo)).toBe(false);
  });

  it('mantém oculto sem avaliação do outro lado e sem check-out registrado', () => {
    expect(isRatingRevealed(false, null)).toBe(false);
  });

  it('revela sem avaliação do outro lado quando o prazo de 7 dias já passou', () => {
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    expect(isRatingRevealed(false, eightDaysAgo)).toBe(true);
  });

  it('mantém oculto bem na borda do prazo (poucos ms antes de completar 7 dias)', () => {
    const almostSevenDaysAgo = new Date(Date.now() - RATING_REVEAL_WINDOW_MS + 5000);
    expect(isRatingRevealed(false, almostSevenDaysAgo)).toBe(false);
  });

  it('revela bem na borda do prazo (exatamente 7 dias ou pouco mais)', () => {
    const sevenDaysAgo = new Date(Date.now() - RATING_REVEAL_WINDOW_MS - 1000);
    expect(isRatingRevealed(false, sevenDaysAgo)).toBe(true);
  });
});
