'use client';

import { ApiError, googleLogin, login } from '@shift/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { Button } from '../../components/ui/button';
import { GoogleLoginButton } from '../../components/ui/google-login-button';
import { Input } from '../../components/ui/input';
import { Logo } from '../../components/ui/logo';
import { useRedirectIfAuthenticated } from '../../hooks/use-redirect-if-authenticated';

export default function EntrarPage() {
  const router = useRouter();
  const { isChecking } = useRedirectIfAuthenticated('/painel');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
      router.push('/painel');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível entrar.');
      setIsSubmitting(false);
    }
  }

  async function handleGoogleSuccess(idToken: string): Promise<void> {
    setError(null);
    setIsSubmitting(true);

    try {
      await googleLogin(idToken);
      router.push('/painel');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível entrar com o Google.');
      setIsSubmitting(false);
    }
  }

  function handleGoogleError(): void {
    setError('Não foi possível entrar com o Google.');
  }

  if (isChecking) {
    return (
      <main className="flex flex-1 items-center justify-center px-4">
        <p className="text-sm text-text-secondary">Confirmando sua sessão...</p>
      </main>
    );
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4">
      <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-5">
        <div className="mb-2 flex items-end gap-1.5">
          <Logo />
          <span className="font-heading text-2xl leading-[0.8] font-extrabold tracking-[-0.03em] text-text">
            Empresa
          </span>
        </div>
        <div>
          <h1 className="font-heading text-2xl font-bold text-text">Entre na sua conta</h1>
          <p className="mt-1 text-[16px] text-text-secondary">Acesse o painel da sua empresa.</p>
        </div>

        <GoogleLoginButton onSuccess={handleGoogleSuccess} onError={handleGoogleError} />

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
          placeholder="voce@empresa.com"
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
