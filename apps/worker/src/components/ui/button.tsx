import { ButtonHTMLAttributes, forwardRef } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outlined' | 'danger' | 'success';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  isLoading?: boolean;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-white hover:brightness-90 active:brightness-75 focus-visible:ring-primary/35',
  secondary:
    'bg-secondary text-white hover:brightness-125 active:brightness-150 focus-visible:ring-secondary/35',
  ghost: 'bg-transparent text-primary hover:bg-primary/10 active:bg-primary/20 focus-visible:ring-primary/35',
  outlined:
    'bg-transparent text-text border border-border hover:border-primary hover:text-primary active:bg-primary/5 focus-visible:ring-primary/35',
  danger: 'bg-danger text-white hover:brightness-90 active:brightness-75 focus-visible:ring-danger/35',
  success: 'bg-success text-white hover:brightness-90 active:brightness-75 focus-visible:ring-success/35',
};

/**
 * Um Primary por tela, no máximo — se duas ações competem, a
 * segunda vira outlined ou ghost (ver documento de design).
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', isLoading = false, disabled, className = '', children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || isLoading}
      className={`inline-flex items-center justify-center gap-2 rounded-md px-5 py-2.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-[3px] disabled:pointer-events-none disabled:bg-border disabled:text-text-secondary ${VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    >
      {isLoading && (
        <span
          aria-hidden="true"
          className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white"
        />
      )}
      {children}
    </button>
  );
});
