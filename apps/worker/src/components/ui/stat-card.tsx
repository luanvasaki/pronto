export interface StatCardProps {
  label: string;
  value: string;
}

/** Card compacto pra tiras de 3+ estatísticas lado a lado (perfil do trabalhador). */
export function StatCard({ label, value }: StatCardProps) {
  return (
    <div className="flex-1 rounded-2xl border border-border bg-surface p-3.5 text-center">
      <p className="font-heading text-xl font-bold text-text">{value}</p>
      <p className="mt-1 text-xs text-text-secondary">{label}</p>
    </div>
  );
}
