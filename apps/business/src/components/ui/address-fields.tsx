import { extractDigits, formatCep, lookupCep } from '@shift/shared';
import { useState } from 'react';
import { Input } from './input';

export interface AddressFieldsProps {
  cep: string;
  onChangeCep: (cep: string) => void;
  street: string;
  onChangeStreet: (street: string) => void;
  number: string;
  onChangeNumber: (number: string) => void;
  complement: string;
  onChangeComplement: (complement: string) => void;
  /** Preenchidos pela busca do CEP — não têm campo próprio, só entram no endereço final. */
  neighborhood: string;
  city: string;
  state: string;
  onResolvedCep: (result: { neighborhood: string; city: string; state: string }) => void;
}

/**
 * CEP → busca automática de rua/bairro/cidade/UF (ViaCEP) — o antigo
 * campo único "Endereço completo" livre confundia (empresa não sabia
 * o que exatamente escrever). Bairro/cidade/UF não têm input próprio:
 * só aparecem como confirmação depois que o CEP resolve, e entram
 * junto na hora de montar o endereço final (ver buildAddressLabel).
 */
export function AddressFields({
  cep,
  onChangeCep,
  street,
  onChangeStreet,
  number,
  onChangeNumber,
  complement,
  onChangeComplement,
  neighborhood,
  city,
  state,
  onResolvedCep,
}: AddressFieldsProps) {
  const [isLookingUpCep, setIsLookingUpCep] = useState(false);
  const [cepError, setCepError] = useState<string | null>(null);

  async function handleCepBlur(): Promise<void> {
    const digits = extractDigits(cep);
    if (digits.length !== 8) return;

    setCepError(null);
    setIsLookingUpCep(true);
    try {
      const result = await lookupCep(digits);
      onChangeStreet(result.street);
      onResolvedCep({ neighborhood: result.neighborhood, city: result.city, state: result.state });
    } catch (err) {
      setCepError(err instanceof Error ? err.message : 'Não foi possível buscar esse CEP.');
    } finally {
      setIsLookingUpCep(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-[160px_1fr]">
        <Input
          id="cep"
          label="CEP"
          type="text"
          inputMode="numeric"
          placeholder="01305-100"
          value={formatCep(extractDigits(cep))}
          onChange={(event) => onChangeCep(extractDigits(event.target.value))}
          onBlur={handleCepBlur}
          error={cepError ?? undefined}
        />
        <div className="col-span-2 sm:col-span-1">
          <Input
            id="street"
            label="Rua"
            type="text"
            placeholder={isLookingUpCep ? 'Buscando...' : 'Rua Augusta'}
            value={street}
            onChange={(event) => onChangeStreet(event.target.value)}
            disabled={isLookingUpCep}
          />
        </div>
      </div>

      {neighborhood && city && state && (
        <p className="-mt-2 text-xs text-text-secondary">
          {neighborhood}, {city} - {state}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Input
          id="number"
          label="Número"
          type="text"
          placeholder="1200"
          value={number}
          onChange={(event) => onChangeNumber(event.target.value)}
        />
        <Input
          id="complement"
          label="Complemento (opcional)"
          type="text"
          placeholder="Apto, sala, fundos..."
          value={complement}
          onChange={(event) => onChangeComplement(event.target.value)}
        />
      </div>
    </div>
  );
}

/** Monta o endereço final (o que o backend guarda e o trabalhador vê) a partir dos campos estruturados. */
export function buildAddressLabel({
  street,
  number,
  complement,
  neighborhood,
  city,
  state,
}: {
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
}): string {
  const streetLine = [street.trim(), number.trim()].filter(Boolean).join(', ');
  const withComplement = [streetLine, complement.trim()].filter(Boolean).join(' - ');
  const cityLine = [neighborhood.trim(), [city.trim(), state.trim()].filter(Boolean).join(' - ')]
    .filter(Boolean)
    .join(', ');
  return [withComplement, cityLine].filter(Boolean).join(' - ');
}
