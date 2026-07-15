'use client';

import { ApiError, BenefitProvision, listSkillCategories, SkillCategory } from '@shift/shared';
import { useParams, useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { Button } from '../../../../../components/ui/button';
import { Input } from '../../../../../components/ui/input';
import { JobBenefitsFields } from '../../../../../components/ui/job-benefits-fields';
import { JobRequirementsFields } from '../../../../../components/ui/job-requirements-fields';
import { useJobFormValidation } from '../../../../../hooks/use-job-form-validation';
import { getCurrentPosition } from '../../../../../lib/geolocation';
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
  const [mealProvision, setMealProvision] = useState<BenefitProvision>('none');
  const [mealAmount, setMealAmount] = useState('');
  const [transportProvision, setTransportProvision] = useState<BenefitProvision>('none');
  const [transportAmount, setTransportAmount] = useState('');
  const [description, setDescription] = useState('');
  const [addressLabel, setAddressLabel] = useState('');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [positionsTotal, setPositionsTotal] = useState('1');
  const [payAmount, setPayAmount] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  // Vazio = fecha automaticamente 1h antes do início (padrão do backend).
  const [applicationsCloseAt, setApplicationsCloseAt] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationJustUpdated, setLocationJustUpdated] = useState(false);

  async function handleUseCurrentLocation(): Promise<void> {
    setLocationError(null);
    setIsLocating(true);
    try {
      const position = await getCurrentPosition();
      setLat(position.coords.latitude);
      setLng(position.coords.longitude);
      setLocationJustUpdated(true);
    } catch (err) {
      setLocationError(err instanceof Error ? err.message : 'Não foi possível obter sua localização.');
    } finally {
      setIsLocating(false);
    }
  }

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
        setMealProvision(job.mealProvision);
        setMealAmount(job.mealAmount ?? '');
        setTransportProvision(job.transportProvision);
        setTransportAmount(job.transportAmount ?? '');
        setDescription(job.description);
        setAddressLabel(job.addressLabel);
        setLat(job.locationLat);
        setLng(job.locationLng);
        setPositionsTotal(String(job.positionsTotal));
        setPayAmount(job.payAmount);
        setStartsAt(toDateTimeLocal(job.startsAt));
        setEndsAt(toDateTimeLocal(job.endsAt));
        setApplicationsCloseAt(job.applicationsCloseAt ? toDateTimeLocal(job.applicationsCloseAt) : '');
      })
      .catch(() => setLoadError('Não foi possível carregar a vaga.'))
      .finally(() => setIsLoading(false));
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
  });

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!isValid || isSubmitting || lat === null || lng === null || requiresExperience === null) return;

    setError(null);
    setIsSubmitting(true);

    try {
      await updateJob(jobId, {
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
      });
      router.push('/painel');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar a vaga.');
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <main className="flex flex-1 items-center justify-center px-4">
        <p className="text-sm text-text-secondary">Carregando a vaga...</p>
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
        <p className="text-[15px] text-text-secondary">Corrija os detalhes da escala.</p>

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
          onMinorsAllowedChange={setMinorsAllowed}
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
          <Input
            id="addressLabel"
            label="Endereço completo"
            type="text"
            placeholder="Rua Augusta, 1200 - Consolação, São Paulo"
            value={addressLabel}
            onChange={(event) => setAddressLabel(event.target.value)}
          />
          <p className="mt-1.5 text-xs text-text-secondary">
            Inclua rua, número e bairro — é o endereço que o trabalhador vai usar pra chegar até você.
          </p>
        </div>

        <div>
          <Button type="button" variant="outlined" onClick={handleUseCurrentLocation} isLoading={isLocating}>
            {locationJustUpdated ? 'Localização atualizada ✓' : 'Usar minha localização atual'}
          </Button>
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
    </main>
  );
}
