/** Segunda como início da semana — usado tanto no painel (stat "na semana") quanto na grade semanal de /escala. */
export function startOfWeek(reference: Date): Date {
  const date = new Date(reference);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}
