'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { extractDigits, isValidBrazilianPhone, toE164 } from './phone';

export default function EntrarPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('');

  const isValid = isValidBrazilianPhone(phone);

  function handleSubmit(event: FormEvent): void {
    event.preventDefault();
    if (!isValid) return;

    router.push(`/entrar/codigo?phone=${encodeURIComponent(toE164(phone))}`);
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4">
      <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Entre com seu celular</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Vamos mandar um código pra confirmar que é você.
          </p>
        </div>

        <div>
          <label htmlFor="phone" className="mb-1 block text-sm font-medium text-zinc-700">
            Celular
          </label>
          <input
            id="phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder="11999990000"
            value={phone}
            onChange={(event) => setPhone(extractDigits(event.target.value))}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-base focus:border-zinc-500 focus:outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={!isValid}
          className="rounded-md bg-zinc-900 px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:bg-zinc-300"
        >
          Continuar
        </button>
      </form>
    </main>
  );
}
