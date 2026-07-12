import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Job } from './jobs-api';

const listJobApplicationsMock = vi.fn();
vi.mock('./applications-api', () => ({
  listJobApplications: (...args: unknown[]) => listJobApplicationsMock(...args),
}));

const { fetchApplicationsByJobId } = await import('./job-applications-summary');

function makeJob(id: string): Job {
  return {
    id,
    categoryId: 'cat-1',
    description: '',
    requiresExperience: false,
    dressCode: null,
    toolsRequired: null,
    cnhCategory: null,
    cnhRequired: false,
    offersMeal: false,
    offersTransport: false,
    addressLabel: '',
    locationLat: 0,
    locationLng: 0,
    positionsTotal: 1,
    positionsFilled: 0,
    payAmount: '100.00',
    startsAt: '2026-07-10T12:00:00.000Z',
    endsAt: '2026-07-10T18:00:00.000Z',
    applicationsCloseAt: null,
    status: 'open',
  };
}

describe('fetchApplicationsByJobId', () => {
  beforeEach(() => {
    listJobApplicationsMock.mockReset();
  });

  it('busca as candidaturas de cada vaga em paralelo e agrupa por jobId', async () => {
    listJobApplicationsMock.mockImplementation((jobId: string) =>
      Promise.resolve({ applications: [{ id: `app-${jobId}` }] }),
    );

    const result = await fetchApplicationsByJobId([makeJob('job-1'), makeJob('job-2')]);

    expect(listJobApplicationsMock).toHaveBeenCalledWith('job-1');
    expect(listJobApplicationsMock).toHaveBeenCalledWith('job-2');
    expect(listJobApplicationsMock).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      'job-1': [{ id: 'app-job-1' }],
      'job-2': [{ id: 'app-job-2' }],
    });
  });

  it('retorna objeto vazio quando não há vagas', async () => {
    const result = await fetchApplicationsByJobId([]);

    expect(result).toEqual({});
    expect(listJobApplicationsMock).not.toHaveBeenCalled();
  });
});
