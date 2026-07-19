import { useEffect, useRef, useState } from 'react';
import { getCurrentPosition } from '../lib/geolocation';
import { geocodeJobAddress } from '../lib/jobs-api';

export type LocationSource = 'none' | 'auto' | 'manual';

export interface UseAddressGeocodingResult {
  lat: number | null;
  lng: number | null;
  locationSource: LocationSource;
  isGeocoding: boolean;
  isLocating: boolean;
  locationError: string | null;
  geocodeAddress: (addressLabel: string) => Promise<void>;
  markAddressDirty: () => void;
  useCurrentLocation: () => Promise<void>;
  setInitialLocation: (lat: number, lng: number) => void;
}

const MIN_ADDRESS_LENGTH = 6;

/**
 * CEP/endereço tenta geocodificar sozinho (chamado explicitamente pela
 * tela — no CEP resolvido e no blur do número) — o botão de GPS manual
 * (`useCurrentLocation`) fica só como ajuste fino opcional, nunca
 * obrigatório. Antes disso, publicar ou editar uma vaga exigia o dono da
 * empresa estar fisicamente no endereço (ou arriscar um pino errado
 * batendo GPS de qualquer lugar).
 *
 * Uma vez que o dono usa o GPS manual (`locationSource === 'manual'`), a
 * geocodificação automática para de rodar até `markAddressDirty()` ser
 * chamado de novo (rua/número/CEP mudou) — assim ela nunca sobrescreve
 * silenciosamente um pino manual mais preciso enquanto o endereço não
 * muda de verdade. `locationSourceRef` existe porque `geocodeAddress` é
 * assíncrona: sem o ref, uma checagem feita antes do `await` poderia
 * ignorar um clique manual que aconteceu enquanto a geocodificação
 * automática ainda estava em voo.
 */
export function useAddressGeocoding(): UseAddressGeocodingResult {
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [locationSource, setLocationSource] = useState<LocationSource>('none');
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const locationSourceRef = useRef<LocationSource>('none');
  useEffect(() => {
    locationSourceRef.current = locationSource;
  }, [locationSource]);

  async function geocodeAddress(addressLabel: string): Promise<void> {
    if (locationSourceRef.current === 'manual') return;
    const trimmed = addressLabel.trim();
    if (trimmed.length < MIN_ADDRESS_LENGTH) return;

    const requestId = ++requestIdRef.current;
    setIsGeocoding(true);
    try {
      const result = await geocodeJobAddress(trimmed);
      const sourceAfterFetch = locationSourceRef.current as LocationSource;
      if (requestIdRef.current !== requestId || sourceAfterFetch === 'manual') return;

      if (result.lat !== null && result.lng !== null) {
        setLat(result.lat);
        setLng(result.lng);
        setLocationSource('auto');
      } else if (sourceAfterFetch === 'auto') {
        setLat(null);
        setLng(null);
        setLocationSource('none');
      }
    } catch {
      // Best-effort — quem chama ainda tem o botão de GPS manual como alternativa.
    } finally {
      if (requestIdRef.current === requestId) setIsGeocoding(false);
    }
  }

  function markAddressDirty(): void {
    setLocationSource((current) => (current === 'manual' ? 'none' : current));
  }

  async function useCurrentLocation(): Promise<void> {
    setLocationError(null);
    setIsLocating(true);
    try {
      const position = await getCurrentPosition();
      setLat(position.coords.latitude);
      setLng(position.coords.longitude);
      setLocationSource('manual');
    } catch (err) {
      setLocationError(err instanceof Error ? err.message : 'Não foi possível obter sua localização.');
    } finally {
      setIsLocating(false);
    }
  }

  function setInitialLocation(initialLat: number, initialLng: number): void {
    setLat(initialLat);
    setLng(initialLng);
    setLocationSource('manual');
  }

  return {
    lat,
    lng,
    locationSource,
    isGeocoding,
    isLocating,
    locationError,
    geocodeAddress,
    markAddressDirty,
    useCurrentLocation,
    setInitialLocation,
  };
}
