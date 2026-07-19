export interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  hintClassName?: string;
  /** "dark" reproduz o card escuro do mockup (mesmo padrão do StatCard do business). */
  variant?: 'default' | 'dark';
  /**
   * "compact" é o padrão desta tela: visão geral com 9 métricas de
   * uma vez, centralizadas e menores — a versão "default" (label
   * acima, número grande, alinhado à esquerda) é a mesma do StatCard
   * do business, feita pra poucos KPIs "hero", não pra uma grade densa.
   */
  size?: 'default' | 'compact';
}

export function StatCard({ label, value, hint, hintClassName = '', variant = 'default', size = 'default' }: StatCardProps) {
  const isDark = variant === 'dark';
  const isCompact = size === 'compact';

  if (isCompact) {
    return (
      <div
        className={`rounded-2xl p-4 text-center ${
          isDark ? 'bg-secondary text-background' : 'border border-border bg-surface text-text'
        }`}
      >
        <p className="font-heading text-xl font-bold">{value}</p>
        <p className={`mt-1 text-xs ${isDark ? 'text-background/60' : 'text-text-secondary'}`}>{label}</p>
        {hint && (
          <p className={`mt-1 text-xs ${isDark ? 'text-background/50' : (hintClassName ?? 'text-text-secondary')}`}>
            {hint}
          </p>
        )}
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl p-5 ${
        isDark ? 'bg-secondary text-background' : 'border border-border bg-surface text-text'
      }`}
    >
      <p className={`text-[14px] ${isDark ? 'text-background/60' : 'text-text-secondary'}`}>{label}</p>
      <p className="mt-1 font-heading text-[34px] leading-none font-bold tracking-[-0.02em]">{value}</p>
      {hint && (
        <p className={`mt-1.5 text-[14px] ${isDark ? 'text-background/50' : (hintClassName ?? 'text-text-secondary')}`}>
          {hint}
        </p>
      )}
    </div>
  );
}
