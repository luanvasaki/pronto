'use client';

import { ApiError, listSkillCategories } from '@shift/shared';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '../../../../components/ui/button';
import { MapLink } from '../../../../components/ui/map-link';
import { JobAnnouncement, listJobAnnouncements } from '../../../../lib/announcements-api';
import { applyToJob, getJobDetail, JobDetail } from '../../../../lib/jobs-api';
import { askQuestion, JobQuestion, listJobQuestions } from '../../../../lib/questions-api';

const CATEGORY_LABEL_FALLBACK = 'Categoria';

function formatDateRange(startsAt: string, endsAt: string): string {
  const formatter = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  return `${formatter.format(new Date(startsAt))} até ${formatter.format(new Date(endsAt))}`;
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

export default function VagaDetalhePage() {
  const params = useParams<{ id: string }>();
  const jobId = params.id;

  const [job, setJob] = useState<JobDetail | null>(null);
  const [categoryNames, setCategoryNames] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [applied, setApplied] = useState(false);
  const [experienceConfirmed, setExperienceConfirmed] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);

  const [announcements, setAnnouncements] = useState<JobAnnouncement[]>([]);
  const [announcementsLoadError, setAnnouncementsLoadError] = useState(false);
  const [questions, setQuestions] = useState<JobQuestion[]>([]);
  const [questionsLoadError, setQuestionsLoadError] = useState(false);
  const [newQuestion, setNewQuestion] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getJobDetail(jobId), listSkillCategories()])
      .then(([jobResult, categoriesResult]) => {
        setJob(jobResult);
        setApplied(jobResult.hasApplied);
        setCategoryNames(Object.fromEntries(categoriesResult.categories.map((c) => [c.id, c.name])));
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Não foi possível carregar a vaga.'))
      .finally(() => setIsLoading(false));
  }, [jobId]);

  function loadAnnouncements(): void {
    setAnnouncementsLoadError(false);
    listJobAnnouncements(jobId)
      .then((result) => setAnnouncements(result.announcements))
      .catch(() => setAnnouncementsLoadError(true));
  }

  function loadQuestions(): void {
    setQuestionsLoadError(false);
    listJobQuestions(jobId)
      .then((result) => setQuestions(result.questions))
      .catch(() => setQuestionsLoadError(true));
  }

  useEffect(() => {
    if (!applied) return;
    loadAnnouncements();
    loadQuestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, applied]);

  async function handleApply(): Promise<void> {
    setApplyError(null);
    setIsApplying(true);
    try {
      await applyToJob(jobId);
      setApplied(true);
    } catch (err) {
      setApplyError(err instanceof ApiError ? err.message : 'Não foi possível enviar sua candidatura.');
    } finally {
      setIsApplying(false);
    }
  }

  async function handleAskQuestion(): Promise<void> {
    const question = newQuestion.trim();
    if (!question || isAsking) return;

    setAskError(null);
    setIsAsking(true);
    try {
      const created = await askQuestion(jobId, question);
      setQuestions((current) => [...current, created]);
      setNewQuestion('');
    } catch (err) {
      setAskError(err instanceof ApiError ? err.message : 'Não foi possível enviar sua pergunta.');
    } finally {
      setIsAsking(false);
    }
  }

  if (isLoading) {
    return (
      <main className="flex flex-1 items-center justify-center px-4">
        <p className="text-sm text-text-secondary">Carregando vaga...</p>
      </main>
    );
  }

  if (error || !job) {
    return (
      <main className="flex flex-1 items-center justify-center px-4 text-center">
        <p className="text-sm text-danger">{error ?? 'Vaga não encontrada.'}</p>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col gap-4 px-5 py-8">
      <div>
        <p className="font-heading text-2xl font-bold text-text">
          {categoryNames[job.categoryId] ?? CATEGORY_LABEL_FALLBACK}
        </p>
        <p className="mt-1 text-[13.5px] text-text-secondary">
          {job.companyName}
          {job.companyAvgRating && ` · ★ ${job.companyAvgRating}`}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-background px-2.5 py-1.5 text-[12.5px] font-semibold text-text">
          {formatDateRange(job.startsAt, job.endsAt)}
        </span>
        {job.requiresExperience && (
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-warning/10 px-2.5 py-1.5 text-[12.5px] font-semibold text-warning">
            Experiência necessária
          </span>
        )}
        {job.cnhCategory && (
          <span
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] font-semibold ${
              job.cnhRequired ? 'bg-warning/10 text-warning' : 'bg-background text-text'
            }`}
          >
            CNH {job.cnhCategory} {job.cnhRequired ? 'obrigatória' : '(preferência)'}
          </span>
        )}
        {job.offersMeal && (
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-background px-2.5 py-1.5 text-[12.5px] font-semibold text-text">
            Alimentação
          </span>
        )}
        {job.offersTransport && (
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-background px-2.5 py-1.5 text-[12.5px] font-semibold text-text">
            Transporte
          </span>
        )}
      </div>

      <p className="font-heading text-2xl font-bold text-primary">R$ {job.payAmount}</p>

      <div className="rounded-2xl border border-border bg-surface p-4">
        <p className="font-heading text-sm font-bold text-text">Descrição</p>
        <p className="mt-1.5 text-[14.5px] whitespace-pre-wrap text-text">{job.description}</p>
      </div>

      <MapLink addressLabel={job.addressLabel} lat={job.locationLat} lng={job.locationLng} className="text-[13.5px]" />
      {job.dressCode && (
        <p className="text-[13.5px] text-text-secondary">
          <span className="font-semibold text-text">Vestimenta:</span> {job.dressCode}
        </p>
      )}
      {job.toolsRequired && (
        <p className="text-[13.5px] text-text-secondary">
          <span className="font-semibold text-text">Leve com você:</span> {job.toolsRequired}
        </p>
      )}

      {!job.matchesSkills && (
        <p className="rounded-lg bg-danger/10 px-2.5 py-1.5 text-[12.5px] font-semibold text-danger">
          Você não tem essa especialidade no seu perfil — pode se candidatar mesmo assim.
        </p>
      )}

      {!applied && job.status === 'open' && (
        <>
          {job.experienceMismatch && (
            <label className="flex items-start gap-2 rounded-lg bg-danger/10 px-2.5 py-2 text-[12.5px] font-semibold text-danger">
              <input
                type="checkbox"
                checked={experienceConfirmed}
                onChange={() => setExperienceConfirmed((current) => !current)}
                className="mt-0.5 shrink-0"
              />
              Essa vaga pede experiência anterior e você não tem isso declarado no perfil. Confirmo que quero me
              candidatar mesmo assim.
            </label>
          )}

          {job.cnhMismatch && (
            <p className="rounded-lg bg-danger/10 px-2.5 py-1.5 text-[12.5px] font-semibold text-danger">
              {job.cnhRequired
                ? `Essa vaga exige CNH categoria ${job.cnhCategory} — você não tem essa categoria no perfil, então não pode se candidatar.`
                : `Essa vaga prefere CNH categoria ${job.cnhCategory} — você pode se candidatar mesmo assim.`}
            </p>
          )}

          {applyError && <p className="text-sm text-danger">{applyError}</p>}

          <Button
            type="button"
            disabled={(job.experienceMismatch && !experienceConfirmed) || (job.cnhMismatch && job.cnhRequired)}
            isLoading={isApplying}
            onClick={handleApply}
          >
            Aceitar escala
          </Button>
        </>
      )}

      {applied && (
        <p className="rounded-lg bg-success/10 px-2.5 py-1.5 text-[13px] font-semibold text-success">
          Candidatura enviada ✓
        </p>
      )}

      {applied && (
        <>
          <section className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
            <p className="font-heading text-[15px] font-bold text-text">Avisos da empresa</p>
            {announcementsLoadError ? (
              <p className="text-sm text-danger">
                Não foi possível carregar os avisos.{' '}
                <button type="button" onClick={loadAnnouncements} className="underline underline-offset-2">
                  Tentar de novo
                </button>
              </p>
            ) : announcements.length === 0 ? (
              <p className="text-sm text-text-secondary">Nenhum aviso ainda.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {announcements.map((announcement) => (
                  <li key={announcement.id} className="rounded-lg bg-background p-3">
                    <p className="text-sm text-text">{announcement.message}</p>
                    <p className="mt-1 text-xs text-text-secondary">{formatDateTime(announcement.createdAt)}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="mb-4 flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
            <p className="font-heading text-[15px] font-bold text-text">Perguntas e respostas</p>
            {questionsLoadError && (
              <p className="text-sm text-danger">
                Não foi possível carregar as perguntas.{' '}
                <button type="button" onClick={loadQuestions} className="underline underline-offset-2">
                  Tentar de novo
                </button>
              </p>
            )}
            {!questionsLoadError && questions.length === 0 && (
              <p className="text-sm text-text-secondary">Nenhuma pergunta ainda.</p>
            )}
            <ul className="flex flex-col gap-2">
              {questions.map((question) => (
                <li key={question.id} className="rounded-lg bg-background p-3">
                  <p className="text-[12.5px] font-semibold text-text-secondary">{question.worker.fullName}</p>
                  <p className="mt-0.5 text-sm text-text">{question.question}</p>
                  {question.answer && (
                    <p className="mt-1.5 text-sm text-success">
                      <span className="font-semibold">Resposta:</span> {question.answer}
                    </p>
                  )}
                </li>
              ))}
            </ul>

            <div className="flex flex-col gap-1.5">
              <textarea
                rows={2}
                placeholder="Faça uma pergunta pra empresa..."
                value={newQuestion}
                onChange={(event) => setNewQuestion(event.target.value)}
                className="w-full rounded-[14px] border border-border bg-background px-3.5 py-3 text-sm text-text transition focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/15"
              />
              {askError && <p className="text-sm text-danger">{askError}</p>}
              <Button type="button" isLoading={isAsking} disabled={!newQuestion.trim()} onClick={handleAskQuestion}>
                Perguntar
              </Button>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
