'use client';

import { ApiError, BenefitProvision, createSkillCategory, listSkillCategories, SkillCategory } from '@shift/shared';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useEffect, useRef, useState } from 'react';
import { AddressFields, buildAddressLabel } from '../../../../components/ui/address-fields';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { JobBenefitsFields } from '../../../../components/ui/job-benefits-fields';
import { JobRequirementsFields } from '../../../../components/ui/job-requirements-fields';
import { JobTermsCheckbox } from '../../../../components/ui/job-terms-checkbox';
import { useAddressGeocoding } from '../../../../hooks/use-address-geocoding';
import { useJobFormValidation } from '../../../../hooks/use-job-form-validation';
import { createJob, Job, listMyJobs } from '../../../../lib/jobs-api';
import { useCompanyProfile } from '../../company-profile-context';

const NEW_CATEGORY_OPTION = '__new__';
// listMyJobs() traz o histórico inteiro da empresa — pra uma conta com
// centenas de vagas, isso vira uma lista gigante só pra popular um
// dropdown de modelo. Sem endpoint dedicado no backend pra isso ainda,
// pelo menos limita quantas entram no <select> (mais recentes primeiro).
const MAX_TEMPLATE_JOBS = 20;

/** yyyy-mm-dd (formato do <input type="date"> e do que a Escala manda na URL) — recusa qualquer outra coisa. */
const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export default function NovaVagaPage() {
  return (
    <Suspense fallback={null}>
      <NovaVagaForm />
    </Suspense>
  );
}

function NovaVagaForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { profile } = useCompanyProfile();

  const [categories, setCategories] = useState<SkillCategory[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);

  // Toda vaga publicada já serve de modelo — esse picker deixa escolher
  // uma vaga anterior (própria, qualquer status) pra pré-preencher o
  // formulário, sem precisar redigitar tudo de novo pra uma escala recorrente.
  const [previousJobs, setPreviousJobs] = useState<Job[]>([]);
  const [templateJobId, setTemplateJobId] = useState('');
  // Vindo da Escala (clicou em "Duplicar" num card) — aplica o template
  // automaticamente assim que a vaga aparecer em previousJobs, sem exigir
  // que a pessoa abra o dropdown na mão. Só uma vez: depois disso a escolha
  // é do usuário (não queremos reaplicar se ele trocar o select manualmente).
  const templateIdFromUrl = searchParams.get('template');
  const appliedTemplateFromUrlRef = useRef(false);

  const [categoryId, setCategoryId] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
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
  // Vindo da Escala (clicou num dia do calendário) — pré-preenche a
  // data com um horário comum de escala; a pessoa ainda ajusta a hora.
  const prefilledDate = searchParams.get('data');
  const [startsAt, setStartsAt] = useState(
    prefilledDate && DATE_ONLY_REGEX.test(prefilledDate) ? `${prefilledDate}T18:00` : '',
  );
  const [endsAt, setEndsAt] = useState('');
  // Vazio = fecha automaticamente 1h antes do início (padrão do backend).
  const [applicationsCloseAt, setApplicationsCloseAt] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listSkillCategories()
      .then((data) => setCategories(data.categories))
      .catch(() => setError('Não foi possível carregar as categorias.'))
      .finally(() => setIsLoadingCategories(false));
  }, []);

  useEffect(() => {
    listMyJobs()
      .then((data) => {
        const mostRecent = [...data.jobs]
          .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime())
          .slice(0, MAX_TEMPLATE_JOBS);
        setPreviousJobs(mostRecent);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (appliedTemplateFromUrlRef.current || !templateIdFromUrl) return;
    if (!previousJobs.some((job) => job.id === templateIdFromUrl)) return;

    appliedTemplateFromUrlRef.current = true;
    handleUseTemplate(templateIdFromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previousJobs, templateIdFromUrl]);

  function handleUseTemplate(jobId: string): void {
    setTemplateJobId(jobId);
    const template = previousJobs.find((job) => job.id === jobId);
    if (!template) return;

    setCategoryId(template.categoryId);
    setRequiresExperience(template.requiresExperience);
    setDressCode(template.dressCode ?? '');
    setToolsRequired(template.toolsRequired ?? '');
    setCnhCategory(template.cnhCategory ?? '');
    setCnhRequired(template.cnhRequired);
    setMinorsAllowed(template.minorsAllowed);
    setMealProvision(template.mealProvision);
    setMealAmount(template.mealAmount ?? '');
    setTransportProvision(template.transportProvision);
    setTransportAmount(template.transportAmount ?? '');
    setDescription(template.description);
    // O endereço salvo é um texto livre (formato antigo) — não dá pra
    // separar em CEP/número/complemento de volta, então só joga tudo
    // em "Rua" como ponto de partida; a pessoa refaz pelo CEP se quiser.
    setCep('');
    setStreet(template.addressLabel);
    setNumber('');
    setComplement('');
    setNeighborhood('');
    setCity('');
    setState('');
    setInitialLocation(template.locationLat, template.locationLng);
    setPositionsTotal(String(template.positionsTotal));
    setPayAmount(template.payAmount);
    // Data/hora e prazo de candidatura ficam de fora de propósito —
    // são sempre novos pra cada escala, não fazem sentido copiados.
  }

  // CEP resolvido já dá rua/bairro/cidade/UF — o suficiente pra uma
  // primeira tentativa de geocodificação, mesmo antes do número.
  useEffect(() => {
    if (!neighborhood && !city && !state) return;
    void geocodeAddress(buildAddressLabel({ street, number, complement, neighborhood, city, state }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [neighborhood, city, state]);

  const isNewCategory = categoryId === NEW_CATEGORY_OPTION;

  const { positionsTotalNumber, showEstimate, estimateTotal, missingFields, isValid } = useJobFormValidation({
    categoryId,
    isNewCategory,
    newCategoryName,
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
    termsAccepted,
  });

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!isValid || isSubmitting || lat === null || lng === null || requiresExperience === null) return;

    setError(null);
    setIsSubmitting(true);

    try {
      const resolvedCategoryId = isNewCategory
        ? (await createSkillCategory(newCategoryName.trim())).id
        : categoryId;

      await createJob(
        {
          categoryId: resolvedCategoryId,
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
        termsAccepted,
      );
      router.push('/painel');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível publicar a vaga.');
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-8">
      <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-5">
        <p className="text-[16px] text-text-secondary">
          Preencha os detalhes da escala que você precisa cobrir.
        </p>

        {profile && profile.verificationStatus !== 'approved' && (
          <div className="rounded-lg border border-warning/30 bg-warning/10 p-4">
            <p className="font-heading text-[16px] font-bold text-warning">Verificação pendente</p>
            <p className="mt-1 text-[14px] text-warning">
              Sua empresa ainda não foi verificada — não é possível publicar vagas até um admin aprovar o
              cadastro. Você pode preencher o formulário, mas a publicação vai ser recusada até lá.
            </p>
          </div>
        )}

        {previousJobs.length > 0 && (
          <div>
            <label htmlFor="templateJobId" className="mb-1.5 block text-sm font-medium text-text-secondary">
              Usar vaga anterior como base (opcional)
            </label>
            <select
              id="templateJobId"
              value={templateJobId}
              onChange={(event) => handleUseTemplate(event.target.value)}
              className="w-full rounded-md border border-border bg-surface px-3 py-2.5 text-base text-text transition focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/15"
            >
              <option value="">Começar do zero</option>
              {previousJobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.description.slice(0, 60)}
                  {job.description.length > 60 ? '…' : ''} · R$ {job.payAmount}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-text-secondary">
              Preenche categoria, exigências, endereço e valor com os dados dessa vaga — data, horário e
              vagas você ajusta na hora.
            </p>
          </div>
        )}

        <div>
          <label htmlFor="categoryId" className="mb-1.5 block text-sm font-medium text-text-secondary">
            Categoria
          </label>
          <select
            id="categoryId"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            disabled={isLoadingCategories}
            className="w-full rounded-md border border-border bg-surface px-3 py-2.5 text-base text-text transition focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/15"
          >
            <option value="">
              {isLoadingCategories ? 'Carregando categorias...' : 'Selecione uma categoria'}
            </option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
            <option value={NEW_CATEGORY_OPTION}>+ Criar nova categoria</option>
          </select>
          {isNewCategory && (
            <div className="mt-2.5">
              <Input
                id="newCategoryName"
                label="Nome da nova categoria"
                type="text"
                placeholder="Manobrista, Recepcionista..."
                value={newCategoryName}
                onChange={(event) => setNewCategoryName(event.target.value)}
              />
              <p className="mt-1.5 text-xs text-text-secondary">
                Já pode usar essa vaga assim que publicar — o admin revisa o nome da categoria depois.
              </p>
            </div>
          )}
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
            placeholder="Outros detalhes que o profissional precisa saber..."
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
          placeholder="130.00"
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

        <JobTermsCheckbox checked={termsAccepted} onChange={setTermsAccepted} />

        {error && <p className="text-sm text-danger">{error}</p>}

        {!isValid && <p className="text-xs text-danger">Falta preencher: {missingFields.join(', ')}.</p>}

        <Button type="submit" disabled={!isValid} isLoading={isSubmitting}>
          Publicar
        </Button>
      </form>
    </main>
  );
}
