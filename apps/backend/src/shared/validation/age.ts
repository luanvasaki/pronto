/**
 * Assume "YYYY-MM-DD" já validado pelo chamador — garante os 3 grupos
 * numéricos que o non-null assertion abaixo depende.
 */
export function calculateAge(birthDate: string, now: Date): number {
  const [year, month, day] = birthDate.split('-').map(Number) as [number, number, number];
  let age = now.getFullYear() - year;
  const hasHadBirthdayThisYear = now.getMonth() + 1 > month || (now.getMonth() + 1 === month && now.getDate() >= day);
  if (!hasHadBirthdayThisYear) age -= 1;
  return age;
}

export const ADULT_AGE_YEARS = 18;

/**
 * `birthDate` nulo/ausente nunca deveria acontecer em produção (cadastro
 * exige a data), mas o tipo do perfil permite — trata como não-menor em
 * vez de lançar, mesmo espírito defensivo dos 5 lugares que faziam essa
 * checagem cada um do seu jeito antes desse helper existir.
 */
export function isMinor(birthDate: string | null | undefined, now: Date = new Date()): boolean {
  return Boolean(birthDate) && calculateAge(birthDate!, now) < ADULT_AGE_YEARS;
}
