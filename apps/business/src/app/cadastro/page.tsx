'use client';

import { ApiError, extractDigits } from '@shift/shared';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Logo } from '../../components/ui/logo';
import { upsertCompanyProfile } from '../../lib/company-profile-api';
import { isValidCnpj } from './cnpj';

export default function CadastroPage() {
  const router = useRouter();
  const [legalName, setLegalName] = useState('');
  const [tradeName, setTradeName] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValid = legalName.trim().length >= 2 && tradeName.trim().length >= 2 && isValidCnpj(cnpj);

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!isValid || isSubmitting) return;

    setError(null);
    setIsSubmitting(true);

    try {
      await upsertCompanyProfile(legalName, tradeName, cnpj);
      router.push('/painel');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar o cadastro.');
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-8">
      <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-5">
        <Logo className="mb-2" />
        <div>
          <h1 className="font-heading text-2xl font-bold text-text">Complete o cadastro da empresa</h1>
          <p className="mt-1 text-[15px] text-text-secondary">
            Precisamos desses dados pra verificar sua empresa.
          </p>
        </div>

        <Input
          id="legalName"
          label="Razão social"
          type="text"
          autoComplete="organization"
          placeholder="Bar do Zé Ltda"
          value={legalName}
          onChange={(event) => setLegalName(event.target.value)}
        />

        <Input
          id="tradeName"
          label="Nome fantasia"
          type="text"
          placeholder="Bar do Zé"
          value={tradeName}
          onChange={(event) => setTradeName(event.target.value)}
        />

        <Input
          id="cnpj"
          label="CNPJ"
          type="text"
          inputMode="numeric"
          placeholder="00000000000000"
          maxLength={14}
          value={cnpj}
          onChange={(event) => setCnpj(extractDigits(event.target.value))}
        />

        {error && <p className="text-sm text-danger">{error}</p>}

        <Button type="submit" disabled={!isValid} isLoading={isSubmitting}>
          Continuar
        </Button>
      </form>
    </main>
  );
}
