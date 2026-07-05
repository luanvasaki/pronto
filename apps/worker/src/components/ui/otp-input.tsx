'use client';

import { extractDigits } from '@shift/shared';
import { ChangeEvent, KeyboardEvent, useRef } from 'react';

export interface OtpInputProps {
  length: number;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

/**
 * Uma caixa por dígito (visual do handoff), mas o estado continua
 * sendo uma string só — cada caixa só reflete `value[index]`. Aceita
 * mais de um caractere no evento de troca (colar o código todo, ou
 * autofill de SMS no iOS/Android) distribuindo os dígitos a partir da
 * caixa atual, em vez de descartar o excesso.
 */
export function OtpInput({ length, value, onChange, disabled }: OtpInputProps) {
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  function handleChange(index: number, event: ChangeEvent<HTMLInputElement>): void {
    const digits = extractDigits(event.target.value);

    if (digits.length > 1) {
      const merged = (value.slice(0, index) + digits).slice(0, length);
      onChange(merged);
      inputRefs.current[Math.min(merged.length, length - 1)]?.focus();
      return;
    }

    const chars = value.split('');
    chars[index] = digits;
    const next = chars.join('').slice(0, length);
    onChange(next);

    if (digits && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Backspace' && index > 0 && !value[index]) {
      event.preventDefault();
      const chars = value.split('');
      chars[index - 1] = '';
      onChange(chars.join(''));
      inputRefs.current[index - 1]?.focus();
    }
  }

  return (
    <div className="flex gap-2.5" role="group" aria-label="Código de verificação">
      {Array.from({ length }).map((_, index) => (
        <input
          key={index}
          ref={(el) => {
            inputRefs.current[index] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          maxLength={length}
          disabled={disabled}
          value={value[index] ?? ''}
          onChange={(event) => handleChange(index, event)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          aria-label={`Dígito ${index + 1} de ${length}`}
          className="aspect-square w-full min-w-0 flex-1 rounded-[14px] border border-border bg-surface text-center font-mono text-2xl font-semibold text-text transition focus:border-2 focus:border-primary focus:text-primary focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
        />
      ))}
    </div>
  );
}
