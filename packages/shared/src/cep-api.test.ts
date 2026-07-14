import { afterEach, describe, expect, it, vi } from 'vitest';
import { lookupCep } from './cep-api';

const fetchMock = vi.fn();

describe('lookupCep', () => {
  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it('rejeita CEP com menos ou mais de 8 dígitos sem chamar a API', async () => {
    vi.stubGlobal('fetch', fetchMock);

    await expect(lookupCep('1234')).rejects.toThrow('CEP precisa ter 8 dígitos');
    await expect(lookupCep('123456789')).rejects.toThrow('CEP precisa ter 8 dígitos');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('busca no ViaCEP e devolve rua/bairro/cidade/uf', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        logradouro: 'Rua Augusta',
        bairro: 'Consolação',
        localidade: 'São Paulo',
        uf: 'SP',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await lookupCep('01305100');

    expect(fetchMock).toHaveBeenCalledWith('https://viacep.com.br/ws/01305100/json/');
    expect(result).toEqual({
      cep: '01305100',
      street: 'Rua Augusta',
      neighborhood: 'Consolação',
      city: 'São Paulo',
      state: 'SP',
    });
  });

  it('rejeita quando o ViaCEP responde { erro: true } (CEP não existe)', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ erro: true }) });
    vi.stubGlobal('fetch', fetchMock);

    await expect(lookupCep('00000000')).rejects.toThrow('CEP não encontrado');
  });

  it('rejeita quando a requisição falha (resposta não-ok)', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);

    await expect(lookupCep('01305100')).rejects.toThrow('Não foi possível buscar esse CEP');
  });
});
