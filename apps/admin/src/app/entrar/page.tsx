'use client';

import { ApiError, getCurrentUser, googleLogin, login, logout } from '@shift/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { Button } from '../../components/ui/button';
import { GoogleLoginButton } from '../../components/ui/google-login-button';
import { Input } from '../../components/ui/input';
import { Logo } from '../../components/ui/logo';

const NOT_ADMIN_MESSAGE = 'Essa conta não tem acesso de administrador.';

/**
 * Único ponto de entrada do site — não tem cadastro próprio (contas
 * de admin não são self-service, `isAdmin` é setado direto no banco).
 * Login funciona pra qualquer conta válida (mesmo endpoint dos outros
 * apps), mas só quem tem `isAdmin: true` passa daqui — pra qualquer
 * outra conta, desloga na hora e mostra o mesmo aviso que
 * app/admin/layout.tsx mostraria de qualquer forma, só que sem
 * precisar completar a navegação pra descobrir isso.
 */
export default function EntrarPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValid = email.trim().length > 0 && password.length > 0;

  // ApiError (não um Error genérico) de propósito — assim o catch de
  // baixo trata isso exatamente como trataria uma rejeição vinda de
  // verdade da API, sem precisar de um branch a mais que também
  // vazaria mensagem crua de erro de rede/inesperado pro usuário.
  async function requireAdminOrReject(): Promise<void> {
    const { user } = await getCurrentUser();
    if (!user.isAdmin) {
      await logout();
      throw new ApiError(403, NOT_ADMIN_MESSAGE);
    }
  }

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!isValid || isSubmitting) return;

    setError(null);
    setIsSubmitting(true);

    try {
      await login(email, password);
      await requireAdminOrReject();
      router.push('/admin');
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
      await requireAdminOrReject();
      router.push('/admin');
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
        <div className="mb-2 flex items-end gap-1.5">
          <Logo />
          <span className="font-heading text-2xl leading-[0.8] font-extrabold tracking-[-0.03em] text-text">
            Admin
          </span>
        </div>
        <div>
          <h1 className="font-heading text-2xl font-bold text-text">Entre na sua conta</h1>
          <p className="mt-1 text-[16px] text-text-secondary">Acesso restrito a administradores do Pronto.</p>
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
          placeholder="voce@pronto.com"
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
      </form>
    </main>
  );
}
