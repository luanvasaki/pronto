import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { VerificationBanner } from './verification-banner';

describe('VerificationBanner', () => {
  it('não mostra nada quando o kyc está aprovado', () => {
    render(<VerificationBanner kycStatus="approved" />);

    expect(screen.queryByText(/análise/)).not.toBeInTheDocument();
    expect(screen.queryByText(/reprovado/)).not.toBeInTheDocument();
  });

  it('mostra aviso neutro quando está pendente', () => {
    render(<VerificationBanner kycStatus="pending" />);

    expect(
      screen.getByText('Seu cadastro está em análise. Assim que for aprovado, você poderá se candidatar a vagas.'),
    ).toBeInTheDocument();
  });

  it('mostra aviso e link de reenvio quando algum documento foi reprovado', () => {
    render(<VerificationBanner kycStatus="rejected" />);

    expect(screen.getByText('Um dos seus documentos foi reprovado.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver motivo e reenviar' })).toHaveAttribute(
      'href',
      '/cadastro/documento',
    );
  });
});
