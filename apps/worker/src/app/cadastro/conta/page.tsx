'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { ApiError, isValidPassword, register } from '@shift/shared';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Logo } from '../../../components/ui/logo';
import { SignupProgress } from '../../../components/ui/signup-progress';
import { TermsCheckbox } from '../../../components/ui/terms-checkbox';

export default function CadastroContaPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const passwordsMatch = password === confirmPassword;
  const isValid = email.trim().length > 0 && isValidPassword(password) && passwordsMatch && termsAccepted;

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!isValid || isSubmitting) return;

    setError(null);
    setIsSubmitting(true);

    try {
      await register(email, password, termsAccepted);
      router.push('/cadastro');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível criar sua conta.');
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-8">
      <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-5">
        <SignupProgress step={1} />
        <Logo className="mb-2" />
        <div>
          <h1 className="font-heading text-2xl font-bold text-text">Crie sua conta</h1>
          <p className="mt-1 text-[16px] text-text-secondary">Só o essencial pra começar.</p>
        </div>

        <Input
          id="email"
          label="E-mail"
          type="email"
          autoComplete="email"
          placeholder="voce@email.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />

        <Input
          id="password"
          label="Senha"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />

        <Input
          id="confirmPassword"
          label="Confirme a senha"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          error={confirmPassword.length > 0 && !passwordsMatch ? 'As senhas não coincidem.' : undefined}
        />

        <TermsCheckbox checked={termsAccepted} onChange={setTermsAccepted} />

        {error && <p className="text-sm text-danger">{error}</p>}

        <Button type="submit" disabled={!isValid} isLoading={isSubmitting}>
          Criar conta
        </Button>

        <Link
          href="/entrar"
          className="text-center text-sm text-text-secondary underline underline-offset-2 hover:text-primary"
        >
          Já tenho conta
        </Link>
      </form>
    </main>
  );
}
