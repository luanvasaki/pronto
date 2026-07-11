import { JobApplication, listJobApplications } from './applications-api';
import { Job } from './jobs-api';

export type ApplicationsByJobId = Record<string, JobApplication[]>;

/**
 * Painel, Calendário e Escalas precisavam, cada um, das candidaturas de
 * várias vagas de uma vez pra calcular pendências/turnos confirmados —
 * cada tela reimplementava o mesmo `Promise.all` de
 * `listJobApplications` por vaga. Centralizado aqui pra não triplicar o
 * código (o N+1 em si — uma request por vaga — continua o mesmo; criar
 * um endpoint de listagem em lote é uma mudança de backend fora do
 * escopo desse ajuste).
 */
export async function fetchApplicationsByJobId(jobs: Job[]): Promise<ApplicationsByJobId> {
  const results = await Promise.all(
    jobs.map((job) => listJobApplications(job.id).then((result) => [job.id, result.applications] as const)),
  );
  return Object.fromEntries(results);
}
