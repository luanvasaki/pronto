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
