/**
 * Timeout explícito — sem isso, se a permissão travar sem o navegador
 * nunca chamar nenhum dos dois callbacks (visto em alguns webviews),
 * a tela fica parecendo travada pra sempre.
 */
const POSITION_OPTIONS: PositionOptions = { timeout: 10_000, maximumAge: 0 };

/** Mensagem de negação customizável — cada tela usa a localização por um motivo diferente. */
export function getCurrentPosition(
  deniedMessage = 'Não foi possível obter sua localização.',
): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocalização não é suportada nesse navegador.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      resolve,
      () => reject(new Error(deniedMessage)),
      POSITION_OPTIONS,
    );
  });
}
