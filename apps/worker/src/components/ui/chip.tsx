import { ButtonHTMLAttributes } from 'react';

export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
}

/** Chip clicável (filtro) — bolinha cheia quando ativo, contorno quando não. */
export function Chip({ active = false, className = '', children, ...props }: ChipProps) {
  return (
    <button
      type="button"
      className={`flex-none rounded-full border px-4 py-2 text-sm font-semibold transition ${
        active ? 'border-transparent bg-secondary text-background' : 'border-border bg-transparent text-text'
      } ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
