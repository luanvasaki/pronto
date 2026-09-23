'use client';

import { ApiError, ConsentDocumentResponse } from '@shift/shared';
import { useState } from 'react';
import { AdminMinorsTermsJob, getConsentDocumentVersion } from '../../lib/admin-api';

const DATE_FORMATTER = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

export interface ConsentHistoryProps {
  termsAcceptedAt: string | null;
  termsVersion: string | null;
  termsIpAddress: string | null;
  loginTermsAcceptedAt: string | null;
  loginTermsVersion: string | null;
  loginTermsIpAddress: string | null;
  minorsTermsJobs?: AdminMinorsTermsJob[];
}

interface FullTextToggleProps {
  type: ConsentDocumentResponse['type'];
  version: string;
}

/**
 * Busca sob demanda (só quando o admin pede) o texto exato da versão
 * aceita — não a versão vigente hoje, que pode já ter mudado (ver
 * get-consent-document-version.controller.ts no backend). Cada clique
 * refaz a busca em vez de cachear: é consultado raramente, não vale a
 * complexidade de um cache client-side pra isso.
 */
function FullTextToggle({ type, version }: FullTextToggleProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consentDocument, setConsentDocument] = useState<ConsentDocumentResponse | null>(null);

  async function handleToggle(): Promise<void> {
    if (isOpen) {
      setIsOpen(false);
      return;
    }

    setIsOpen(true);
    if (consentDocument) return;

    setIsLoading(true);
    setError(null);
    try {
      const result = await getConsentDocumentVersion(type, version);
      setConsentDocument(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível carregar o texto dessa versão.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={handleToggle}
        className="text-[13px] text-primary underline underline-offset-2"
      >
        {isOpen ? 'Ocultar texto completo' : 'Ver texto completo desta versão'}
      </button>

      {isOpen && (
        <div className="mt-2 max-h-64 overflow-y-auto rounded-lg border border-border bg-surface p-3 text-[13px] text-text">
          {isLoading && <p className="text-text-secondary">Carregando...</p>}
          {error && <p className="text-danger">{error}</p>}
          {consentDocument && (
            <div className="flex flex-col gap-3">
              {consentDocument.chapters.map((chapter) => (
                <div key={chapter.number}>
                  <p className="font-semibold">
                    {chapter.number}. {chapter.heading}
                  </p>
                  <p className="whitespace-pre-wrap text-text-secondary">{chapter.body}</p>
                </div>
              ))}
              <div>
                <p className="font-semibold">Declaração de aceite</p>
                <p className="whitespace-pre-wrap text-text-secondary">{consentDocument.declaration}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Prova de aceite pra eventual disputa jurídica (seção 12.5 do termo
 * consolidado) — versão + data/hora + IP de cada aceite, colapsado por
 * padrão já que é consultado raramente (não é info do dia a dia).
 */
export function ConsentHistory({
  termsAcceptedAt,
  termsVersion,
  termsIpAddress,
  loginTermsAcceptedAt,
  loginTermsVersion,
  loginTermsIpAddress,
  minorsTermsJobs,
}: ConsentHistoryProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mt-3 border-t border-border pt-2.5">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="text-sm text-text-secondary underline underline-offset-2"
      >
        {isOpen ? 'Ocultar' : 'Ver'} histórico de aceite de termos
      </button>

      {isOpen && (
        <dl className="mt-2 flex flex-col gap-2 text-[13px] text-text-secondary">
          <div>
            <dt className="font-semibold text-text">Termo de uso (cadastro)</dt>
            {termsAcceptedAt && termsVersion ? (
              <>
                <dd>
                  v{termsVersion} · {DATE_FORMATTER.format(new Date(termsAcceptedAt))} · IP {termsIpAddress ?? '—'}
                </dd>
                <FullTextToggle type="platform_terms" version={termsVersion} />
              </>
            ) : (
              <dd>Ainda não aceito.</dd>
            )}
          </div>

          <div>
            <dt className="font-semibold text-text">Termo resumido de ciência (login)</dt>
            {loginTermsAcceptedAt && loginTermsVersion ? (
              <>
                <dd>
                  v{loginTermsVersion} · {DATE_FORMATTER.format(new Date(loginTermsAcceptedAt))} · IP{' '}
                  {loginTermsIpAddress ?? '—'}
                </dd>
                <FullTextToggle type="login_summary" version={loginTermsVersion} />
              </>
            ) : (
              <dd>Ainda não aceito.</dd>
            )}
          </div>

          {minorsTermsJobs && (
            <div>
              <dt className="font-semibold text-text">Termo de vagas pra menores de idade</dt>
              {minorsTermsJobs.length === 0 ? (
                <dd>Nenhuma vaga com essa opção aceita.</dd>
              ) : (
                <ul className="flex flex-col gap-2">
                  {minorsTermsJobs.map((job) => (
                    <li key={job.jobId}>
                      {job.description} — v{job.minorsTermsVersion} ·{' '}
                      {DATE_FORMATTER.format(new Date(job.minorsTermsAcceptedAt))} · IP{' '}
                      {job.minorsTermsIpAddress ?? '—'}
                      {job.minorsTermsVersion && (
                        <FullTextToggle type="minors_opportunity" version={job.minorsTermsVersion} />
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </dl>
      )}
    </div>
  );
}
