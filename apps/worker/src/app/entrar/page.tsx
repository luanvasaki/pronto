'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { ApiError, googleLogin, login } from '@shift/shared';
import { Button } from '../../components/ui/button';
import { GoogleLoginButton } from '../../components/ui/google-login-button';
import { Input } from '../../components/ui/input';
import { Logo } from '../../components/ui/logo';
import { TermsCheckbox } from '../../components/ui/terms-checkbox';

export default function EntrarPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValid = email.trim().length > 0 && password.length > 0;

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!isValid || isSubmitting) return;

    setError(null);
    setIsSubmitting(true);

    try {
      await login(email, password);
      router.push('/inicio');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível entrar.');
      setIsSubmitting(false);
    }
  }

  async function handleGoogleSuccess(idToken: string): Promise<void> {
    if (!termsAccepted) {
      setError('Aceite os termos de uso para continuar.');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      await googleLogin(idToken, termsAccepted);
      router.push('/inicio');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível entrar com o Google.');
      setIsSubmitting(false);
    }
  }

  function handleGoogleError(): void {
    setError('Não foi possível entrar com o Google.');
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4">
      <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-5">
        <Logo className="mb-2" />
        <div>
          <h1 className="font-heading text-2xl font-bold text-text">Entre na sua conta</h1>
          <p className="mt-1 text-[15px] text-text-secondary">Encontre turnos perto de você.</p>
        </div>

        <TermsCheckbox checked={termsAccepted} onChange={setTermsAccepted} id="terms-accepted-entrar" />

        <div className="relative">
          <div className={termsAccepted ? undefined : 'pointer-events-none opacity-40'}>
            <GoogleLoginButton onSuccess={handleGoogleSuccess} onError={handleGoogleError} />
          </div>
          {!termsAccepted && (
            <div
              className="absolute inset-0 cursor-not-allowed"
              title="Aceite os termos de uso para entrar com o Google"
            />
          )}
        </div>

        <div className="flex items-center gap-3 text-xs font-medium text-text-secondary">
          <span className="h-px flex-1 bg-border" />
          ou
          <span className="h-px flex-1 bg-border" />
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
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={error ?? undefined}
        />

        <Link
          href="/esqueci-senha"
          className="text-left text-sm font-medium text-primary underline underline-offset-2"
        >
          Esqueci minha senha
        </Link>

        <Button type="submit" disabled={!isValid} isLoading={isSubmitting}>
          Entrar
        </Button>

        <Link
          href="/cadastro/conta"
          className="text-center text-sm text-text-secondary underline underline-offset-2 hover:text-primary"
        >
          Criar conta
        </Link>
      </form>
    </main>
  );
}
