'use client';

import { ApiError } from '@shift/shared';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '../../../components/ui/button';
import { useRequireAuth } from '../../../hooks/use-require-auth';
import { JobApplication, listJobApplications, updateApplicationStatus } from '../../../lib/applications-api';

const STATUS_LABEL: Record<string, string> = {
  pending: 'Em análise',
  approved: 'Aprovado',
  rejected: 'Rejeitado',
  withdrawn: 'Retirada',
};

const STATUS_CLASS: Record<string, string> = {
  pending: 'bg-warning/10 text-warning',
  approved: 'bg-success/10 text-success',
  rejected: 'bg-danger/10 text-danger',
  withdrawn: 'bg-border text-text-secondary',
};

export default function VagaCandidatosPage() {
  const { isChecking } = useRequireAuth();
  const params = useParams<{ id: string }>();
  const jobId = params.id;

  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<{ id: string; message: string } | null>(null);

  useEffect(() => {
    if (isChecking) return;

    listJobApplications(jobId)
      .then((result) => setApplications(result.applications))
      .catch(() => setError('Não foi possível carregar os candidatos.'))
      .finally(() => setIsLoading(false));
  }, [isChecking, jobId]);

  async function handleDecision(applicationId: string, status: 'approved' | 'rejected'): Promise<void> {
    setActionError(null);
    setUpdatingId(applicationId);

    try {
      const updated = await updateApplicationStatus(applicationId, status);
      setApplications((current) =>
        current.map((application) =>
          application.id === applicationId ? { ...application, status: updated.status } : application,
        ),
      );
    } catch (err) {
      setActionError({
        id: applicationId,
        message: err instanceof ApiError ? err.message : 'Não foi possível atualizar a candidatura.',
      });
    } finally {
      setUpdatingId(null);
    }
  }

  if (isChecking || isLoading) {
    return (
      <main className="flex flex-1 items-center justify-center px-4">
        <p className="text-sm text-text-secondary">
          {isChecking ? 'Confirmando sua sessão...' : 'Carregando candidatos...'}
        </p>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col gap-4 px-4 py-8">
      <h1 className="font-heading text-2xl font-bold text-text">Candidatos</h1>

      {error && <p className="text-sm text-danger">{error}</p>}

      {applications.length === 0 && !error && (
        <p className="text-sm text-text-secondary">Ninguém se candidatou a essa vaga ainda.</p>
      )}

      <ul className="flex flex-col gap-3">
        {applications.map((application) => (
          <li key={application.id} className="rounded-md border border-border bg-surface p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-text">{application.worker.fullName}</p>
              <span
                className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${
                  STATUS_CLASS[application.status] ?? STATUS_CLASS.pending
                }`}
              >
                {STATUS_LABEL[application.status] ?? application.status}
              </span>
            </div>

            {application.worker.avgRating && (
              <p className="mt-1 text-sm text-text-secondary">Nota média: {application.worker.avgRating}</p>
            )}

            {actionError?.id === application.id && (
              <p className="mt-2 text-sm text-danger">{actionError.message}</p>
            )}

            {application.status === 'pending' && (
              <div className="mt-3 flex gap-2">
                <Button
                  type="button"
                  isLoading={updatingId === application.id}
                  onClick={() => handleDecision(application.id, 'approved')}
                >
                  Aprovar
                </Button>
                <Button
                  type="button"
                  variant="outlined"
                  isLoading={updatingId === application.id}
                  onClick={() => handleDecision(application.id, 'rejected')}
                >
                  Rejeitar
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
