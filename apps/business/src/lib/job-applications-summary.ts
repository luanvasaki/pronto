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
 *
 * `allSettled`, não `all`: com N vagas em paralelo, uma falha isolada
 * (instabilidade de rede numa request só) não pode derrubar a tela
 * inteira escondendo as outras N-1 vagas que teriam carregado normal.
 * A vaga que falhou fica de fora do resultado — melhor mostrar menos
 * do que nada.
 */
export async function fetchApplicationsByJobId(jobs: Job[]): Promise<ApplicationsByJobId> {
  const results = await Promise.allSettled(
    jobs.map((job) => listJobApplications(job.id).then((result) => [job.id, result.applications] as const)),
  );
  const fulfilled = results.filter(
    (result): result is PromiseFulfilledResult<readonly [string, JobApplication[]]> => result.status === 'fulfilled',
  );
  return Object.fromEntries(fulfilled.map((result) => result.value));
}
