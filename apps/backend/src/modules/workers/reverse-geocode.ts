export interface ReverseGeocoder {
  reverseGeocode(lat: number, lng: number): Promise<string | null>;
}

interface NominatimAddress {
  suburb?: string;
  neighbourhood?: string;
  city?: string;
  town?: string;
  village?: string;
}

/**
 * Nominatim (OpenStreetMap) — gratuito, sem chave de API, mas exige um
 * User-Agent identificável (política de uso deles). Só usado pra
 * preencher um texto de exibição ("Campolim, Sorocaba"); nunca para
 * cálculo de distância, que continua direto com lat/lng. Qualquer
 * falha (rede, rate limit, resposta inesperada) vira `null` — quem
 * chama trata isso como "sem label", nunca deixa a localização de
 * não ser salva por causa da geocodificação.
 */
export class NominatimReverseGeocoder implements ReverseGeocoder {
  async reverseGeocode(lat: number, lng: number): Promise<string | null> {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=14&addressdetails=1`;
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Pronto/1.0 (contato@pronto.work)' },
      });
      if (!response.ok) {
        return null;
      }

      const data = (await response.json()) as { address?: NominatimAddress };
      const address = data.address;
      if (!address) {
        return null;
      }

      const neighborhood = address.suburb ?? address.neighbourhood;
      const city = address.city ?? address.town ?? address.village;

      if (neighborhood && city) {
        return `${neighborhood}, ${city}`;
      }
      return city ?? neighborhood ?? null;
    } catch {
      return null;
    }
  }
}

/** Único lugar que decide a implementação — mesmo padrão de createFileStorage(). */
export function createReverseGeocoder(): ReverseGeocoder {
  return new NominatimReverseGeocoder();
}
