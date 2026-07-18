import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiFetchMock = vi.fn();
vi.mock('@shift/shared', () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

const { listMyShifts, checkIn, checkOut, confirmPayment } = await import('./shifts-api');

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

  it('chama POST /shifts/:id/check-in sem geolocalização', async () => {
    apiFetchMock.mockResolvedValue({ id: 'shift-1', status: 'checked_in' });

    await checkIn('shift-1');

    expect(apiFetchMock).toHaveBeenCalledWith('/shifts/shift-1/check-in', { method: 'POST' });
  });
});

describe('checkOut', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it('chama POST /shifts/:id/check-out sem geolocalização', async () => {
    apiFetchMock.mockResolvedValue({ id: 'shift-1', status: 'checked_out' });

    await checkOut('shift-1');

    expect(apiFetchMock).toHaveBeenCalledWith('/shifts/shift-1/check-out', { method: 'POST' });
  });
});

describe('confirmPayment', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it('chama POST /shifts/:id/payment/confirm com received', async () => {
    apiFetchMock.mockResolvedValue({ id: 'payment-1', status: 'confirmed' });

    await confirmPayment('shift-1', true);

    expect(apiFetchMock).toHaveBeenCalledWith('/shifts/shift-1/payment/confirm', {
      method: 'POST',
      body: JSON.stringify({ received: true }),
    });
  });
});
