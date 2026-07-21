import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { VerificationBanner } from './verification-banner';

describe('VerificationBanner', () => {
  it('não mostra nada quando a empresa está aprovada', () => {
    render(<VerificationBanner verificationStatus="approved" rejectionReason={null} />);

    expect(screen.queryByText(/análise/)).not.toBeInTheDocument();
    expect(screen.queryByText(/não foi aprovada/)).not.toBeInTheDocument();
  });

  it('mostra aviso neutro quando está pendente', () => {
    render(<VerificationBanner verificationStatus="pending" rejectionReason={null} />);

    expect(
      screen.getByText('Sua empresa está em análise. Assim que for aprovada, você poderá publicar vagas.'),
    ).toBeInTheDocument();
  });

  it('mostra o motivo e link de reenvio quando foi reprovada', () => {
    render(<VerificationBanner verificationStatus="rejected" rejectionReason="Foto do cartão CNPJ ilegível" />);

    expect(screen.getByText('Sua empresa não foi aprovada: Foto do cartão CNPJ ilegível')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Reenviar documento' })).toHaveAttribute('href', '/perfil');
  });

  it('mostra mensagem genérica quando reprovada sem motivo registrado', () => {
    render(<VerificationBanner verificationStatus="rejected" rejectionReason={null} />);

    expect(screen.getByText('Sua empresa não foi aprovada.')).toBeInTheDocument();
  });
});
