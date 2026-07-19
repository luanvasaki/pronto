/** Placeholder de carregamento — substitui texto "Carregando..." por um preview da estrutura que vai aparecer. */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-border/70 ${className}`} />;
}

/** Skeleton de um card de lista (título + linha secundária + linha menor) — o formato mais comum das telas do app. */
export function CardSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="mt-2.5 h-3 w-1/2" />
      <Skeleton className="mt-3 h-3 w-1/3" />
    </div>
  );
}

/** N cards de skeleton empilhados — usar no lugar de "Carregando..." em qualquer tela de lista. */
export function CardListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-3" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <CardSkeleton key={index} />
      ))}
    </div>
  );
}
