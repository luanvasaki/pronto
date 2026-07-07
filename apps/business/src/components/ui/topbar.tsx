import Link from 'next/link';

export interface TopbarProps {
  title: string;
  subtitle?: string;
}

/**
 * Sino é decorativo (sem sistema de notificação real ainda) — só
 * reproduz o visual do mockup. "Publicar turno" navega pra
 * /vagas/nova; virar modal fica pra uma próxima etapa.
 */
export function Topbar({ title, subtitle }: TopbarProps) {
  return (
    <div className="flex h-[68px] shrink-0 items-center justify-between border-b border-border bg-background/90 px-7 backdrop-blur-sm">
      <div>
        <p className="font-heading text-xl leading-none font-bold tracking-[-0.01em] text-text">{title}</p>
        {subtitle && <p className="mt-0.5 text-[12.5px] text-text-secondary">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3.5">
        <div className="relative flex h-10 w-10 items-center justify-center rounded-[11px] border border-border">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M6 9a6 6 0 1112 0c0 5 2 6 2 6H4s2-1 2-6z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <path d="M10 20a2 2 0 004 0" stroke="currentColor" strokeWidth="2" />
          </svg>
          <span className="absolute top-2 right-2.5 h-[7px] w-[7px] rounded-full border border-background bg-primary" />
        </div>
        <Link
          href="/vagas/nova"
          className="flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-[14.5px] font-bold text-white shadow-[0_8px_20px_rgba(245,83,30,0.28)] transition hover:brightness-90"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
          Publicar turno
        </Link>
      </div>
    </div>
  );
}
