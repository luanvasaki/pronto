import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AddressFields, buildAddressLabel } from './address-fields';

const lookupCepMock = vi.fn();
vi.mock('@shift/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shift/shared')>();
  return {
    ...actual,
    lookupCep: (...args: unknown[]) => lookupCepMock(...args),
  };
});

function Harness() {
  const [cep, setCep] = useState('');
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [complement, setComplement] = useState('');
  const [resolved, setResolved] = useState({ neighborhood: '', city: '', state: '' });

  return (
    <AddressFields
      cep={cep}
      onChangeCep={setCep}
      street={street}
      onChangeStreet={setStreet}
      number={number}
      onChangeNumber={setNumber}
      complement={complement}
      onChangeComplement={setComplement}
      neighborhood={resolved.neighborhood}
      city={resolved.city}
      state={resolved.state}
      onResolvedCep={setResolved}
    />
  );
}

describe('AddressFields', () => {
  afterEach(() => {
    lookupCepMock.mockReset();
  });

  it('busca a rua automaticamente quando o CEP completa 8 dígitos e sai do campo', async () => {
    lookupCepMock.mockResolvedValue({
      cep: '01305100',
      street: 'Rua Augusta',
      neighborhood: 'Consolação',
      city: 'São Paulo',
      state: 'SP',
    });
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(screen.getByLabelText('CEP'), '01305100');
    await user.tab();

    expect(lookupCepMock).toHaveBeenCalledWith('01305100');
    expect(await screen.findByDisplayValue('Rua Augusta')).toBeInTheDocument();
    expect(screen.getByText('Consolação, São Paulo - SP')).toBeInTheDocument();
  });

  it('mostra a máscara do CEP conforme digita', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(screen.getByLabelText('CEP'), '01305100');

    expect(screen.getByLabelText('CEP')).toHaveValue('01305-100');
  });

  it('mostra erro e não trava o campo quando o CEP não existe', async () => {
    lookupCepMock.mockRejectedValue(new Error('CEP não encontrado.'));
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(screen.getByLabelText('CEP'), '00000000');
    await user.tab();

    expect(await screen.findByText('CEP não encontrado.')).toBeInTheDocument();
  });

  it('não chama a busca com CEP incompleto', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(screen.getByLabelText('CEP'), '0130');
    await user.tab();

    await waitFor(() => expect(lookupCepMock).not.toHaveBeenCalled());
  });
});

describe('buildAddressLabel', () => {
  it('monta rua, número, complemento, bairro, cidade e UF', () => {
    expect(
      buildAddressLabel({
        street: 'Rua Augusta',
        number: '1200',
        complement: 'Apto 4',
        neighborhood: 'Consolação',
        city: 'São Paulo',
        state: 'SP',
      }),
    ).toBe('Rua Augusta, 1200 - Apto 4 - Consolação, São Paulo - SP');
  });

  it('omite o complemento quando vazio', () => {
    expect(
      buildAddressLabel({
        street: 'Rua Augusta',
        number: '1200',
        complement: '',
        neighborhood: 'Consolação',
        city: 'São Paulo',
        state: 'SP',
      }),
    ).toBe('Rua Augusta, 1200 - Consolação, São Paulo - SP');
  });

  it('degrada bem quando bairro/cidade/UF ainda não foram resolvidos', () => {
    expect(
      buildAddressLabel({ street: 'Rua Augusta', number: '1200', complement: '', neighborhood: '', city: '', state: '' }),
    ).toBe('Rua Augusta, 1200');
  });
});
