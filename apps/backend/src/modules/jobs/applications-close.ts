export const DEFAULT_APPLICATIONS_CLOSE_BEFORE_MS = 60 * 60 * 1000;

/**
 * `applicationsCloseAt` só é gravado quando a empresa escolhe um
 * prazo — sem escolha, o padrão (1h antes do início) é calculado aqui
 * em cima do `startsAt` atual, em vez de congelado na criação, então
 * segue automaticamente se a vaga for editada.
 */
export function getApplicationsCloseAt(job: { startsAt: Date; applicationsCloseAt: Date | null }): Date {
  return job.applicationsCloseAt ?? new Date(job.startsAt.getTime() - DEFAULT_APPLICATIONS_CLOSE_BEFORE_MS);
}

export function areApplicationsClosed(job: { startsAt: Date; applicationsCloseAt: Date | null }): boolean {
  return getApplicationsCloseAt(job).getTime() <= Date.now();
}
