'use client';

import { ApiError, extractDigits, formatCnpj, formatCpf } from '@shift/shared';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Logo } from '../../components/ui/logo';
import { uploadCompanyDocument, upsertCompanyProfile } from '../../lib/company-profile-api';
import { isValidCnpj } from './cnpj';
import { isValidCpf } from './cpf';

type PersonType = 'juridica' | 'fisica';

export default function CadastroPage() {
  const router = useRouter();
  const [personType, setPersonType] = useState<PersonType>('juridica');
  const [legalName, setLegalName] = useState('');
  const [tradeName, setTradeName] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [cpf, setCpf] = useState('');
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isIndividual = personType === 'fisica';
  const isValid =
    legalName.trim().length >= 2 &&
    tradeName.trim().length >= 2 &&
    (isIndividual ? isValidCpf(cpf) : isValidCnpj(cnpj)) &&
    (!isIndividual || documentFile !== null);

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!isValid || isSubmitting) return;

    setError(null);
    setIsSubmitting(true);

    try {
      await upsertCompanyProfile({
        legalName,
        tradeName,
        personType,
        cnpj: isIndividual ? undefined : cnpj,
        cpf: isIndividual ? cpf : undefined,
      });
      if (isIndividual && documentFile) {
        await uploadCompanyDocument(documentFile);
      }
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
          <h1 className="font-heading text-2xl font-bold text-text">Complete o cadastro</h1>
          <p className="mt-1 text-[15px] text-text-secondary">
            Precisamos desses dados pra verificar sua conta.
          </p>
        </div>

        <div>
          <span className="mb-1.5 block text-sm font-medium text-text-secondary">Como você vai contratar?</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPersonType('juridica')}
              className={`flex-1 rounded-md border px-3 py-2 text-sm font-semibold transition ${
                personType === 'juridica'
                  ? 'border-primary bg-primary text-white'
                  : 'border-border bg-surface text-text-secondary'
              }`}
            >
              Empresa (CNPJ)
            </button>
            <button
              type="button"
              onClick={() => setPersonType('fisica')}
              className={`flex-1 rounded-md border px-3 py-2 text-sm font-semibold transition ${
                personType === 'fisica'
                  ? 'border-primary bg-primary text-white'
                  : 'border-border bg-surface text-text-secondary'
              }`}
            >
              Pessoa física (CPF)
            </button>
          </div>
          {isIndividual && (
            <p className="mt-1.5 text-xs text-text-secondary">
              Pra contratar um freelancer avulso, sem precisar abrir CNPJ.
            </p>
          )}
        </div>

        <Input
          id="legalName"
          label={isIndividual ? 'Nome completo' : 'Razão social'}
          type="text"
          autoComplete={isIndividual ? 'name' : 'organization'}
          placeholder={isIndividual ? 'Seu nome completo' : 'Bar do Zé Ltda'}
          value={legalName}
          onChange={(event) => setLegalName(event.target.value)}
        />

        <Input
          id="tradeName"
          label={isIndividual ? 'Como quer aparecer' : 'Nome fantasia'}
          type="text"
          placeholder={isIndividual ? 'Como os candidatos vão te ver' : 'Bar do Zé'}
          value={tradeName}
          onChange={(event) => setTradeName(event.target.value)}
        />

        {isIndividual ? (
          <Input
            id="cpf"
            label="CPF"
            type="text"
            inputMode="numeric"
            placeholder="000.000.000-00"
            maxLength={14}
            value={formatCpf(cpf)}
            onChange={(event) => setCpf(extractDigits(event.target.value).slice(0, 11))}
          />
        ) : (
          <Input
            id="cnpj"
            label="CNPJ"
            type="text"
            inputMode="numeric"
            placeholder="00.000.000/0000-00"
            maxLength={18}
            value={formatCnpj(cnpj)}
            onChange={(event) => setCnpj(extractDigits(event.target.value).slice(0, 14))}
          />
        )}

        {isIndividual && (
          <div>
            <label
              htmlFor="document"
              className="flex cursor-pointer flex-col items-center gap-2 rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-text-secondary transition hover:border-primary"
            >
              {documentFile ? documentFile.name : 'Toque para escolher uma foto ou PDF'}
              <input
                id="document"
                type="file"
                accept="image/jpeg,image/png,application/pdf"
                className="hidden"
                onChange={(event) => setDocumentFile(event.target.files?.[0] ?? null)}
              />
            </label>
            <p className="mt-1.5 text-xs text-text-secondary">
              Uma foto ou PDF do seu RG ou CNH — sem CNPJ pra respaldar, é assim que confirmamos quem é você.
            </p>
          </div>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}

        <Button type="submit" disabled={!isValid} isLoading={isSubmitting}>
          Continuar
        </Button>
      </form>
    </main>
  );
}
