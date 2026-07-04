'use client';

import { ApiError, extractDigits, isValidOtpCode, verifyOtp } from '@shift/shared';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useEffect, useState } from 'react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';

export default function CodigoPage() {
  return (
    <Suspense fallback={null}>
      <CodigoForm />
    </Suspense>
  );
}

function CodigoForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const phone = searchParams.get('phone');
  const [code, setCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!phone) {
      router.replace('/entrar');
    }
  }, [phone, router]);

  if (!phone) {
    return null;
  }

  // Reatribuído como `const` própria pro TypeScript carregar o tipo
  // estreitado (string, não string | null) pro closure do handleSubmit.
  const verifiedPhone: string = phone;
  const isValid = isValidOtpCode(code);

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!isValid || isSubmitting) return;

    setError(null);
    setIsSubmitting(true);

    try {
      await verifyOtp(verifiedPhone, code);
      // Sempre manda pro cadastro por enquanto, mesmo pra quem loga de
      // novo — ainda não existe um jeito de checar se o perfil já foi
      // completado (isso entra quando existir GET /company-profile).
      router.push('/cadastro');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível confirmar o código.');
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4">
      <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-5">
        <div>
          <h1 className="font-heading text-2xl font-bold text-text">Digite o código</h1>
          <p className="mt-1 text-[15px] text-text-secondary">
            Enviamos um código de 6 dígitos para {phone}.
          </p>
        </div>

        <Input
          id="code"
          label="Código"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="000000"
          value={code}
          onChange={(event) => setCode(extractDigits(event.target.value))}
          error={error ?? undefined}
          className="font-mono text-lg tracking-[0.3em]"
        />

        <Button type="submit" disabled={!isValid} isLoading={isSubmitting}>
          Confirmar
        </Button>

        <Link
          href="/entrar"
          className="text-center text-sm text-text-secondary underline underline-offset-2 hover:text-primary"
        >
          Trocar número
        </Link>
      </form>
    </main>
  );
}
