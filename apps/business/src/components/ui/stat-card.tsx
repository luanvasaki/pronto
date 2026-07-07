export interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  hintClassName?: string;
  /** "dark" reproduz o card escuro do mockup (ex. "Avaliação da casa"). */
  variant?: 'default' | 'dark';
}

export function StatCard({ label, value, hint, hintClassName = '', variant = 'default' }: StatCardProps) {
  const isDark = variant === 'dark';

  return (
    <div
      className={`rounded-2xl p-5 ${
        isDark ? 'bg-secondary text-background' : 'border border-border bg-surface text-text'
      }`}
    >
      <p className={`text-[13px] ${isDark ? 'text-background/60' : 'text-text-secondary'}`}>{label}</p>
      <p className="mt-1 font-heading text-[34px] leading-none font-bold tracking-[-0.02em]">{value}</p>
      {hint && (
        <p className={`mt-1.5 text-[12.5px] ${isDark ? 'text-background/50' : (hintClassName ?? 'text-text-secondary')}`}>
          {hint}
        </p>
      )}
    </div>
  );
}
