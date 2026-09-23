/** Ícones de traço 2px usados inline no meio de texto — substituem símbolos Unicode (★, ✓) que renderizam diferente por plataforma/fonte. */

/** `size` (px) é pra uso avulso (ex. widget de avaliação); sem ele, o ícone acompanha o tamanho do texto ao redor. */
export function StarIcon({ className = '', size }: { className?: string; size?: number }) {
  return (
    <svg
      className={`inline-block align-[-0.1em] ${size ? '' : 'h-[0.9em] w-[0.9em]'} ${className}`}
      style={size ? { width: size, height: size } : undefined}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 2.5l2.9 6.4 6.9.7-5.2 4.7 1.5 6.8-6.1-3.6-6.1 3.6 1.5-6.8-5.2-4.7 6.9-.7z" />
    </svg>
  );
}

export function CheckIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`inline-block h-[0.85em] w-[0.85em] align-[-0.05em] ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
