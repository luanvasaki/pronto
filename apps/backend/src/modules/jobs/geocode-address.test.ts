import { describe, expect, it } from 'vitest';
import { ForwardGeocoder } from './forward-geocode';
import { geocodeAddress } from './geocode-address';

class FakeForwardGeocoder implements ForwardGeocoder {
  constructor(private readonly result: { lat: number; lng: number } | null) {}

  async geocodeAddress(): Promise<{ lat: number; lng: number } | null> {
    return this.result;
  }
}

describe('geocodeAddress', () => {
  it('rejeita endereço vazio', async () => {
    await expect(geocodeAddress('', new FakeForwardGeocoder(null))).rejects.toThrow('Endereço é obrigatório');
  });

  it('rejeita endereço ausente', async () => {
    await expect(geocodeAddress(undefined, new FakeForwardGeocoder(null))).rejects.toThrow('Endereço é obrigatório');
  });

  it('retorna lat/lng quando o geocoder encontra o endereço', async () => {
    const result = await geocodeAddress(
      'Rua Augusta, 1200, Consolação, São Paulo - SP',
      new FakeForwardGeocoder({ lat: -23.55, lng: -46.66 }),
    );

    expect(result).toEqual({ lat: -23.55, lng: -46.66 });
  });

  it('retorna lat/lng nulos quando o geocoder não encontra o endereço', async () => {
    const result = await geocodeAddress('Endereço inexistente, 999999', new FakeForwardGeocoder(null));

    expect(result).toEqual({ lat: null, lng: null });
  });
});
