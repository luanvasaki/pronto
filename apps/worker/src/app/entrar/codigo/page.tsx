'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useEffect, useState } from 'react';
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
      <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Digite o código</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Enviamos um código de 6 dígitos para {phone}.
          </p>
        </div>

        <div>
          <label htmlFor="code" className="mb-1 block text-sm font-medium text-zinc-700">
            Código
          </label>
          <input
            id="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="000000"
            value={code}
            onChange={(event) => setCode(extractDigits(event.target.value))}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-base tracking-widest focus:border-zinc-500 focus:outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={!isValid}
          className="rounded-md bg-zinc-900 px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:bg-zinc-300"
        >
          Confirmar
        </button>

        <Link href="/entrar" className="text-center text-sm text-zinc-600 underline">
          Trocar número
        </Link>
      </form>
    </main>
  );
}
