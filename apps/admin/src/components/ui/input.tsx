import { InputHTMLAttributes, forwardRef } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, id, className = '', ...props },
  ref,
) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-text-secondary">
        {label}
      </label>
      <input
        ref={ref}
        id={id}
        className={`w-full rounded-md border bg-surface px-3 py-2.5 text-base text-text transition focus:outline-none focus:ring-[3px] disabled:cursor-not-allowed disabled:bg-border/40 disabled:text-text-secondary ${
          error
            ? 'border-danger focus:border-danger focus:ring-danger/15'
            : 'border-border focus:border-primary focus:ring-primary/15'
        } ${className}`}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        {...props}
      />
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
});
