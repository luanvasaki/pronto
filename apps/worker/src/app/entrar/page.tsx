'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { ApiError } from '../../lib/api';
import { requestOtp } from '../../lib/auth-api';
import { extractDigits, isValidBrazilianPhone, toE164 } from './phone';

export default function EntrarPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValid = isValidBrazilianPhone(phone);

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!isValid || isSubmitting) return;

    setError(null);
    setIsSubmitting(true);
    const e164 = toE164(phone);

    try {
      await requestOtp(e164);
      router.push(`/entrar/codigo?phone=${encodeURIComponent(e164)}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível enviar o código.');
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4">
      <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-5">
        <div>
          <h1 className="font-heading text-2xl font-bold text-text">Entre com seu celular</h1>
          <p className="mt-1 text-[15px] text-text-secondary">
            Vamos mandar um código pra confirmar que é você.
          </p>
        </div>

        <Input
          id="phone"
          label="Celular"
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          placeholder="11999990000"
          value={phone}
          onChange={(event) => setPhone(extractDigits(event.target.value))}
          error={error ?? undefined}
        />

        <Button type="submit" disabled={!isValid} isLoading={isSubmitting}>
          Continuar
        </Button>
      </form>
    </main>
  );
}
