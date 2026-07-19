import { HttpError } from '../../shared/errors/http-error';
import { ForwardGeocoder } from './forward-geocode';

export interface GeocodeAddressResult {
  lat: number | null;
  lng: number | null;
}

/**
 * Sem persistência de propósito — diferente de updateWorkerLocation, essa
 * geocodificação só serve pra pré-preencher lat/lng no formulário de vaga
 * antes do envio; quem salva de fato é createJob/updateJob, que já valida
 * lat/lng como qualquer outro campo do formulário. `lat`/`lng` nulos (sem
 * lançar erro) representam "não encontrado" — quem chama decide se pede
 * pro dono da empresa usar o GPS manual nesse caso.
 */
export async function geocodeAddress(
  addressLabel: string | undefined,
  geocoder: ForwardGeocoder,
): Promise<GeocodeAddressResult> {
  const trimmed = addressLabel?.trim();
  if (!trimmed || trimmed.length < 2) {
    throw new HttpError(400, 'Endereço é obrigatório.');
  }

  const result = await geocoder.geocodeAddress(trimmed);
  return { lat: result?.lat ?? null, lng: result?.lng ?? null };
}
