/**
 * Tolerância pra imprecisão de GPS (ambiente fechado, prédio alto) sem
 * abrir brecha pra check-in longe do local de verdade — a localização
 * usada é sempre a da vaga (job.locationLat/Lng), nunca o endereço
 * cadastrado da empresa (que é só informativo, ver companies.ts).
 */
export const CHECK_IN_RADIUS_METERS = 150;
