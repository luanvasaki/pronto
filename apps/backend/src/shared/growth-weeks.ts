export interface GrowthWeek {
  /** Segunda-feira da semana, ISO date (yyyy-mm-dd). */
  weekStart: string;
  count: number;
}

/**
 * Últimas `weeks` semanas (segunda a domingo), mais antiga primeiro —
 * compartilhado entre as métricas de crescimento do admin (plataforma
 * inteira) e da empresa (por conta), mesma regra de bucket nos dois.
 */
export function buildWeekStarts(weeks: number): Date[] {
  const now = new Date();
  const dayOfWeek = (now.getUTCDay() + 6) % 7; // 0 = segunda
  const currentWeekStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - dayOfWeek),
  );

  const starts: Date[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    starts.push(new Date(currentWeekStart.getTime() - i * 7 * 24 * 60 * 60 * 1000));
  }
  return starts;
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Preenche semana sem registro com zero — o GROUP BY do Postgres
 * simplesmente pula semana vazia, e o gráfico precisa do buraco pra
 * ler como zero.
 */
export function zeroFill(weekStarts: Date[], rows: { weekStart: string; count: number }[]): GrowthWeek[] {
  const countByWeek = new Map(rows.map((row) => [row.weekStart, row.count]));
  return weekStarts.map((weekStart) => {
    const iso = toIsoDate(weekStart);
    return { weekStart: iso, count: countByWeek.get(iso) ?? 0 };
  });
}
