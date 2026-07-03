'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useEffect, useState } from 'react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { extractDigits } from '../../../lib/digits';
import { isValidOtpCode } from './otp-code';

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

  useEffect(() => {
    if (!phone) {
      router.replace('/entrar');
    }
  }, [phone, router]);

  if (!phone) {
    return null;
  }

  const isValid = isValidOtpCode(code);

  function handleSubmit(event: FormEvent): void {
    event.preventDefault();
    if (!isValid) return;
    // TODO (T2.10): chamar POST /auth/otp/verify com { phone, code }
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
          className="font-mono text-lg tracking-[0.3em]"
        />

        <Button type="submit" disabled={!isValid}>
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
