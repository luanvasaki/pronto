import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiFetchMock = vi.fn();
vi.mock('./api', () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

const { rateShift, skipRating } = await import('./ratings-api');

describe('rateShift', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it('chama POST /shifts/:id/rating com as notas por categoria e comentário', async () => {
    apiFetchMock.mockResolvedValue({ id: 'rating-1', score: 5 });
    const categoryScores = { pontualidade: 5, educacao: 4, proatividade: 5, comunicacao: 5, qualidade: 4 };

    await rateShift('shift-1', categoryScores, 'Muito bom.');

    expect(apiFetchMock).toHaveBeenCalledWith('/shifts/shift-1/rating', {
      method: 'POST',
      body: JSON.stringify({ categoryScores, comment: 'Muito bom.' }),
    });
  });
});

describe('skipRating', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it('chama PATCH /shifts/:id/skip-rating', async () => {
    apiFetchMock.mockResolvedValue({ shiftId: 'shift-1', skippedAt: '2026-07-18T12:00:00.000Z' });

    await skipRating('shift-1');

    expect(apiFetchMock).toHaveBeenCalledWith('/shifts/shift-1/skip-rating', { method: 'PATCH' });
  });
});
