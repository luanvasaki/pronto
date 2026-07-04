/** Mensagem de negação customizável — cada tela usa a localização por um motivo diferente. */
export function getCurrentPosition(
  deniedMessage = 'Não foi possível obter sua localização.',
): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocalização não é suportada nesse navegador.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, () => reject(new Error(deniedMessage)));
  });
}
