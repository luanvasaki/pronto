'use client';

import { ApiError, BenefitProvision, listSkillCategories, SkillCategory } from '@shift/shared';
import { useParams, useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { AddressFields, buildAddressLabel } from '../../../../../components/ui/address-fields';
import { Button } from '../../../../../components/ui/button';
import { Input } from '../../../../../components/ui/input';
import { JobBenefitsFields } from '../../../../../components/ui/job-benefits-fields';
import { JobRequirementsFields } from '../../../../../components/ui/job-requirements-fields';
import { MinorsTermsModal } from '../../../../../components/ui/minors-terms-modal';
import { Skeleton } from '../../../../../components/ui/skeleton';
import { useAddressGeocoding } from '../../../../../hooks/use-address-geocoding';
import { useJobFormValidation } from '../../../../../hooks/use-job-form-validation';
import { listMyJobs, updateJob } from '../../../../../lib/jobs-api';

/**
 * `job.startsAt`/`endsAt` chegam em UTC (ISO com "Z") — um `<input
 * type="datetime-local">` espera o horário LOCAL, sem timezone. Só
 * cortar a string (`.slice(0, 16)`) mostraria o relógio de UTC como
 * se fosse local: certo só por coincidência pra quem está em UTC+0,
 * errado (por até várias horas) pra qualquer empresa no Brasil — e ao
 * salvar sem mexer nesse campo, o horário da vaga mudaria sozinho.
 */
function toDateTimeLocal(value: string): string {
  const date = new Date(value);
  const localTime = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localTime.toISOString().slice(0, 16);
}

export default function EditarVagaPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const jobId = params.id;

  const [categories, setCategories] = useState<SkillCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [categoryId, setCategoryId] = useState('');
  const [requiresExperience, setRequiresExperience] = useState<boolean | null>(null);
  const [dressCode, setDressCode] = useState('');
  const [toolsRequired, setToolsRequired] = useState('');
  const [cnhCategory, setCnhCategory] = useState('');
  const [cnhRequired, setCnhRequired] = useState(false);
  const [minorsAllowed, setMinorsAllowed] = useState(false);
  const [minorsTermsAccepted, setMinorsTermsAccepted] = useState(false);
  const [showMinorsTermsModal, setShowMinorsTermsModal] = useState(false);

  /** Mesma lógica de vagas/nova — só abre o termo se ainda não tinha sido aceito antes (ver job.hasMinorsTermsAccepted). */
  function handleMinorsAllowedChange(value: boolean): void {
    setMinorsAllowed(value);
    if (value && !minorsTermsAccepted) {
      setShowMinorsTermsModal(true);
    }
  }
  const [mealProvision, setMealProvision] = useState<BenefitProvision>('none');
  const [mealAmount, setMealAmount] = useState('');
  const [transportProvision, setTransportProvision] = useState<BenefitProvision>('none');
  const [transportAmount, setTransportAmount] = useState('');
  const [description, setDescription] = useState('');
  const [cep, setCep] = useState('');
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [complement, setComplement] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const addressLabel = buildAddressLabel({ street, number, complement, neighborhood, city, state });
  const {
    lat,
    lng,
    locationSource,
    isGeocoding,
    isLocating,
    locationError,
    geocodeAddress,
    markAddressDirty,
    useCurrentLocation,
    setInitialLocation,
  } = useAddressGeocoding();
  const [positionsTotal, setPositionsTotal] = useState('1');
  const [payAmount, setPayAmount] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  // Vazio = fecha automaticamente 1h antes do início (padrão do backend).
  const [applicationsCloseAt, setApplicationsCloseAt] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // CEP resolvido já dá rua/bairro/cidade/UF — o suficiente pra uma
  // primeira tentativa de geocodificação, mesmo antes do número.
  useEffect(() => {
    if (!neighborhood && !city && !state) return;
    void geocodeAddress(buildAddressLabel({ street, number, complement, neighborhood, city, state }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [neighborhood, city, state]);

  useEffect(() => {
    Promise.all([listMyJobs(), listSkillCategories()])
      .then(([jobsResult, categoriesResult]) => {
        setCategories(categoriesResult.categories);

        const job = jobsResult.jobs.find((candidate) => candidate.id === jobId);
        if (!job) {
          setLoadError('Vaga não encontrada.');
          return;
        }
        if (job.status !== 'open') {
          setLoadError('Só é possível editar vagas abertas.');
          return;
        }

        setCategoryId(job.categoryId);
        setRequiresExperience(job.requiresExperience);
        setDressCode(job.dressCode ?? '');
        setToolsRequired(job.toolsRequired ?? '');
        setCnhCategory(job.cnhCategory ?? '');
        setCnhRequired(job.cnhRequired);
        setMinorsAllowed(job.minorsAllowed);
        setMinorsTermsAccepted(job.hasMinorsTermsAccepted);
        setMealProvision(job.mealProvision);
        setMealAmount(job.mealAmount ?? '');
        setTransportProvision(job.transportProvision);
        setTransportAmount(job.transportAmount ?? '');
        setDescription(job.description);
        // O endereço salvo é um texto livre (formato antigo) — não dá pra
        // separar em CEP/número/complemento de volta, então só joga tudo
        // em "Rua" como ponto de partida; o dono refaz pelo CEP se quiser
        // uma geocodificação mais precisa (mesmo trato de handleUseTemplate
        // em nova/page.tsx).
        setStreet(job.addressLabel);
        setInitialLocation(job.locationLat, job.locationLng);
        setPositionsTotal(String(job.positionsTotal));
        setPayAmount(job.payAmount);
        setStartsAt(toDateTimeLocal(job.startsAt));
        setEndsAt(toDateTimeLocal(job.endsAt));
        setApplicationsCloseAt(job.applicationsCloseAt ? toDateTimeLocal(job.applicationsCloseAt) : '');
      })
      .catch(() => setLoadError('Não foi possível carregar a vaga.'))
      .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  const { positionsTotalNumber, showEstimate, estimateTotal, missingFields, isValid } = useJobFormValidation({
    categoryId,
    requiresExperience,
    description,
    addressLabel,
    lat,
    lng,
    positionsTotal,
    payAmount,
    mealProvision,
    mealAmount,
    transportProvision,
    transportAmount,
    startsAt,
    endsAt,
    applicationsCloseAt,
    minorsAllowed,
    minorsTermsAccepted,
  });

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!isValid || isSubmitting || lat === null || lng === null || requiresExperience === null) return;

    setError(null);
    setIsSubmitting(true);

    try {
      await updateJob(
        jobId,
        {
          categoryId,
          description,
          requiresExperience,
          dressCode: dressCode.trim() || undefined,
          toolsRequired: toolsRequired.trim() || undefined,
          cnhCategory: cnhCategory || undefined,
          cnhRequired,
          minorsAllowed,
          mealProvision,
          mealAmount: mealProvision === 'paid' ? mealAmount.replace(',', '.') : undefined,
          transportProvision,
          transportAmount: transportProvision === 'paid' ? transportAmount.replace(',', '.') : undefined,
          addressLabel,
          locationLat: lat,
          locationLng: lng,
          positionsTotal: positionsTotalNumber,
          payAmount: payAmount.replace(',', '.'),
          startsAt: new Date(startsAt).toISOString(),
          endsAt: new Date(endsAt).toISOString(),
          applicationsCloseAt: applicationsCloseAt ? new Date(applicationsCloseAt).toISOString() : undefined,
        },
        minorsAllowed ? minorsTermsAccepted : undefined,
      );
      router.push('/painel');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar a vaga.');
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <main className="flex flex-1 items-center justify-center px-4 py-8">
        <div className="flex w-full max-w-sm flex-col gap-5" aria-hidden="true">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="flex flex-1 items-center justify-center px-4 text-center">
        <p className="text-sm text-danger">{loadError}</p>
      </main>
    );
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-8">
      <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-5">
        <p className="text-[16px] text-text-secondary">Corrija os detalhes da escala.</p>

        <div>
          <label htmlFor="categoryId" className="mb-1.5 block text-sm font-medium text-text-secondary">
            Categoria
          </label>
          <select
            id="categoryId"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            className="w-full rounded-md border border-border bg-surface px-3 py-2.5 text-base text-text transition focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/15"
          >
            <option value="">Selecione uma categoria</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        <JobRequirementsFields
          requiresExperience={requiresExperience}
          onRequiresExperienceChange={setRequiresExperience}
          dressCode={dressCode}
          onDressCodeChange={setDressCode}
          toolsRequired={toolsRequired}
          onToolsRequiredChange={setToolsRequired}
          cnhCategory={cnhCategory}
          onCnhCategoryChange={setCnhCategory}
          cnhRequired={cnhRequired}
          onCnhRequiredChange={setCnhRequired}
          minorsAllowed={minorsAllowed}
          onMinorsAllowedChange={handleMinorsAllowedChange}
        />

        <JobBenefitsFields
          mealProvision={mealProvision}
          onMealProvisionChange={setMealProvision}
          mealAmount={mealAmount}
          onMealAmountChange={setMealAmount}
          transportProvision={transportProvision}
          onTransportProvisionChange={setTransportProvision}
          transportAmount={transportAmount}
          onTransportAmountChange={setTransportAmount}
        />

        <div>
          <label htmlFor="description" className="mb-1.5 block text-sm font-medium text-text-secondary">
            Descrição
          </label>
          <textarea
            id="description"
            rows={3}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="w-full rounded-md border border-border bg-surface px-3 py-2.5 text-base text-text transition focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/15"
          />
          <p className="mt-1.5 text-xs text-text-secondary">Mínimo de 10 caracteres.</p>
        </div>

        <div>
          <p className="mb-1.5 text-sm font-medium text-text-secondary">Endereço</p>
          <AddressFields
            cep={cep}
            onChangeCep={(value) => {
              markAddressDirty();
              setCep(value);
            }}
            street={street}
            onChangeStreet={(value) => {
              markAddressDirty();
              setStreet(value);
            }}
            number={number}
            onChangeNumber={(value) => {
              markAddressDirty();
              setNumber(value);
            }}
            complement={complement}
            onChangeComplement={setComplement}
            neighborhood={neighborhood}
            city={city}
            state={state}
            onResolvedCep={(result) => {
              setNeighborhood(result.neighborhood);
              setCity(result.city);
              setState(result.state);
            }}
            onNumberBlur={() => void geocodeAddress(addressLabel)}
          />
          <p className="mt-1.5 text-xs text-text-secondary">
            Digite o CEP pra preencher a rua automaticamente — é o endereço que o trabalhador vai usar pra chegar até você.
          </p>
        </div>

        <div>
          <Button type="button" variant="outlined" onClick={useCurrentLocation} isLoading={isLocating}>
            {lat !== null && lng !== null ? 'Localização definida ✓' : 'Usar minha localização atual'}
          </Button>
          {isGeocoding && <p className="mt-1.5 text-xs text-text-secondary">Localizando esse endereço...</p>}
          {!isGeocoding && lat !== null && lng !== null && locationSource === 'auto' && (
            <p className="mt-1.5 text-xs text-text-secondary">Localização identificada automaticamente pelo endereço.</p>
          )}
          {locationError && <p className="mt-1.5 text-sm text-danger">{locationError}</p>}
        </div>

        <Input
          id="positionsTotal"
          label="Número de vagas"
          type="number"
          min={1}
          value={positionsTotal}
          onChange={(event) => setPositionsTotal(event.target.value)}
        />

        <Input
          id="payAmount"
          label="Valor por pessoa (R$)"
          type="text"
          inputMode="decimal"
          value={payAmount}
          onChange={(event) => setPayAmount(event.target.value)}
        />

        <Input
          id="startsAt"
          label="Início"
          type="datetime-local"
          value={startsAt}
          onChange={(event) => setStartsAt(event.target.value)}
        />

        <Input
          id="endsAt"
          label="Término"
          type="datetime-local"
          value={endsAt}
          onChange={(event) => setEndsAt(event.target.value)}
        />

        <div>
          <Input
            id="applicationsCloseAt"
            label="Fechar candidaturas em (opcional)"
            type="datetime-local"
            value={applicationsCloseAt}
            onChange={(event) => setApplicationsCloseAt(event.target.value)}
          />
          <p className="mt-1.5 text-xs text-text-secondary">
            Depois desse horário a vaga some da busca dos profissionais. Se não escolher, fecha
            automaticamente 1h antes do início.
          </p>
          {applicationsCloseAt !== '' && startsAt !== '' && new Date(applicationsCloseAt) > new Date(startsAt) && (
            <p className="mt-1.5 text-xs text-danger">Precisa ser até o horário de início da escala.</p>
          )}
        </div>

        {showEstimate && (
          <div className="rounded-2xl bg-secondary p-4 text-background">
            <p className="text-xs tracking-wide text-text-secondary uppercase">
              Estimativa · {positionsTotalNumber} vaga(s)
            </p>
            <div className="mt-3 flex items-center justify-between">
              <span className="font-heading text-base font-bold">Total estimado</span>
              <span className="font-heading text-2xl font-extrabold text-primary">
                R$ {estimateTotal.toFixed(2)}
              </span>
            </div>
          </div>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}

        {!isValid && <p className="text-xs text-danger">Falta preencher: {missingFields.join(', ')}.</p>}

        <Button type="submit" disabled={!isValid} isLoading={isSubmitting}>
          Salvar alterações
        </Button>
      </form>

      {showMinorsTermsModal && (
        <MinorsTermsModal
          onAccept={() => {
            setMinorsTermsAccepted(true);
            setShowMinorsTermsModal(false);
          }}
          onCancel={() => {
            setMinorsAllowed(false);
            setShowMinorsTermsModal(false);
          }}
        />
      )}
    </main>
  );
}
