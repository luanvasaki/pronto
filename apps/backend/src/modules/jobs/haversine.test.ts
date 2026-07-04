import { describe, expect, it } from 'vitest';
import { haversineDistanceKm } from './haversine';

describe('haversineDistanceKm', () => {
  it('retorna 0 pro mesmo ponto', () => {
    expect(haversineDistanceKm(-23.55, -46.63, -23.55, -46.63)).toBe(0);
  });

  it('calcula a distância aproximada entre Vila Madalena e a Sé (São Paulo)', () => {
    // Distância real é ~7km.
    const distance = haversineDistanceKm(-23.546, -46.69, -23.5505, -46.6333);

    expect(distance).toBeGreaterThan(5);
    expect(distance).toBeLessThan(9);
  });
});
