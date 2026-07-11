'use client';

import { ApiError, CNH_CATEGORY_OPTIONS, createSkillCategory, listSkillCategories, SkillCategory } from '@shift/shared';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useEffect, useState } from 'react';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { JobTermsCheckbox } from '../../../../components/ui/job-terms-checkbox';
import { getCurrentPosition } from '../../../../lib/geolocation';
import { createJob, Job, listMyJobs } from '../../../../lib/jobs-api';
import { useCompanyProfile } from '../../company-profile-context';

const PAY_AMOUNT_REGEX = /^\d+(\.\d{1,2})?$/;
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

  const [categoryId, setCategoryId] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [requiresExperience, setRequiresExperience] = useState<boolean | null>(null);
  const [dressCode, setDressCode] = useState('');
  const [toolsRequired, setToolsRequired] = useState('');
  const [cnhCategory, setCnhCategory] = useState('');
  const [cnhRequired, setCnhRequired] = useState(false);
  const [description, setDescription] = useState('');
  const [addressLabel, setAddressLabel] = useState('');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
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
    setDescription(template.description);
    setAddressLabel(template.addressLabel);
    setLat(template.locationLat);
    setLng(template.locationLng);
    setPositionsTotal(String(template.positionsTotal));
    setPayAmount(template.payAmount);
    // Data/hora e prazo de candidatura ficam de fora de propósito —
    // são sempre novos pra cada escala, não fazem sentido copiados.
  }

  async function handleUseCurrentLocation(): Promise<void> {
    setLocationError(null);
    setIsLocating(true);
    try {
      const position = await getCurrentPosition();
      setLat(position.coords.latitude);
      setLng(position.coords.longitude);
    } catch (err) {
      setLocationError(err instanceof Error ? err.message : 'Não foi possível obter sua localização.');
    } finally {
      setIsLocating(false);
    }
  }

  const positionsTotalNumber = Number(positionsTotal);
  const payAmountNumber = Number(payAmount);
  const showEstimate =
    Number.isInteger(positionsTotalNumber) &&
    positionsTotalNumber >= 1 &&
    PAY_AMOUNT_REGEX.test(payAmount) &&
    payAmountNumber > 0;
  const estimateTotal = positionsTotalNumber * payAmountNumber;
  const isNewCategory = categoryId === NEW_CATEGORY_OPTION;

  // Cada condição de isValid vira um item aqui, na mesma ordem — se
  // ficar cinza sem explicação, ninguém acha o campo que falta (foi
  // o caso real do botão "Publicar" travado sem nenhuma pista visível).
  const missingFields: string[] = [];
  if (categoryId === '') missingFields.push('categoria');
  if (isNewCategory && newCategoryName.trim().length < 2) missingFields.push('nome da nova categoria');
  if (requiresExperience === null) missingFields.push('exigência de experiência');
  if (description.trim().length < 10) missingFields.push('descrição');
  if (addressLabel.trim().length < 2) missingFields.push('endereço');
  if (lat === null || lng === null) missingFields.push('localização (clique em "Usar minha localização atual")');
  if (!Number.isInteger(positionsTotalNumber) || positionsTotalNumber < 1) missingFields.push('número de vagas');
  if (!PAY_AMOUNT_REGEX.test(payAmount) || Number(payAmount) <= 0) missingFields.push('valor por pessoa');
  if (startsAt === '') missingFields.push('início');
  if (endsAt === '') missingFields.push('término');
  if (startsAt !== '' && endsAt !== '' && !(new Date(endsAt) > new Date(startsAt))) {
    missingFields.push('término depois do início');
  }
  if (startsAt !== '' && !(new Date(startsAt) > new Date())) missingFields.push('início no futuro');
  if (applicationsCloseAt !== '' && startsAt !== '' && new Date(applicationsCloseAt) > new Date(startsAt)) {
    missingFields.push('prazo de candidatura até o início');
  }
  if (!termsAccepted) missingFields.push('confirmação de que a escala é intermediação avulsa');

  const isValid = missingFields.length === 0;

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
          addressLabel,
          locationLat: lat,
          locationLng: lng,
          positionsTotal: positionsTotalNumber,
          payAmount,
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
        <p className="text-[15px] text-text-secondary">
          Preencha os detalhes da escala que você precisa cobrir.
        </p>

        {profile && profile.verificationStatus !== 'approved' && (
          <div className="rounded-[18px] border border-warning/30 bg-warning/10 p-4">
            <p className="font-heading text-[15px] font-bold text-warning">Verificação pendente</p>
            <p className="mt-1 text-[13.5px] text-warning">
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

        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-4">
          <p className="font-heading text-sm font-bold text-text">O que essa vaga exige?</p>

          <div>
            <span className="mb-1.5 block text-sm font-medium text-text-secondary">
              Precisa de experiência anterior?
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setRequiresExperience(true)}
                className={`flex-1 rounded-md border px-3 py-2 text-sm font-semibold transition ${
                  requiresExperience === true
                    ? 'border-primary bg-primary text-white'
                    : 'border-border bg-surface text-text-secondary'
                }`}
              >
                Sim
              </button>
              <button
                type="button"
                onClick={() => setRequiresExperience(false)}
                className={`flex-1 rounded-md border px-3 py-2 text-sm font-semibold transition ${
                  requiresExperience === false
                    ? 'border-primary bg-primary text-white'
                    : 'border-border bg-surface text-text-secondary'
                }`}
              >
                Não
              </button>
            </div>
          </div>

          <Input
            id="dressCode"
            label="Vestimenta exigida (opcional)"
            type="text"
            placeholder="Social, uniforme fornecido, traje esportivo..."
            value={dressCode}
            onChange={(event) => setDressCode(event.target.value)}
          />

          <Input
            id="toolsRequired"
            label="Ferramentas que o profissional precisa levar (opcional)"
            type="text"
            placeholder="Câmera própria, ferramentas de bar..."
            value={toolsRequired}
            onChange={(event) => setToolsRequired(event.target.value)}
          />

          <div>
            <label htmlFor="cnhCategory" className="mb-1.5 block text-sm font-medium text-text-secondary">
              Exige CNH? (opcional)
            </label>
            <select
              id="cnhCategory"
              value={cnhCategory}
              onChange={(event) => setCnhCategory(event.target.value)}
              className="w-full rounded-md border border-border bg-surface px-3 py-2.5 text-base text-text transition focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/15"
            >
              <option value="">Nenhuma exigência</option>
              {CNH_CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {cnhCategory && (
              <div className="mt-2.5">
                <span className="mb-1.5 block text-sm font-medium text-text-secondary">
                  Isso é obrigatório pra se candidatar ou só uma preferência?
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setCnhRequired(true)}
                    className={`flex-1 rounded-md border px-3 py-2 text-sm font-semibold transition ${
                      cnhRequired
                        ? 'border-primary bg-primary text-white'
                        : 'border-border bg-surface text-text-secondary'
                    }`}
                  >
                    Obrigatório
                  </button>
                  <button
                    type="button"
                    onClick={() => setCnhRequired(false)}
                    className={`flex-1 rounded-md border px-3 py-2 text-sm font-semibold transition ${
                      !cnhRequired
                        ? 'border-primary bg-primary text-white'
                        : 'border-border bg-surface text-text-secondary'
                    }`}
                  >
                    Preferência
                  </button>
                </div>
                {cnhRequired && (
                  <p className="mt-1.5 text-xs text-text-secondary">
                    Quem não tiver CNH {cnhCategory} não vai conseguir se candidatar.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

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
            {lat !== null && lng !== null ? 'Localização definida ✓' : 'Usar minha localização atual'}
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

        {!isValid && <p className="text-xs text-text-secondary">Falta preencher: {missingFields.join(', ')}.</p>}

        <Button type="submit" disabled={!isValid} isLoading={isSubmitting}>
          Publicar
        </Button>
      </form>
    </main>
  );
}
