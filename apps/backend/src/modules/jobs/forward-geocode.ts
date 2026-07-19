export interface GeocodeResult {
  lat: number;
  lng: number;
}

export interface ForwardGeocoder {
  geocodeAddress(addressLabel: string): Promise<GeocodeResult | null>;
}

interface NominatimSearchResult {
  lat: string;
  lon: string;
}

/**
 * Nominatim (OpenStreetMap) — mesmo provedor já usado pra geocodificação
 * reversa (ver reverse-geocode.ts), agora no sentido contrário: texto de
 * endereço → lat/lng. Sempre acrescenta ", Brasil" na busca (o produto é
 * só BR) pra reduzir ambiguidade com endereços homônimos em outros
 * países. Qualquer falha (rede, rate limit, endereço não encontrado) vira
 * `null` — quem chama trata isso deixando o botão de GPS manual como
 * alternativa, nunca bloqueia o formulário por causa da geocodificação.
 */
export class NominatimForwardGeocoder implements ForwardGeocoder {
  async geocodeAddress(addressLabel: string): Promise<GeocodeResult | null> {
    try {
      const query = encodeURIComponent(`${addressLabel}, Brasil`);
      const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`;
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Pronto/1.0 (contato@pronto.work)' },
      });
      if (!response.ok) {
        return null;
      }

      const results = (await response.json()) as NominatimSearchResult[];
      const first = results[0];
      if (!first) {
        return null;
      }

      const lat = Number(first.lat);
      const lng = Number(first.lon);
      if (Number.isNaN(lat) || Number.isNaN(lng)) {
        return null;
      }

      return { lat, lng };
    } catch (error) {
      console.warn('[forward-geocode] falha ao consultar Nominatim, seguindo sem coordenadas:', error);
      return null;
    }
  }
}

/** Único lugar que decide a implementação — mesmo padrão de createReverseGeocoder(). */
export function createForwardGeocoder(): ForwardGeocoder {
  return new NominatimForwardGeocoder();
}
