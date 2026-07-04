import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiFetchMock = vi.fn();
vi.mock('@shift/shared', () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

const { listMyShifts, checkIn, checkOut } = await import('./shifts-api');

describe('listMyShifts', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it('chama GET /shifts/mine', async () => {
    apiFetchMock.mockResolvedValue({ shifts: [] });

    await listMyShifts();

    expect(apiFetchMock).toHaveBeenCalledWith('/shifts/mine');
  });
});

describe('checkIn', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it('chama POST /shifts/:id/check-in com lat e lng', async () => {
    apiFetchMock.mockResolvedValue({ id: 'shift-1', status: 'checked_in' });

    await checkIn('shift-1', -23.55, -46.63);

    expect(apiFetchMock).toHaveBeenCalledWith('/shifts/shift-1/check-in', {
      method: 'POST',
      body: JSON.stringify({ lat: -23.55, lng: -46.63 }),
    });
  });
});

describe('checkOut', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it('chama POST /shifts/:id/check-out com lat e lng', async () => {
    apiFetchMock.mockResolvedValue({ id: 'shift-1', status: 'completed' });

    await checkOut('shift-1', -23.55, -46.63);

    expect(apiFetchMock).toHaveBeenCalledWith('/shifts/shift-1/check-out', {
      method: 'POST',
      body: JSON.stringify({ lat: -23.55, lng: -46.63 }),
    });
  });
});
