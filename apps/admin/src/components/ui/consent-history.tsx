'use client';

import { useState } from 'react';
import { AdminMinorsTermsJob } from '../../lib/admin-api';

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
            {termsAcceptedAt ? (
              <dd>
                v{termsVersion} · {DATE_FORMATTER.format(new Date(termsAcceptedAt))} · IP {termsIpAddress ?? '—'}
              </dd>
            ) : (
              <dd>Ainda não aceito.</dd>
            )}
          </div>

          <div>
            <dt className="font-semibold text-text">Termo resumido de ciência (login)</dt>
            {loginTermsAcceptedAt ? (
              <dd>
                v{loginTermsVersion} · {DATE_FORMATTER.format(new Date(loginTermsAcceptedAt))} · IP{' '}
                {loginTermsIpAddress ?? '—'}
              </dd>
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
                <ul className="flex flex-col gap-1">
                  {minorsTermsJobs.map((job) => (
                    <li key={job.jobId}>
                      {job.description} — v{job.minorsTermsVersion} ·{' '}
                      {DATE_FORMATTER.format(new Date(job.minorsTermsAcceptedAt))} · IP{' '}
                      {job.minorsTermsIpAddress ?? '—'}
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
