import { afterEach, describe, expect, it, vi } from 'vitest';
import { getCurrentPosition } from './geolocation';

describe('getCurrentPosition', () => {
  afterEach(() => {
    Object.defineProperty(window.navigator, 'geolocation', { value: undefined, configurable: true });
  });

  it('rejeita quando o navegador não suporta geolocalização', async () => {
    await expect(getCurrentPosition()).rejects.toThrow('não é suportada');
  });

  it('resolve com a posição quando o navegador permite', async () => {
    Object.defineProperty(window.navigator, 'geolocation', {
      value: {
        getCurrentPosition: vi.fn((success) => success({ coords: { latitude: -23.55, longitude: -46.63 } })),
      },
      configurable: true,
    });

    const position = await getCurrentPosition();

    expect(position.coords.latitude).toBe(-23.55);
  });

  it('rejeita com a mensagem customizada quando o navegador nega', async () => {
    Object.defineProperty(window.navigator, 'geolocation', {
      value: { getCurrentPosition: vi.fn((_success, failure) => failure()) },
      configurable: true,
    });

    await expect(getCurrentPosition('mensagem customizada')).rejects.toThrow('mensagem customizada');
  });
});
